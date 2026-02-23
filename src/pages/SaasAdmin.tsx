import { useState, useEffect, useCallback, Fragment } from "react";
import {
  Building2, Users, Globe, Loader2, RefreshCw, Check, Shield, Save,
  ChevronDown, ChevronRight, Lock,
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
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Navigate } from "react-router-dom";
import { MODULE_REGISTRY, PLAN_META, type PlanId, isPlanAtLeast } from "@/config/module-registry";
import {
  RBAC_MODULE_HIERARCHY, getAllRbacModuleIds, getRegistryMeta,
  CATEGORY_LABELS, type RbacModuleGroup,
} from "@/config/rbac-modules";

const ALL_POLES = MODULE_REGISTRY
  .filter((m) => !m.isCore)
  .map((m) => ({ id: m.id, label: m.label }));

const RBAC_ROLES = [
  { id: "admin", label: "Admin" },
  { id: "responsable", label: "Responsable" },
  { id: "enseignant", label: "Enseignant" },
  { id: "benevole", label: "Bénévole" },
  { id: "parent", label: "Parent" },
];

// ── Permission keys per sub-module ────────────────────────
const PERM_COLS = ["can_view", "can_edit", "can_delete"] as const;
type PermCol = (typeof PERM_COLS)[number];
const PERM_LABELS: Record<PermCol, string> = {
  can_view: "Voir",
  can_edit: "Modifier",
  can_delete: "Supprimer",
};

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
/**
 * Permission value per module per role.
 * Key format: `${roleId}::${moduleId}::${permCol}`
 */
type PermMatrix = Record<string, boolean>;

function permKey(roleId: string, moduleId: string, col: PermCol | "enabled"): string {
  return `${roleId}::${moduleId}::${col}`;
}

function buildEmptyMatrix(): PermMatrix {
  const m: PermMatrix = {};
  const allIds = getAllRbacModuleIds();
  for (const role of RBAC_ROLES) {
    for (const modId of allIds) {
      m[permKey(role.id, modId, "enabled")] = false;
      for (const col of PERM_COLS) {
        m[permKey(role.id, modId, col)] = false;
      }
    }
  }
  return m;
}

function PermissionsTab({ orgs }: { orgs: OrgRow[] }) {
  const { toast } = useToast();

  const [selectedOrgId, setSelectedOrgId] = useState<string>("global");
  const [matrix, setMatrix] = useState<PermMatrix>(buildEmptyMatrix);
  const [globalMatrix, setGlobalMatrix] = useState<PermMatrix>(buildEmptyMatrix);
  const [hasOrgOverride, setHasOrgOverride] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isGlobal = selectedOrgId === "global";
  const selectedOrgPlan = (isGlobal ? null : orgs.find((o) => o.id === selectedOrgId)?.subscription_plan ?? "starter") as PlanId | null;

  // ── Load permissions from DB ──
  const loadMatrix = useCallback(async (orgId: string | null): Promise<PermMatrix> => {
    const m = buildEmptyMatrix();
    const query = supabase
      .from("role_permissions" as any)
      .select("role, module, enabled, can_view, can_edit, can_delete");

    const { data, error } = orgId
      ? await query.eq("org_id", orgId)
      : await query.is("org_id", null);

    if (error) throw error;

    for (const row of (data ?? []) as any[]) {
      const r = row.role as string;
      const mod = row.module as string;
      if (!RBAC_ROLES.some((role) => role.id === r)) continue;
      m[permKey(r, mod, "enabled")] = !!(row.enabled ?? row.can_view);
      m[permKey(r, mod, "can_view")] = !!row.can_view;
      m[permKey(r, mod, "can_edit")] = !!row.can_edit;
      m[permKey(r, mod, "can_delete")] = !!row.can_delete;
    }
    return m;
  }, []);

  // Load global defaults
  useEffect(() => {
    loadMatrix(null).then(setGlobalMatrix).catch(() => {});
  }, [loadMatrix]);

  // Load current selection
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (isGlobal) {
          const m = await loadMatrix(null);
          setMatrix(m);
          setGlobalMatrix(m);
          setHasOrgOverride(false);
        } else {
          const m = await loadMatrix(selectedOrgId);
          const hasData = Object.values(m).some(Boolean);
          if (!hasData) {
            setMatrix({ ...globalMatrix });
            setHasOrgOverride(false);
          } else {
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
  }, [selectedOrgId, loadMatrix, toast]);

  const copyDefaults = () => {
    setMatrix({ ...globalMatrix });
    setHasOrgOverride(true);
  };

  const isDiff = (roleId: string, modId: string, col: PermCol | "enabled") => {
    if (isGlobal) return false;
    const k = permKey(roleId, modId, col);
    return (matrix[k] ?? false) !== (globalMatrix[k] ?? false);
  };

  // ── Toggle logic ──
  const toggleEnabled = (roleId: string, groupId: string) => {
    if (!isGlobal && !hasOrgOverride) setHasOrgOverride(true);
    setMatrix((prev) => {
      const next = { ...prev };
      const k = permKey(roleId, groupId, "enabled");
      const newVal = !next[k];
      next[k] = newVal;

      // If disabling parent, disable all children
      const group = RBAC_MODULE_HIERARCHY.find((g) => g.id === groupId);
      if (group && !newVal) {
        for (const child of group.children) {
          next[permKey(roleId, child.id, "enabled")] = false;
          for (const col of PERM_COLS) {
            next[permKey(roleId, child.id, col)] = false;
          }
        }
      }
      // If enabling child, auto-enable parent
      if (newVal) {
        const parentGroup = RBAC_MODULE_HIERARCHY.find((g) => g.children.some((c) => c.id === groupId));
        if (parentGroup) {
          next[permKey(roleId, parentGroup.id, "enabled")] = true;
        }
      }
      // Sync can_view with enabled for parent
      next[permKey(roleId, groupId, "can_view")] = newVal;
      return next;
    });
  };

  const toggleChildEnabled = (roleId: string, childId: string, parentId: string) => {
    if (!isGlobal && !hasOrgOverride) setHasOrgOverride(true);
    setMatrix((prev) => {
      const next = { ...prev };
      const k = permKey(roleId, childId, "enabled");
      const newVal = !next[k];
      next[k] = newVal;
      next[permKey(roleId, childId, "can_view")] = newVal;

      // If enabling child, ensure parent is enabled
      if (newVal) {
        next[permKey(roleId, parentId, "enabled")] = true;
        next[permKey(roleId, parentId, "can_view")] = true;
      }
      // If disabling child & no siblings left, disable parent
      if (!newVal) {
        const group = RBAC_MODULE_HIERARCHY.find((g) => g.id === parentId);
        if (group) {
          const anyChildEnabled = group.children.some(
            (c) => c.id !== childId && next[permKey(roleId, c.id, "enabled")]
          );
          if (!anyChildEnabled) {
            // Keep parent enabled state — user can choose to disable manually
          }
        }
      }
      // Reset granular perms when disabling
      if (!newVal) {
        for (const col of PERM_COLS) {
          next[permKey(roleId, childId, col)] = false;
        }
      }
      return next;
    });
  };

  const togglePerm = (roleId: string, modId: string, col: PermCol) => {
    if (!isGlobal && !hasOrgOverride) setHasOrgOverride(true);
    setMatrix((prev) => {
      const next = { ...prev };
      next[permKey(roleId, modId, col)] = !next[permKey(roleId, modId, col)];
      return next;
    });
  };

  // ── Save ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const orgId = isGlobal ? null : selectedOrgId;
      const allIds = getAllRbacModuleIds();
      const rows: any[] = [];
      for (const role of RBAC_ROLES) {
        for (const modId of allIds) {
          const parentGroup = RBAC_MODULE_HIERARCHY.find((g) => g.id === modId);
          const parentOfChild = RBAC_MODULE_HIERARCHY.find((g) => g.children.some((c) => c.id === modId));
          rows.push({
            org_id: orgId,
            role: role.id,
            module: modId,
            parent_key: parentOfChild ? parentOfChild.id : null,
            enabled: matrix[permKey(role.id, modId, "enabled")] ?? false,
            can_view: matrix[permKey(role.id, modId, "can_view")] ?? false,
            can_edit: matrix[permKey(role.id, modId, "can_edit")] ?? false,
            can_delete: matrix[permKey(role.id, modId, "can_delete")] ?? false,
          });
        }
      }
      const { error } = await supabase
        .from("role_permissions" as any)
        .upsert(rows, { onConflict: "org_id,role,module" });
      if (error) throw error;

      if (isGlobal) setGlobalMatrix({ ...matrix });
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

  // ── Group by category ──
  const categories = ["metiers", "logistique", "personnel"] as const;

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
          <CardContent className="p-0 sm:p-4">
            <Accordion type="multiple" defaultValue={categories.map(String)} className="space-y-3">
              {categories.map((cat) => {
                const groups = RBAC_MODULE_HIERARCHY.filter((g) => g.category === cat);
                if (groups.length === 0) return null;

                return (
                  <AccordionItem key={cat} value={cat} className="border rounded-lg overflow-hidden">
                    <AccordionTrigger className="px-4 py-2.5 hover:no-underline bg-muted/30">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {CATEGORY_LABELS[cat]}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-48 min-w-[12rem]">Module</TableHead>
                              {RBAC_ROLES.map((r) => (
                                <TableHead key={r.id} className="text-center min-w-[5rem]">{r.label}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groups.map((group) => (
                              <ModuleGroupRows
                                key={group.id}
                                group={group}
                                matrix={matrix}
                                isGlobal={isGlobal}
                                selectedOrgPlan={selectedOrgPlan}
                                isDiff={isDiff}
                                toggleEnabled={toggleEnabled}
                                toggleChildEnabled={toggleChildEnabled}
                                togglePerm={togglePerm}
                              />
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Module Group Rows (Parent + Children) ─────────────────
function ModuleGroupRows({
  group, matrix, isGlobal, selectedOrgPlan, isDiff,
  toggleEnabled, toggleChildEnabled, togglePerm,
}: {
  group: RbacModuleGroup;
  matrix: PermMatrix;
  isGlobal: boolean;
  selectedOrgPlan: PlanId | null;
  isDiff: (roleId: string, modId: string, col: PermCol | "enabled") => boolean;
  toggleEnabled: (roleId: string, groupId: string) => void;
  toggleChildEnabled: (roleId: string, childId: string, parentId: string) => void;
  togglePerm: (roleId: string, modId: string, col: PermCol) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const meta = getRegistryMeta(group.id);
  const blockedByPlan = !isGlobal && selectedOrgPlan && meta
    ? !isPlanAtLeast(selectedOrgPlan, meta.minPlan)
    : false;
  const hasChildren = group.children.length > 0;

  return (
    <Fragment>
      {/* ── Parent row ── */}
      <TableRow className={blockedByPlan ? "bg-muted/10 opacity-50" : "bg-muted/20"}>
        <TableCell className="font-semibold">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 text-left flex-1"
              onClick={() => hasChildren && setExpanded((o) => !o)}
            >
              {hasChildren ? (
                expanded
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : <span className="w-4" />}
              {meta?.icon && <meta.icon className="h-4 w-4 text-muted-foreground" />}
              {group.label}
            </button>
            {blockedByPlan && meta && (
              <Badge variant="outline" className={`gap-1 text-[9px] px-1.5 py-0 h-4 shrink-0 ${PLAN_META[meta.minPlan].badgeCls}`}>
                <Lock className="h-2.5 w-2.5" />
                Upgrade Requis — {PLAN_META[meta.minPlan].label}
              </Badge>
            )}
          </div>
        </TableCell>
        {RBAC_ROLES.map((role) => (
          <TableCell key={role.id} className="text-center">
            <div className="flex flex-col items-center gap-0.5">
              <Switch
                checked={matrix[permKey(role.id, group.id, "enabled")] ?? false}
                onCheckedChange={() => toggleEnabled(role.id, group.id)}
                disabled={blockedByPlan}
              />
              {!blockedByPlan && isDiff(role.id, group.id, "enabled") && (
                <span className="text-[9px] text-primary font-medium">Modifié</span>
              )}
            </div>
          </TableCell>
        ))}
      </TableRow>

      {/* ── Children rows ── */}
      {hasChildren && expanded && group.children.map((child) => {
        const isChildRow = true;
        return (
          <TableRow key={child.id} className={blockedByPlan ? "opacity-40" : ""}>
            <TableCell className="pl-10">
              <span className="text-sm text-muted-foreground">{child.label}</span>
            </TableCell>
            {RBAC_ROLES.map((role) => {
              const parentEnabled = matrix[permKey(role.id, group.id, "enabled")] ?? false;
              const childEnabled = matrix[permKey(role.id, child.id, "enabled")] ?? false;
              const disabled = blockedByPlan || !parentEnabled;

              return (
                <TableCell key={role.id} className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    {/* Enabled toggle */}
                    <Switch
                      checked={childEnabled}
                      onCheckedChange={() => toggleChildEnabled(role.id, child.id, group.id)}
                      disabled={disabled}
                      className="scale-90"
                    />
                    {/* Granular perms */}
                    {childEnabled && !disabled && (
                      <div className="flex gap-1.5 mt-0.5">
                        {PERM_COLS.map((col) => (
                          <label
                            key={col}
                            className="flex items-center gap-0.5 cursor-pointer"
                            title={PERM_LABELS[col]}
                          >
                            <Checkbox
                              checked={matrix[permKey(role.id, child.id, col)] ?? false}
                              onCheckedChange={() => togglePerm(role.id, child.id, col)}
                              className="h-3 w-3"
                            />
                            <span className="text-[8px] text-muted-foreground select-none">
                              {col === "can_view" ? "V" : col === "can_edit" ? "E" : "D"}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                    {!blockedByPlan && isDiff(role.id, child.id, "enabled") && (
                      <span className="text-[9px] text-primary font-medium">Modifié</span>
                    )}
                  </div>
                </TableCell>
              );
            })}
          </TableRow>
        );
      })}
    </Fragment>
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
