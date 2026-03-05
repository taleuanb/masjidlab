import { useState, useEffect, useCallback, Fragment } from "react";
import {
  Building2, Users, Globe, Loader2, RefreshCw, Check, Shield, Save,
  ChevronDown, ChevronRight, Lock, Clock, Mail, MapPin, CalendarDays,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
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
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Navigate } from "react-router-dom";
import { MODULE_REGISTRY, PLAN_META, type PlanId } from "@/config/module-registry";
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
  city: string | null;
  active_poles: string[];
  subscription_plan: string | null;
  chosen_plan: string | null;
  status: string | null;
  member_count: number;
  owner_email: string | null;
  created_at: string | null;
}

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  pending:   { cls: "bg-amber-500/10 text-amber-600 border-amber-400/30", label: "En attente" },
  active:    { cls: "bg-green-500/10 text-green-700 border-green-400/30", label: "Active" },
  suspended: { cls: "bg-destructive/10 text-destructive border-destructive/30", label: "Suspendue" },
};

// ── Pending Approvals Tab ──────────────────────────────────
function PendingApprovalsTab({
  orgs, loading, onValidate, validatingId,
}: {
  orgs: OrgRow[];
  loading: boolean;
  onValidate: (o: OrgRow) => void;
  validatingId: string | null;
}) {
  const pendingOrgs = orgs.filter((o) => o.status === "pending");

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (pendingOrgs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 mb-4">
            <Check className="h-7 w-7 text-green-600" />
          </div>
          <h3 className="text-base font-semibold">Aucune demande en attente</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Toutes les mosquées ont été traitées.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          {pendingOrgs.length} demande{pendingOrgs.length > 1 ? "s" : ""} en attente
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mosquée</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Responsable (Email)</TableHead>
              <TableHead>Plan choisi</TableHead>
              <TableHead>Date d'inscription</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingOrgs.map((o) => {
              const plan = (o.chosen_plan ?? "starter") as PlanId;
              const planMeta = PLAN_META[plan] ?? PLAN_META.starter;
              const isValidating = validatingId === o.id;

              return (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      {o.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {o.city ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-sm truncate max-w-[200px]">{o.owner_email ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize text-[10px] ${planMeta.badgeCls}`}>
                      {planMeta.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      {o.created_at
                        ? format(new Date(o.created_at), "dd MMM yyyy", { locale: fr })
                        : "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() => onValidate(o)}
                      disabled={isValidating}
                      className="gap-1.5"
                    >
                      {isValidating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      {isValidating ? "Activation…" : "Valider la Mosquée"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Dashboard Tab ──────────────────────────────────────────
function DashboardTab({
  orgs, totalUsers, loading, fetchAll, openModules, onValidate,
}: {
  orgs: OrgRow[];
  totalUsers: number;
  loading: boolean;
  fetchAll: () => void;
  openModules: (o: OrgRow) => void;
  onValidate: (o: OrgRow) => void;
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
                  <TableHead>Statut</TableHead>
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
                      {(() => {
                        const s = STATUS_BADGE[o.status ?? "active"] ?? STATUS_BADGE.active;
                        return (
                          <Badge variant="outline" className={`text-[10px] ${s.cls}`}>
                            {s.label}
                          </Badge>
                        );
                      })()}
                    </TableCell>
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
                      <div className="flex gap-1.5 justify-end">
                        {(o.status === "pending" || !o.status) && o.status !== "active" && (
                          <Button size="sm" variant="default" onClick={() => onValidate(o)} className="gap-1">
                            <Check className="h-3.5 w-3.5" />
                            Valider
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openModules(o)}>
                          Modules
                        </Button>
                      </div>
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

function PermissionsTab() {
  const { toast } = useToast();

  const [matrix, setMatrix] = useState<PermMatrix>(buildEmptyMatrix);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  // ── Load global permissions from DB (org_id IS NULL) ──
  const loadMatrix = useCallback(async (): Promise<PermMatrix> => {
    const m = buildEmptyMatrix();
    const { data, error } = await supabase
      .from("role_permissions" as any)
      .select("role, module, enabled, can_view, can_edit, can_delete")
      .is("org_id", null);

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

  // Load on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const m = await loadMatrix();
        setMatrix(m);
      } catch (err: any) {
        toast({ title: "Erreur", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [loadMatrix, toast]);

  // ── Toggle logic ──
  const toggleEnabled = (roleId: string, groupId: string) => {
    setMatrix((prev) => {
      const next = { ...prev };
      const k = permKey(roleId, groupId, "enabled");
      const newVal = !next[k];
      next[k] = newVal;

      const group = RBAC_MODULE_HIERARCHY.find((g) => g.id === groupId);
      if (group && !newVal) {
        for (const child of group.children) {
          next[permKey(roleId, child.id, "enabled")] = false;
          for (const col of PERM_COLS) {
            next[permKey(roleId, child.id, col)] = false;
          }
        }
      }
      if (newVal) {
        const parentGroup = RBAC_MODULE_HIERARCHY.find((g) => g.children.some((c) => c.id === groupId));
        if (parentGroup) {
          next[permKey(roleId, parentGroup.id, "enabled")] = true;
        }
      }
      next[permKey(roleId, groupId, "can_view")] = newVal;
      return next;
    });
  };

  const toggleChildEnabled = (roleId: string, childId: string, parentId: string) => {
    setMatrix((prev) => {
      const next = { ...prev };
      const k = permKey(roleId, childId, "enabled");
      const newVal = !next[k];
      next[k] = newVal;
      next[permKey(roleId, childId, "can_view")] = newVal;

      if (newVal) {
        next[permKey(roleId, parentId, "enabled")] = true;
        next[permKey(roleId, parentId, "can_view")] = true;
      }
      if (!newVal) {
        for (const col of PERM_COLS) {
          next[permKey(roleId, childId, col)] = false;
        }
      }
      return next;
    });
  };

  const togglePerm = (roleId: string, modId: string, col: PermCol) => {
    setMatrix((prev) => {
      const next = { ...prev };
      next[permKey(roleId, modId, col)] = !next[permKey(roleId, modId, col)];
      return next;
    });
  };

  // ── Save (always org_id = NULL) ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const allIds = getAllRbacModuleIds();
      const rows: any[] = [];
      for (const role of RBAC_ROLES) {
        for (const modId of allIds) {
          const parentOfChild = RBAC_MODULE_HIERARCHY.find((g) => g.children.some((c) => c.id === modId));
          rows.push({
            org_id: null,
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

      toast({
        title: "Configuration sauvegardée",
        description: "Les permissions globales ont été mises à jour pour tous les utilisateurs.",
      });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Reset: rebuild from MODULE_REGISTRY defaults ──
  const handleReset = async () => {
    setResetting(true);
    try {
      // Delete all global rows
      const { error: delErr } = await supabase
        .from("role_permissions" as any)
        .delete()
        .is("org_id", null);
      if (delErr) throw delErr;

      // Re-insert from registry defaults
      const allIds = getAllRbacModuleIds();
      const rows: any[] = [];
      for (const role of RBAC_ROLES) {
        for (const modId of allIds) {
          const parentOfChild = RBAC_MODULE_HIERARCHY.find((g) => g.children.some((c) => c.id === modId));
          // Default: admin gets everything enabled, others disabled
          const isAdmin = role.id === "admin";
          rows.push({
            org_id: null,
            role: role.id,
            module: modId,
            parent_key: parentOfChild ? parentOfChild.id : null,
            enabled: isAdmin,
            can_view: isAdmin,
            can_edit: isAdmin,
            can_delete: isAdmin,
          });
        }
      }
      const { error } = await supabase
        .from("role_permissions" as any)
        .upsert(rows, { onConflict: "org_id,role,module" });
      if (error) throw error;

      // Reload
      const m = await loadMatrix();
      setMatrix(m);
      toast({ title: "Réinitialisation effectuée", description: "Les permissions globales ont été recréées depuis le registre." });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  const categories = ["metiers", "logistique", "personnel"] as const;

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">
                Matrice des permissions globales
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Configuration unique appliquée à toutes les organisations (org_id = NULL).
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleReset} disabled={resetting}>
                {resetting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Réinitialiser
              </Button>
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Sauvegarder
              </Button>
            </div>
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
  group, matrix,
  toggleEnabled, toggleChildEnabled, togglePerm,
}: {
  group: RbacModuleGroup;
  matrix: PermMatrix;
  toggleEnabled: (roleId: string, groupId: string) => void;
  toggleChildEnabled: (roleId: string, childId: string, parentId: string) => void;
  togglePerm: (roleId: string, modId: string, col: PermCol) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const meta = getRegistryMeta(group.id);
  const hasChildren = group.children.length > 0;

  return (
    <Fragment>
      {/* ── Parent row ── */}
      <TableRow className="bg-muted/20">
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
          </div>
        </TableCell>
        {RBAC_ROLES.map((role) => (
          <TableCell key={role.id} className="text-center">
            <Switch
              checked={matrix[permKey(role.id, group.id, "enabled")] ?? false}
              onCheckedChange={() => toggleEnabled(role.id, group.id)}
            />
          </TableCell>
        ))}
      </TableRow>

      {/* ── Children rows ── */}
      {hasChildren && expanded && group.children.map((child) => (
        <TableRow key={child.id}>
          <TableCell className="pl-10">
            <span className="text-sm text-muted-foreground">{child.label}</span>
          </TableCell>
          {RBAC_ROLES.map((role) => {
            const parentEnabled = matrix[permKey(role.id, group.id, "enabled")] ?? false;
            const childEnabled = matrix[permKey(role.id, child.id, "enabled")] ?? false;
            const disabled = !parentEnabled;

            return (
              <TableCell key={role.id} className="text-center">
                <div className="flex flex-col items-center gap-1">
                  <Switch
                    checked={childEnabled}
                    onCheckedChange={() => toggleChildEnabled(role.id, child.id, group.id)}
                    disabled={disabled}
                    className="scale-90"
                  />
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
                </div>
              </TableCell>
            );
          })}
        </TableRow>
      ))}
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
  const [validatingId, setValidatingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: orgsData } = await supabase.rpc("get_all_organizations");
      const { data: profiles } = await supabase.from("profiles").select("org_id, email, user_id");

      const orgCounts = new Map<string, number>();
      const ownerEmails = new Map<string, string>();
      (profiles ?? []).forEach((p: any) => {
        if (p.org_id) orgCounts.set(p.org_id, (orgCounts.get(p.org_id) ?? 0) + 1);
      });

      // Map owner_id → email
      for (const o of (orgsData ?? []) as any[]) {
        if (o.owner_id) {
          const ownerProfile = (profiles ?? []).find((p: any) => p.user_id === o.owner_id);
          if (ownerProfile) ownerEmails.set(o.id, (ownerProfile as any).email ?? null);
        }
      }

      const rows: OrgRow[] = (orgsData ?? []).map((o: any) => ({
        id: o.id,
        name: o.name,
        city: o.city ?? null,
        active_poles: o.active_poles ?? [],
        subscription_plan: o.subscription_plan,
        chosen_plan: o.chosen_plan ?? o.subscription_plan,
        status: o.status ?? "active",
        member_count: orgCounts.get(o.id) ?? 0,
        owner_email: ownerEmails.get(o.id) ?? null,
        created_at: o.created_at ?? null,
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

  const handleValidateOrg = async (o: OrgRow) => {
    setValidatingId(o.id);
    try {
      const plan = (o.chosen_plan ?? o.subscription_plan ?? "starter") as PlanId;
      const { PLAN_FEATURE_MAPPING } = await import("@/config/module-registry");
      const planModules = PLAN_FEATURE_MAPPING[plan] ?? PLAN_FEATURE_MAPPING.starter;
      const businessModuleIds = planModules.filter(
        (id: string) => !MODULE_REGISTRY.find((m) => m.id === id)?.isCore
      );

      // 1. Set status to active + subscription_plan from chosen_plan + activate modules
      const { error } = await supabase
        .from("organizations")
        .update({
          status: "active",
          subscription_plan: plan,
          active_poles: businessModuleIds,
        } as any)
        .eq("id", o.id);
      if (error) throw error;

      const planLabel = PLAN_META[plan]?.label ?? plan;
      toast({
        title: "Mosquée activée ✅",
        description: `${o.name} est maintenant active — modules provisionnés pour le plan ${planLabel}.`,
      });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setValidatingId(null);
    }
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

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Demandes en attente
              {orgs.filter((o) => o.status === "pending").length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px]">
                  {orgs.filter((o) => o.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="permissions">Permissions & RBAC</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <PendingApprovalsTab
              orgs={orgs}
              loading={loading}
              onValidate={handleValidateOrg}
              validatingId={validatingId}
            />
          </TabsContent>

          <TabsContent value="dashboard">
            <DashboardTab
              orgs={orgs}
              totalUsers={totalUsers}
              loading={loading}
              fetchAll={fetchAll}
              openModules={openModules}
              onValidate={handleValidateOrg}
            />
          </TabsContent>

          <TabsContent value="permissions">
            <PermissionsTab />
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
