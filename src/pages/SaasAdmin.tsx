import { useState, useEffect, useCallback, Fragment } from "react";
import {
  Building2, Users, Globe, Loader2, RefreshCw, Check, Shield, Save,
  ChevronDown, ChevronRight,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Navigate } from "react-router-dom";

import { MODULE_REGISTRY, PLAN_META, type PlanId, isPlanAtLeast } from "@/config/module-registry";

const ALL_POLES = MODULE_REGISTRY
  .filter((m) => !m.isCore)
  .map((m) => ({ id: m.id, label: m.label }));

const RBAC_ROLES = [
  { id: "admin", label: "Admin" },
  { id: "enseignant", label: "Enseignant" },
  { id: "benevole", label: "Bénévole" },
  { id: "responsable", label: "Responsable" },
  { id: "parent", label: "Parent" },
];

const RBAC_MODULES: { id: string; label: string; children?: { id: string; label: string }[] }[] = [
  {
    id: "education", label: "Éducation",
    children: [
      { id: "education.classes", label: "Classes" },
      { id: "education.eleves", label: "Élèves" },
      { id: "education.inscriptions", label: "Inscriptions" },
    ],
  },
  {
    id: "admin", label: "Finance / RH",
    children: [
      { id: "admin.finance", label: "Finance" },
      { id: "admin.contrats", label: "Contrats Staff" },
      { id: "admin.donateurs", label: "Donateurs" },
    ],
  },
  {
    id: "logistics", label: "Opérations",
    children: [
      { id: "logistics.planning", label: "Planning" },
      { id: "logistics.maintenance", label: "Maintenance" },
      { id: "logistics.parking", label: "Parking" },
    ],
  },
  { id: "social", label: "Social" },
  { id: "comms", label: "Communication" },
];

// Flatten all module IDs for matrix init
function getAllModuleIds(): string[] {
  const ids: string[] = [];
  for (const mod of RBAC_MODULES) {
    ids.push(mod.id);
    if (mod.children) ids.push(...mod.children.map((c) => c.id));
  }
  return ids;
}

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

function buildEmptyMatrix(allIds: string[]): PermMatrix {
  const m: PermMatrix = {};
  for (const role of RBAC_ROLES) {
    m[role.id] = {};
    for (const modId of allIds) m[role.id][modId] = false;
  }
  return m;
}

function PermissionsTab({ orgs }: { orgs: OrgRow[] }) {
  const { toast } = useToast();
  const allIds = getAllModuleIds();
  

  const [selectedOrgId, setSelectedOrgId] = useState<string>("global");
  const [matrix, setMatrix] = useState<PermMatrix>(buildEmptyMatrix(allIds));
  const [globalMatrix, setGlobalMatrix] = useState<PermMatrix>(buildEmptyMatrix(allIds));
  const [hasOrgOverride, setHasOrgOverride] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const isGlobal = selectedOrgId === "global";
  // Resolve selected org's plan for plan-aware matrix
  const selectedOrgPlan = (isGlobal ? null : orgs.find((o) => o.id === selectedOrgId)?.subscription_plan ?? "starter") as PlanId | null;

  // Load global defaults once
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("role_permissions" as any)
        .select("role, module, enabled, can_view")
        .is("org_id", null);
      const m = buildEmptyMatrix(allIds);
      for (const row of (data ?? []) as any[]) {
        if (m[row.role]) m[row.role][row.module] = !!(row.enabled ?? row.can_view);
      }
      setGlobalMatrix(m);
    })();
  }, []);

  // Load matrix when org selection changes
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (isGlobal) {
          const { data, error } = await supabase
            .from("role_permissions" as any)
            .select("role, module, enabled, can_view")
            .is("org_id", null);
          if (error) throw error;
          const m = buildEmptyMatrix(allIds);
          for (const row of (data ?? []) as any[]) {
            if (m[row.role]) m[row.role][row.module] = !!(row.enabled ?? row.can_view);
          }
          setMatrix(m);
          setGlobalMatrix(m);
          setHasOrgOverride(false);
        } else {
          const { data, error } = await supabase
            .from("role_permissions" as any)
            .select("role, module, enabled, can_view")
            .eq("org_id", selectedOrgId);
          if (error) throw error;
          if (!data || data.length === 0) {
            setMatrix(JSON.parse(JSON.stringify(globalMatrix)));
            setHasOrgOverride(false);
          } else {
            const m = buildEmptyMatrix(allIds);
            for (const row of (data as any[])) {
              if (m[row.role]) m[row.role][row.module] = !!(row.enabled ?? row.can_view);
            }
            setMatrix(m);
            setHasOrgOverride(true);
          }
        }
      } catch (err: any) {
        toast({ title: "Erreur", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedOrgId, toast]);

  const copyDefaults = () => {
    setMatrix(JSON.parse(JSON.stringify(globalMatrix)));
    setHasOrgOverride(true);
  };

  // Check if a specific cell differs from global default
  const isDifferentFromGlobal = (roleId: string, modId: string) => {
    if (isGlobal) return false;
    return (matrix[roleId]?.[modId] ?? false) !== (globalMatrix[roleId]?.[modId] ?? false);
  };

  const toggle = (role: string, moduleId: string) => {
    if (!isGlobal && !hasOrgOverride) setHasOrgOverride(true);
    setMatrix((prev) => {
      const next = { ...prev, [role]: { ...prev[role] } };
      const newVal = !next[role][moduleId];
      next[role][moduleId] = newVal;

      const parent = RBAC_MODULES.find((m) => m.id === moduleId);
      if (parent?.children && !newVal) {
        for (const child of parent.children) next[role][child.id] = false;
      }
      if (newVal) {
        const parentMod = RBAC_MODULES.find((m) => m.children?.some((c) => c.id === moduleId));
        if (parentMod) next[role][parentMod.id] = true;
      }
      return next;
    });
  };

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const orgId = isGlobal ? null : selectedOrgId;
      const rows: any[] = [];
      for (const role of RBAC_ROLES) {
        for (const modId of allIds) {
          const val = matrix[role.id]?.[modId] ?? false;
          rows.push({ org_id: orgId, role: role.id, module: modId, enabled: val, can_view: val });
        }
      }
      const { error } = await supabase
        .from("role_permissions" as any)
        .upsert(rows, { onConflict: "org_id,role,module" });
      if (error) throw error;

      if (isGlobal) setGlobalMatrix(JSON.parse(JSON.stringify(matrix)));
      setHasOrgOverride(true);
      toast({
        title: "Configuration sauvegardée",
        description: isGlobal
          ? "Les permissions par défaut ont été mises à jour."
          : `Permissions personnalisées pour ${orgs.find((o) => o.id === selectedOrgId)?.name ?? "l'organisation"}.`,
      });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const selectedOrgName = orgs.find((o) => o.id === selectedOrgId)?.name;

  return (
    <div className="space-y-4">
      {/* Org selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
          <SelectTrigger className="w-72 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global">--- Configuration Globale (Défaut) ---</SelectItem>
            {orgs.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!isGlobal && !hasOrgOverride && (
          <Button variant="outline" size="sm" onClick={copyDefaults}>
            Copier les réglages par défaut
          </Button>
        )}

        {!isGlobal && hasOrgOverride && (
          <Badge variant="secondary" className="text-xs">Personnalisé</Badge>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">
                Matrice des permissions
                {!isGlobal && selectedOrgName && (
                  <span className="text-muted-foreground font-normal ml-2">— {selectedOrgName}</span>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {isGlobal
                  ? "Configuration par défaut appliquée à toutes les organisations."
                  : "Surcharge spécifique pour cette organisation."}
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Sauvegarder
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-56">Module</TableHead>
                  {RBAC_ROLES.map((r) => (
                    <TableHead key={r.id} className="text-center">{r.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {RBAC_MODULES.map((mod) => {
                  const isCollapsed = collapsed[mod.id];
                  const hasChildren = !!mod.children?.length;
                  return (
                    <Fragment key={mod.id}>
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-semibold">
                          <button
                            type="button"
                            className="flex items-center gap-1.5 text-left w-full"
                            onClick={() => hasChildren && toggleCollapse(mod.id)}
                          >
                            {hasChildren ? (
                              isCollapsed
                                ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            ) : <span className="w-4" />}
                            {mod.label}
                          </button>
                        </TableCell>
                        {RBAC_ROLES.map((role) => (
                          <TableCell key={role.id} className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <Switch
                                checked={matrix[role.id]?.[mod.id] ?? false}
                                onCheckedChange={() => toggle(role.id, mod.id)}
                              />
                              {isDifferentFromGlobal(role.id, mod.id) && (
                                <span className="text-[9px] text-primary font-medium">Modifié</span>
                              )}
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                      {hasChildren && !isCollapsed && mod.children!.map((child) => (
                        <TableRow key={child.id}>
                          <TableCell className="pl-10 text-muted-foreground text-sm">{child.label}</TableCell>
                          {RBAC_ROLES.map((role) => (
                            <TableCell key={role.id} className="text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <Switch
                                  checked={matrix[role.id]?.[child.id] ?? false}
                                  onCheckedChange={() => toggle(role.id, child.id)}
                                  disabled={blockedByPlan || !(matrix[role.id]?.[mod.id])}
                                />
                                {isDifferentFromGlobal(role.id, child.id) && (
                                  <span className="text-[9px] text-primary font-medium">Modifié</span>
                                )}
                              </div>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
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
            <PermissionsTab orgs={orgs} />
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
