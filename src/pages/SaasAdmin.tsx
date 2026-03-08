import { useState, useEffect, useCallback, Fragment, useMemo } from "react";
import {
  Building2, Users, Globe, Loader2, RefreshCw, Check, Shield, Save,
  ChevronDown, ChevronRight, Lock, Clock, Mail, MapPin, CalendarDays,
  MoreHorizontal, Search, UserCog, KeyRound, Ban, LayoutDashboard, Crown,
  UserPlus, TrendingUp, Activity, Settings2, Eye, ShieldOff, RotateCcw,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useRole, DB_ROLE_TO_UI } from "@/contexts/RoleContext";
import { useToast } from "@/hooks/use-toast";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Navigate, useNavigate } from "react-router-dom";
import { MODULE_REGISTRY, PLAN_META, type PlanId } from "@/config/module-registry";
import {
  RBAC_MODULE_HIERARCHY, getAllRbacModuleIds, getRegistryMeta,
  CATEGORY_LABELS, type RbacModuleGroup,
} from "@/config/rbac-modules";
import { DEFAULT_RBAC_MATRIX, getDefaultPermission } from "@/config/default-rbac";

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
  postal_code: string | null;
  active_poles: string[];
  subscription_plan: string | null;
  chosen_plan: string | null;
  status: string | null;
  member_count: number;
  owner_id: string | null;
  owner_email: string | null;
  created_at: string | null;
}

const PLAN_BADGE: Record<string, string> = {
  starter: "bg-muted text-muted-foreground border-border",
  pro: "bg-blue-500/10 text-blue-700 border-blue-400/30",
  elite: "bg-amber-500/10 text-amber-700 border-amber-400/30",
};

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  pending:   { cls: "bg-amber-500/10 text-amber-600 border-amber-400/30", label: "En attente" },
  active:    { cls: "bg-green-500/10 text-green-700 border-green-400/30", label: "Active" },
  suspended: { cls: "bg-destructive/10 text-destructive border-destructive/30", label: "Suspendue" },
};

const ROLE_BADGE: Record<string, string> = {
  super_admin: "bg-purple-500/10 text-purple-700 border-purple-400/30",
  admin: "bg-primary/10 text-primary border-primary/30",
  responsable: "bg-blue-500/10 text-blue-700 border-blue-400/30",
  enseignant: "bg-emerald-500/10 text-emerald-700 border-emerald-400/30",
  benevole: "bg-orange-500/10 text-orange-700 border-orange-400/30",
  parent: "bg-pink-500/10 text-pink-700 border-pink-400/30",
};

// ── Global Users ──────────────────────────────────────────
interface GlobalUser {
  profile_id: string;
  user_id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  org_id: string | null;
  org_name: string | null;
  roles: string[];
  created_at: string;
}

function UsersTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);

  // Edit dialog
  const [editUser, setEditUser] = useState<GlobalUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch profiles, roles, and orgs in parallel
      const [profilesRes, rolesRes, orgsRes] = await Promise.all([
        supabase.from("profiles").select("id, user_id, display_name, email, phone, is_active, org_id, created_at"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.rpc("get_all_organizations"),
      ]);

      const profiles = profilesRes.data ?? [];
      const roles = rolesRes.data ?? [];
      const organizations = (orgsRes.data ?? []) as any[];

      const orgMap = new Map<string, string>();
      organizations.forEach((o: any) => orgMap.set(o.id, o.name));
      setOrgs(organizations.map((o: any) => ({ id: o.id, name: o.name })));

      // Group roles by user_id
      const roleMap = new Map<string, string[]>();
      roles.forEach((r: any) => {
        const list = roleMap.get(r.user_id) ?? [];
        list.push(r.role);
        roleMap.set(r.user_id, list);
      });

      const mapped: GlobalUser[] = profiles.map((p: any) => ({
        profile_id: p.id,
        user_id: p.user_id,
        display_name: p.display_name,
        email: p.email,
        phone: p.phone,
        is_active: p.is_active,
        org_id: p.org_id,
        org_name: p.org_id ? (orgMap.get(p.org_id) ?? "—") : null,
        roles: roleMap.get(p.user_id) ?? [],
        created_at: p.created_at,
      }));

      setUsers(mapped);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || 
      u.display_name.toLowerCase().includes(q) || 
      (u.email?.toLowerCase().includes(q) ?? false);
    const matchesOrg = orgFilter === "all" || u.org_id === orgFilter;
    return matchesSearch && matchesOrg;
  });

  const openEdit = (u: GlobalUser) => {
    setEditUser(u);
    setEditName(u.display_name);
    setEditPhone(u.phone ?? "");
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: editName, phone: editPhone || null })
        .eq("id", editUser.profile_id);
      if (error) throw error;
      toast({ title: "Profil mis à jour" });
      setEditUser(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResetPassword = async (u: GlobalUser) => {
    if (!u.email) {
      toast({ title: "Pas d'email", description: "Cet utilisateur n'a pas d'adresse email.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(u.email);
      if (error) throw error;
      toast({ title: "Email envoyé", description: `Un email de réinitialisation a été envoyé à ${u.email}.` });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const handleToggleActive = async (u: GlobalUser) => {
    try {
      const { error } = await supabase.functions.invoke("manage-member", {
        body: {
          action: u.is_active ? "deactivate" : "reactivate",
          target_user_id: u.user_id,
        },
      });
      if (error) throw error;
      toast({ title: u.is_active ? "Utilisateur désactivé" : "Utilisateur réactivé" });
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
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
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              {users.length} utilisateur{users.length > 1 ? "s" : ""} inscrits
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher nom ou email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 w-[220px]"
                />
              </div>
              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue placeholder="Organisation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les orgs</SelectItem>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchUsers}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Rôle(s)</TableHead>
                <TableHead>Inscription</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucun utilisateur trouvé.
                  </TableCell>
                </TableRow>
              ) : filteredUsers.map((u) => (
                <TableRow key={u.profile_id}>
                  <TableCell className="font-medium">{u.display_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{u.email ?? "—"}</TableCell>
                  <TableCell>
                    {u.org_name ? (
                      <Badge variant="outline" className="text-[10px]">
                        {u.org_name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r} variant="outline" className={`text-[10px] ${ROLE_BADGE[r] ?? ""}`}>
                          {DB_ROLE_TO_UI[r] ?? r}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(u.created_at), "dd MMM yyyy", { locale: fr })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={u.is_active
                      ? "bg-green-500/10 text-green-700 border-green-400/30 text-[10px]"
                      : "bg-destructive/10 text-destructive border-destructive/30 text-[10px]"
                    }>
                      {u.is_active ? "Actif" : "Désactivé"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(u)}>
                          <UserCog className="h-4 w-4 mr-2" />
                          Modifier le profil
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleResetPassword(u)}>
                          <KeyRound className="h-4 w-4 mr-2" />
                          Réinitialiser le mot de passe
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleToggleActive(u)}
                          className={u.is_active ? "text-destructive" : "text-green-700"}
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          {u.is_active ? "Désactiver" : "Réactiver"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Profile Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le profil</DialogTitle>
            <DialogDescription>Modifiez les informations de {editUser?.display_name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Nom d'affichage</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Téléphone</label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+33…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Annuler</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit || !editName.trim()}>
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

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
const PLAN_COLORS: Record<string, string> = {
  starter: "hsl(220, 15%, 70%)",
  pro: "hsl(38, 92%, 50%)",
  elite: "hsl(222, 68%, 15%)",
};

function DashboardTab({
  orgs, totalUsers, activeUsers, loading, fetchAll, recentActivity,
}: {
  orgs: OrgRow[];
  totalUsers: number;
  activeUsers: number;
  loading: boolean;
  fetchAll: () => void;
  recentActivity: { type: "org" | "user"; name: string; created_at: string }[];
}) {
  const pendingCount = orgs.filter((o) => o.status === "pending").length;
  const paidCount = orgs.filter((o) => o.subscription_plan === "pro" || o.subscription_plan === "elite").length;

  const planData = useMemo(() => {
    const counts: Record<string, number> = { starter: 0, pro: 0, elite: 0 };
    orgs.forEach((o) => {
      const plan = o.subscription_plan ?? "starter";
      if (counts[plan] !== undefined) counts[plan]++;
      else counts.starter++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value,
        color: PLAN_COLORS[key] ?? PLAN_COLORS.starter,
      }));
  }, [orgs]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Institutions</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{orgs.length}</span>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-secondary font-medium">+{orgs.filter(o => {
                const d = new Date(o.created_at ?? "");
                const now = new Date();
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).length}</span> ce mois
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Utilisateurs Actifs</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
              <Users className="h-4 w-4 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{activeUsers}</span>
            <p className="text-xs text-muted-foreground mt-1">
              sur <span className="font-medium">{totalUsers}</span> inscrits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Abonnements Pro/Elite</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "hsl(38, 92%, 50%, 0.1)" }}>
              <Crown className="h-4 w-4" style={{ color: "hsl(38, 92%, 50%)" }} />
            </div>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{paidCount}</span>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-medium">{orgs.length > 0 ? Math.round((paidCount / orgs.length) * 100) : 0}%</span> du parc
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">En attente</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "hsl(38, 92%, 50%, 0.1)" }}>
              <Clock className="h-4 w-4" style={{ color: "hsl(38, 92%, 50%)" }} />
            </div>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{pendingCount}</span>
            <p className="text-xs text-muted-foreground mt-1">
              demande{pendingCount > 1 ? "s" : ""} d'onboarding
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Plan distribution chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Répartition par Plan</CardTitle>
          </CardHeader>
          <CardContent>
            {planData.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={planData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {planData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value} mosquée${value > 1 ? "s" : ""}`, name]}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                        color: "hsl(var(--card-foreground))",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2">
                  {planData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-xs text-muted-foreground">{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p>
            )}
          </CardContent>
        </Card>

        {/* Recent activity feed */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" />
              Derniers événements
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchAll} className="h-7 px-2">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[240px]">
              <div className="space-y-0">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Aucune activité récente</p>
                ) : recentActivity.map((event, i) => (
                  <div key={i} className="flex items-center gap-3 px-6 py-3 border-b last:border-0">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      event.type === "org"
                        ? "bg-primary/10"
                        : "bg-secondary/10"
                    }`}>
                      {event.type === "org" ? (
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5 text-secondary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${
                          event.type === "org"
                            ? "bg-primary/5 text-primary border-primary/20"
                            : "bg-secondary/5 text-secondary border-secondary/20"
                        }`}>
                          {event.type === "org" ? "Mosquée" : "Inscription"}
                        </Badge>
                        <span className="text-sm font-medium truncate">{event.name}</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Organizations Tab ──────────────────────────────────────
function OrganizationsTab({
  orgs, loading, fetchAll, openModules, onValidate, onSuspendToggle, onImpersonate, onResetPermissions,
}: {
  orgs: OrgRow[];
  loading: boolean;
  fetchAll: () => void;
  openModules: (o: OrgRow) => void;
  onValidate: (o: OrgRow) => void;
  onSuspendToggle: (o: OrgRow) => void;
  onImpersonate: (o: OrgRow) => void;
  onResetPermissions: (o: OrgRow) => void;
}) {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = orgs.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch = !q || o.name.toLowerCase().includes(q) || (o.city?.toLowerCase().includes(q) ?? false);
    const matchPlan = planFilter === "all" || (o.subscription_plan ?? "starter") === planFilter;
    const matchStatus = statusFilter === "all" || (o.status ?? "active") === statusFilter;
    return matchSearch && matchPlan && matchStatus;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            {orgs.length} organisation{orgs.length > 1 ? "s" : ""}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Nom ou ville…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 w-[180px]"
              />
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les plans</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="elite">Elite</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="suspended">Suspendue</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchAll} className="h-9">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mosquée</TableHead>
              <TableHead>Localisation</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Membres</TableHead>
              <TableHead>Création</TableHead>
              <TableHead className="text-right w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Aucune organisation trouvée.
                </TableCell>
              </TableRow>
            ) : filtered.map((o) => {
              const plan = o.subscription_plan ?? "starter";
              const planBadgeCls = PLAN_BADGE[plan] ?? PLAN_BADGE.starter;
              const statusInfo = STATUS_BADGE[o.status ?? "active"] ?? STATUS_BADGE.active;

              return (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    <div>
                      <span>{o.name}</span>
                      {o.owner_email && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{o.owner_email}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {o.city ? (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {o.city}{o.postal_code ? ` (${o.postal_code})` : ""}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize text-[10px] ${planBadgeCls}`}>
                      {plan}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${statusInfo.cls}`}>
                      {statusInfo.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{o.member_count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {o.created_at ? format(new Date(o.created_at), "dd MMM yyyy", { locale: fr }) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {o.status === "pending" && (
                          <DropdownMenuItem onClick={() => onValidate(o)}>
                            <Check className="h-4 w-4 mr-2" />
                            Valider la mosquée
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => openModules(o)}>
                          <Settings2 className="h-4 w-4 mr-2" />
                          Gérer Plan & Modules
                        </DropdownMenuItem>
                        {o.owner_id && (
                          <DropdownMenuItem onClick={() => onImpersonate(o)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Se connecter en tant que
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onResetPermissions(o)}>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Réinitialiser permissions
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onSuspendToggle(o)}
                          className={o.status === "suspended" ? "text-secondary" : "text-destructive"}
                        >
                          {o.status === "suspended" ? (
                            <><Check className="h-4 w-4 mr-2" /> Réactiver l'accès</>
                          ) : (
                            <><ShieldOff className="h-4 w-4 mr-2" /> Suspendre l'accès</>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

// ── Permissions Tab ────────────────────────────────────────
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

  const handleReset = () => {
    setResetting(true);
    const m = buildEmptyMatrix();
    const allIds = getAllRbacModuleIds();
    for (const role of RBAC_ROLES) {
      for (const modId of allIds) {
        const def = getDefaultPermission(role.id, modId);
        m[permKey(role.id, modId, "enabled")] = def.can_view;
        m[permKey(role.id, modId, "can_view")] = def.can_view;
        m[permKey(role.id, modId, "can_edit")] = def.can_edit;
        m[permKey(role.id, modId, "can_delete")] = def.can_delete;
      }
    }
    setMatrix(m);
    setResetting(false);
    toast({
      title: "Configuration d'usine chargée",
      description: "Prévisualisation active. Cliquez « Sauvegarder » pour appliquer.",
    });
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
              className="switch-cyan"
              checked={matrix[permKey(role.id, group.id, "enabled")] ?? false}
              onCheckedChange={() => toggleEnabled(role.id, group.id)}
            />
          </TableCell>
        ))}
      </TableRow>

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
                    className={`scale-90 switch-cyan ${disabled ? "opacity-40" : ""}`}
                    checked={childEnabled}
                    onCheckedChange={() => toggleChildEnabled(role.id, child.id, group.id)}
                    disabled={disabled}
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
  const [activeUsers, setActiveUsers] = useState(0);
  const [recentActivity, setRecentActivity] = useState<{ type: "org" | "user"; name: string; created_at: string }[]>([]);

  const [editOrg, setEditOrg] = useState<OrgRow | null>(null);
  const [editPoles, setEditPoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: orgsData } = await supabase.rpc("get_all_organizations");
      const { data: profiles } = await supabase.from("profiles").select("org_id, email, user_id, is_active, display_name, created_at");

      const orgCounts = new Map<string, number>();
      const ownerEmails = new Map<string, string>();
      (profiles ?? []).forEach((p: any) => {
        if (p.org_id) orgCounts.set(p.org_id, (orgCounts.get(p.org_id) ?? 0) + 1);
      });

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
        postal_code: o.postal_code ?? null,
        active_poles: o.active_poles ?? [],
        subscription_plan: o.subscription_plan,
        chosen_plan: o.chosen_plan ?? o.subscription_plan,
        status: o.status ?? "active",
        member_count: orgCounts.get(o.id) ?? 0,
        owner_id: o.owner_id ?? null,
        owner_email: ownerEmails.get(o.id) ?? null,
        created_at: o.created_at ?? null,
      }));
      setOrgs(rows);
      setTotalUsers((profiles ?? []).length);
      setActiveUsers((profiles ?? []).filter((p: any) => p.is_active).length);

      // Build recent activity feed (last 10 events from orgs + profiles)
      const orgEvents = (orgsData ?? []).map((o: any) => ({
        type: "org" as const,
        name: o.name,
        created_at: o.created_at ?? new Date().toISOString(),
      }));
      const userEvents = (profiles ?? []).map((p: any) => ({
        type: "user" as const,
        name: p.display_name ?? p.email ?? "Utilisateur",
        created_at: p.created_at ?? new Date().toISOString(),
      }));
      const allEvents = [...orgEvents, ...userEvents]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8);
      setRecentActivity(allEvents);
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

  const pendingCount = orgs.filter((o) => o.status === "pending").length;

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
            <p className="text-sm text-muted-foreground">Supervision globale de la plateforme MASJIDLAB</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Vue d'ensemble
            </TabsTrigger>
            <TabsTrigger value="organizations" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Organisations
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Utilisateurs
            </TabsTrigger>
            <TabsTrigger value="onboarding" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Onboarding
              {pendingCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px]">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Sécurité & RBAC
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <DashboardTab
              orgs={orgs}
              totalUsers={totalUsers}
              activeUsers={activeUsers}
              loading={loading}
              fetchAll={fetchAll}
              recentActivity={recentActivity}
            />
          </TabsContent>

          <TabsContent value="organizations">
            <OrganizationsTab
              orgs={orgs}
              loading={loading}
              fetchAll={fetchAll}
              openModules={openModules}
              onValidate={handleValidateOrg}
            />
          </TabsContent>

          <TabsContent value="users">
            <UsersTab />
          </TabsContent>

          <TabsContent value="onboarding">
            <PendingApprovalsTab
              orgs={orgs}
              loading={loading}
              onValidate={handleValidateOrg}
              validatingId={validatingId}
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
