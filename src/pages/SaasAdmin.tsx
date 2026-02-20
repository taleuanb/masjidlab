import { useState, useEffect, useCallback } from "react";
import {
  Building2, Users, Globe, Loader2, RefreshCw, Check, X, Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/contexts/RoleContext";
import { useToast } from "@/hooks/use-toast";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Navigate } from "react-router-dom";

const ALL_POLES = [
  { id: "admin", label: "Gouvernance" },
  { id: "logistics", label: "Opérations & Planning" },
  { id: "education", label: "Éducation" },
  { id: "social", label: "Social" },
  { id: "comms", label: "Communication" },
];

interface OrgRow {
  id: string;
  name: string;
  active_poles: string[];
  subscription_plan: string | null;
  member_count: number;
}

export default function SaasAdminPage() {
  const { isSuperAdmin } = useRole();
  const { toast } = useToast();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);

  // Module management dialog
  const [editOrg, setEditOrg] = useState<OrgRow | null>(null);
  const [editPoles, setEditPoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: orgsData } = await supabase.rpc("get_all_organizations");
      const { data: profiles } = await supabase.from("profiles").select("org_id");

      const orgCounts = new Map<string, number>();
      (profiles ?? []).forEach((p: any) => {
        if (p.org_id) orgCounts.set(p.org_id, (orgCounts.get(p.org_id) ?? 0) + 1);
      });

      const rows: OrgRow[] = (orgsData ?? []).map((o: any) => ({
        id: o.id,
        name: o.name,
        active_poles: o.active_poles ?? [],
        subscription_plan: o.subscription_plan,
        member_count: orgCounts.get(o.id) ?? 0,
      }));
      setOrgs(rows);
      setTotalUsers((profiles ?? []).length);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openModules = (o: OrgRow) => {
    setEditOrg(o);
    setEditPoles([...o.active_poles]);
  };

  const togglePole = (poleId: string) => {
    setEditPoles((prev) =>
      prev.includes(poleId) ? prev.filter((p) => p !== poleId) : [...prev, poleId]
    );
  };

  const handleSaveModules = async () => {
    if (!editOrg) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ active_poles: editPoles })
        .eq("id", editOrg.id);
      if (error) throw error;
      toast({ title: "Modules mis à jour", description: `${editOrg.name} — ${editPoles.length} modules actifs.` });
      setEditOrg(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) return <Navigate to="/" replace />;

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Console SaaS
            </h1>
            <p className="text-sm text-muted-foreground">Administration globale des mosquées</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Mosquées</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{orgs.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Utilisateurs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{totalUsers}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Modules Disponibles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{ALL_POLES.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Org table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Organisations</CardTitle>
              <Button variant="outline" size="sm" onClick={fetchAll}>
                <RefreshCw className="h-4 w-4 mr-1" /> Rafraîchir
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mosquée</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Membres</TableHead>
                    <TableHead>Modules Actifs</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgs.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {o.subscription_plan ?? "starter"}
                        </Badge>
                      </TableCell>
                      <TableCell>{o.member_count}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {o.active_poles.map((p) => (
                            <Badge key={p} variant="secondary" className="text-[10px]">
                              {ALL_POLES.find((ap) => ap.id === p)?.label ?? p}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openModules(o)}>
                          Gérer les modules
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Module management dialog */}
      <Dialog open={!!editOrg} onOpenChange={() => setEditOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modules — {editOrg?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {ALL_POLES.map((pole) => (
              <label
                key={pole.id}
                className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  checked={editPoles.includes(pole.id)}
                  onCheckedChange={() => togglePole(pole.id)}
                />
                <span className="text-sm font-medium">{pole.label}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrg(null)}>Annuler</Button>
            <Button onClick={handleSaveModules} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
