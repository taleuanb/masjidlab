import { useState, useEffect, useCallback } from "react";
import {
  Building2, Users, Globe, Loader2, RefreshCw, Check, Shield, Save,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/contexts/RoleContext";
import { useToast } from "@/hooks/use-toast";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const RBAC_ROLES = [
  { id: "admin", label: "Admin" },
  { id: "enseignant", label: "Enseignant" },
  { id: "benevole", label: "Bénévole" },
  { id: "responsable", label: "Responsable" },
  { id: "parent", label: "Parent" },
];

const RBAC_MODULES = [
  { id: "education", label: "Éducation" },
  { id: "admin", label: "Finance / RH" },
  { id: "logistics", label: "Opérations" },
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

// ── Dashboard Tab ──────────────────────────────────────────
function DashboardTab({
  orgs, totalUsers, loading, fetchAll, openModules,
}: {
  orgs: OrgRow[];
  totalUsers: number;
  loading: boolean;
  fetchAll: () => void;
  openModules: (o: OrgRow) => void;
}) {
  return (
    <div className="space-y-6">
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
  );
}

// ── Permissions Tab ────────────────────────────────────────
type PermMatrix = Record<string, Record<string, boolean>>;

function PermissionsTab() {
  const { toast } = useToast();
  const [matrix, setMatrix] = useState<PermMatrix>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load global defaults (org_id IS NULL)
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("role_permissions" as any)
          .select("role, module, enabled")
          .is("org_id", null);
        if (error) throw error;

        // Build matrix with defaults
        const m: PermMatrix = {};
        for (const role of RBAC_ROLES) {
          m[role.id] = {};
          for (const mod of RBAC_MODULES) {
            m[role.id][mod.id] = false;
          }
        }
        // Apply saved values
        for (const row of (data ?? []) as any[]) {
          if (m[row.role]) m[row.role][row.module] = !!row.enabled;
        }
        setMatrix(m);
      } catch (err: any) {
        toast({ title: "Erreur", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const toggle = (role: string, module: string) => {
    setMatrix((prev) => ({
      ...prev,
      [role]: { ...prev[role], [module]: !prev[role][module] },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build upsert rows
      const rows: any[] = [];
      for (const role of RBAC_ROLES) {
        for (const mod of RBAC_MODULES) {
          rows.push({
            org_id: null,
            role: role.id,
            module: mod.id,
            enabled: matrix[role.id]?.[mod.id] ?? false,
          });
        }
      }

      const { error } = await supabase
        .from("role_permissions" as any)
        .upsert(rows, { onConflict: "org_id,role,module" });
      if (error) throw error;

      toast({ title: "Configuration sauvegardée", description: "Les permissions par défaut ont été mises à jour." });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Matrice des permissions</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Définissez les modules accessibles par rôle (configuration globale par défaut).
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Sauvegarder la configuration globale
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Module</TableHead>
                {RBAC_ROLES.map((r) => (
                  <TableHead key={r.id} className="text-center">{r.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {RBAC_MODULES.map((mod) => (
                <TableRow key={mod.id}>
                  <TableCell className="font-medium">{mod.label}</TableCell>
                  {RBAC_ROLES.map((role) => (
                    <TableCell key={role.id} className="text-center">
                      <Switch
                        checked={matrix[role.id]?.[mod.id] ?? false}
                        onCheckedChange={() => toggle(role.id, mod.id)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function SaasAdminPage() {
  const { isSuperAdmin } = useRole();
  const { toast } = useToast();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);

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

        {/* Tabs */}
        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="permissions">Permissions & RBAC</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <DashboardTab
              orgs={orgs}
              totalUsers={totalUsers}
              loading={loading}
              fetchAll={fetchAll}
              openModules={openModules}
            />
          </TabsContent>

          <TabsContent value="permissions">
            <PermissionsTab />
          </TabsContent>
        </Tabs>
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
