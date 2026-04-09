import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Plus, Pencil, Loader2, RefreshCw, Search, X, Shield,
  Trash2, MoreHorizontal, UserX, UserCheck2, Phone, UserPlus,
  Building2, Ghost, Eye, MessageSquare, MoreVertical, Download,
  UserCheck, Briefcase,
} from "lucide-react";
import { StatCards } from "@/components/shared/StatCards";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AddCollaboratorDialog } from "@/components/AddCollaboratorDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CORE_TYPES, getDefaultPoleName } from "@/config/core-types";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Types ───────────────────────────────────────────────────────────
type AppRole = "admin" | "imam_chef" | "benevole" | "responsable" | "parent" | "eleve" | "enseignant" | "super_admin";

const ASSIGNABLE_ROLES: AppRole[] = ["admin", "responsable", "enseignant", "benevole", "parent"];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin Mosquée",
  super_admin: "Super Admin",
  imam_chef: "Imam / Chef",
  responsable: "Responsable",
  benevole: "Bénévole",
  parent: "Parent d'élève",
  eleve: "Élève",
  enseignant: "Enseignant / Oustaz",
};
const ROLE_STYLES: Record<string, string> = {
  admin: "bg-primary/10 text-primary border-primary/20",
  super_admin: "bg-primary/10 text-primary border-primary/20",
  imam_chef: "bg-accent/10 text-accent border-accent/20",
  responsable: "bg-accent/10 text-accent border-accent/20",
  benevole: "bg-muted text-muted-foreground border-border",
  parent: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  eleve: "bg-amber-500/10 text-amber-700 border-amber-500/20",
};

const PROFILE_TAGS = ["Fidèle", "Donateur", "Parent", "Élève"] as const;
type ProfileTag = typeof PROFILE_TAGS[number];
const TAG_STYLES: Record<ProfileTag, string> = {
  "Fidèle": "bg-primary/10 text-primary border-primary/20",
  "Donateur": "bg-green-500/10 text-green-700 border-green-500/20",
  "Parent": "bg-blue-500/10 text-blue-700 border-blue-500/20",
  "Élève": "bg-amber-500/10 text-amber-700 border-amber-500/20",
};

interface PoleRow {
  id: string; nom: string; core_type: string | null; description: string | null;
  responsable_id: string | null; responsable_name: string | null;
  manager_id: string | null; manager_name: string | null;
  target_staff: number; member_count: number;
}

interface MemberRow {
  user_id: string; profile_id: string; display_name: string;
  email: string | null; phone: string | null; competences: string[] | null;
  tags: string[]; pole_id: string | null; pole_nom: string | null;
  roles: string[]; role_row_ids: string[];
  is_active: boolean; has_account: boolean;
}

// ─── Component ───────────────────────────────────────────────────────
export default function StructureMembresPage() {
  const { toast } = useToast();
  const { user: currentUser, dbRole, dbRoles, startImpersonating } = useAuth();
  const navigate = useNavigate();
  const isAdmin = dbRole === "admin" || dbRole === "super_admin";
  const isSuperAdmin = dbRoles.includes("super_admin");

  const [loading, setLoading] = useState(true);
  const [poles, setPoles] = useState<PoleRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [polesRaw, setPolesRaw] = useState<{ id: string; nom: string }[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("organigramme");

  // Pole dialog
  const [poleDialogOpen, setPoleDialogOpen] = useState(false);
  const [editingPole, setEditingPole] = useState<PoleRow | null>(null);
  const [poleForm, setPoleForm] = useState({ nom: "", description: "", manager_id: "none", target_staff: 0, core_type: "" });
  const [poleSaving, setPoleSaving] = useState(false);

  // Member edit dialog
  const [editMember, setEditMember] = useState<MemberRow | null>(null);
  const [memberForm, setMemberForm] = useState({ name: "", email: "", phone: "", roles: ["benevole"] as string[], pole_id: "none", competences: "", tags: [] as string[] });
  const [memberSaving, setMemberSaving] = useState(false);

  // Add collaborator dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Action modals
  const [deactivateTarget, setDeactivateTarget] = useState<MemberRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MemberRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ─── Fetch ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: polesData } = await supabase.from("poles").select("id, nom, core_type, description, responsable_id, manager_id, target_staff").order("nom");
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, email, phone, competences, pole_id, id, is_active, has_account, tags").order("display_name");
      const { data: roles } = await supabase.from("user_roles").select("id, user_id, role");

      const roleMap = new Map<string, { roles: string[]; ids: string[] }>();
      for (const r of (roles || [])) {
        const existing = roleMap.get(r.user_id);
        if (existing) { existing.roles.push(r.role as string); existing.ids.push(r.id); }
        else { roleMap.set(r.user_id, { roles: [r.role as string], ids: [r.id] }); }
      }
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      const poleMap = new Map((polesData || []).map((p: any) => [p.id, p.nom]));

      const enrichedPoles: PoleRow[] = (polesData || []).map((p: any) => {
        const memberCount = (profiles || []).filter((pr: any) => pr.pole_id === p.id).length;
        const resp = p.responsable_id ? profileMap.get(p.responsable_id) : null;
        const mgr = p.manager_id ? profileMap.get(p.manager_id) : null;
        return {
          id: p.id, nom: p.nom, core_type: p.core_type ?? null, description: p.description,
          responsable_id: p.responsable_id, responsable_name: resp?.display_name || null,
          manager_id: p.manager_id || null, manager_name: mgr?.display_name || null,
          target_staff: p.target_staff ?? 0, member_count: memberCount,
        };
      });
      setPoles(enrichedPoles);
      setPolesRaw((polesData || []).map((p: any) => ({ id: p.id, nom: p.nom })));

      const enrichedMembers: MemberRow[] = (profiles || []).map((p: any) => {
        const userRoles = roleMap.get(p.user_id);
        return {
          user_id: p.user_id, profile_id: p.id, display_name: p.display_name,
          email: p.email, phone: p.phone || null, competences: p.competences,
          tags: p.tags ?? [], pole_id: p.pole_id, pole_nom: p.pole_id ? poleMap.get(p.pole_id) || null : null,
          roles: userRoles?.roles ?? ["benevole"], role_row_ids: userRoles?.ids ?? [],
          is_active: p.is_active !== false, has_account: p.has_account === true,
        };
      });
      setMembers(enrichedMembers);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Pole CRUD ─────────────────────────────────────────────────────
  const openAddPole = () => {
    setEditingPole(null);
    setPoleForm({ nom: "", description: "", manager_id: "none", target_staff: 0, core_type: "" });
    setPoleDialogOpen(true);
  };
  const openEditPole = (p: PoleRow) => {
    setEditingPole(p);
    setPoleForm({ nom: p.nom, description: p.description || "", manager_id: p.manager_id || "none", target_staff: p.target_staff, core_type: p.core_type || "" });
    setPoleDialogOpen(true);
  };
  const handleDeletePole = async (p: PoleRow) => {
    if (p.member_count > 0) {
      toast({ title: "Suppression impossible", description: `${p.member_count} membre(s) rattachés.`, variant: "destructive" });
      return;
    }
    await supabase.from("poles").delete().eq("id", p.id);
    toast({ title: "Pôle supprimé" });
    fetchAll();
  };
  const handleSavePole = async () => {
    if (!poleForm.nom.trim()) return;
    setPoleSaving(true);
    try {
      const payload: any = { nom: poleForm.nom, core_type: poleForm.core_type || null, description: poleForm.description || null, manager_id: poleForm.manager_id === "none" ? null : poleForm.manager_id, target_staff: poleForm.target_staff };
      if (editingPole) await supabase.from("poles").update(payload).eq("id", editingPole.id);
      else await supabase.from("poles").insert(payload);
      setPoleDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally { setPoleSaving(false); }
  };

  // ─── Member Edit ───────────────────────────────────────────────────
  const openEditMember = (m: MemberRow) => {
    setEditMember(m);
    setMemberForm({ name: m.display_name, email: m.email || "", phone: m.phone || "", roles: [...m.roles], pole_id: m.pole_id || "none", competences: (m.competences || []).join(", "), tags: m.tags ?? [] });
  };
  const handleSaveMember = async () => {
    if (!editMember) return;
    setMemberSaving(true);
    try {
      const competencesArr = memberForm.competences.split(",").map((c) => c.trim()).filter(Boolean);
      await supabase.from("profiles").update({
        display_name: memberForm.name, email: memberForm.email.trim() || null,
        phone: memberForm.phone.trim() || null, competences: competencesArr,
        tags: memberForm.tags, pole_id: memberForm.pole_id === "none" ? null : memberForm.pole_id,
      } as any).eq("user_id", editMember.user_id);

      const oldRoles = new Set(editMember.roles);
      const newRoles = new Set(memberForm.roles);
      const rolesChanged = oldRoles.size !== newRoles.size || [...oldRoles].some((r) => !newRoles.has(r));
      if (rolesChanged) {
        await supabase.from("user_roles").delete().eq("user_id", editMember.user_id);
        if (memberForm.roles.length > 0) {
          await supabase.from("user_roles").insert(memberForm.roles.map((r) => ({ user_id: editMember.user_id, role: r as any })));
        }
      }
      setEditMember(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally { setMemberSaving(false); }
  };

  // ─── Deactivate / Delete ───────────────────────────────────────────
  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setActionLoading(true);
    try {
      const res = await supabase.functions.invoke("manage-member", { body: { action: "deactivate", target_user_id: deactivateTarget.user_id } });
      if (res.error) throw new Error(res.error.message);
      setDeactivateTarget(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally { setActionLoading(false); }
  };
  const handleReactivate = async (m: MemberRow) => {
    const res = await supabase.functions.invoke("manage-member", { body: { action: "reactivate", target_user_id: m.user_id } });
    if (res.error) toast({ title: "Erreur", description: res.error.message, variant: "destructive" });
    else fetchAll();
  };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const res = await supabase.functions.invoke("manage-member", { body: { action: "delete", target_user_id: deleteTarget.user_id } });
      if (res.error) throw new Error(res.error.message);
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally { setActionLoading(false); }
  };

  const isSelf = (m: MemberRow) => m.user_id === currentUser?.id;
  const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const [filterRole, setFilterRole] = useState("all");
  const [filterPole, setFilterPole] = useState("all");

  const filtered = useMemo(() => members.filter((m) => {
    const q = search.toLowerCase();
    if (q && !m.display_name.toLowerCase().includes(q) && !(m.email || "").toLowerCase().includes(q) && !(m.pole_nom || "").toLowerCase().includes(q)) return false;
    if (filterRole !== "all" && !m.roles.includes(filterRole)) return false;
    if (filterPole !== "all" && m.pole_id !== filterPole) return false;
    return true;
  }), [members, search, filterRole, filterPole]);

  const activeMembers = members.filter(m => m.is_active).length;
  const withAccount = members.filter(m => m.has_account).length;
  const roleDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    members.forEach(m => m.roles.forEach(r => { map[r] = (map[r] ?? 0) + 1; }));
    return map;
  }, [members]);

  const handleExportMembers = () => {
    const header = "Nom,Email,Téléphone,Rôle(s),Pôle,Tags,Statut";
    const rows = filtered.map(m =>
      `"${m.display_name}","${m.email ?? ""}","${m.phone ?? ""}","${m.roles.join(", ")}","${m.pole_nom ?? ""}","${(m.tags ?? []).join(", ")}","${m.is_active ? "Actif" : "Inactif"}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "annuaire.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <TooltipProvider>
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <Users className="h-5 w-5 text-primary" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">Ressources Humaines</h1>
            <p className="text-sm text-muted-foreground">{poles.length} pôles · {members.length} collaborateurs</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {isAdmin && (
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAddDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-1" /> Ajouter un collaborateur
              </Button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <StatCards items={[
          { label: "Total Membres", value: loading ? "—" : members.length, icon: Users, subValue: `${filtered.length} affiché(s)` },
          { label: "Membres Actifs", value: loading ? "—" : activeMembers, icon: UserCheck, subValue: `${members.length - activeMembers} inactif(s)` },
          { label: "Avec Compte", value: loading ? "—" : withAccount, icon: Shield, subValue: `${members.length - withAccount} hors-ligne` },
          { label: "Pôles", value: loading ? "—" : poles.length, icon: Building2, subValue: `${Object.keys(roleDistribution).length} rôle(s) distinct(s)` },
        ]} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" />

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="organigramme" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Organigramme</TabsTrigger>
              <TabsTrigger value="annuaire" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Annuaire</TabsTrigger>
            </TabsList>

            {/* ── ORGANIGRAMME ── */}
            <TabsContent value="organigramme" className="space-y-4 mt-4">
              <div className="flex justify-end">
                {isAdmin && <Button size="sm" onClick={openAddPole}><Plus className="h-4 w-4 mr-1" /> Ajouter un pôle</Button>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {poles.map((p) => {
                  const pct = p.target_staff > 0 ? Math.min(100, Math.round((p.member_count / p.target_staff) * 100)) : 0;
                  return (
                    <Card key={p.id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-foreground">{p.nom}</h3>
                          {isAdmin && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPole(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeletePole(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          )}
                        </div>
                        {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Responsable : <span className="font-medium text-foreground">{p.manager_name || p.responsable_name || "—"}</span></p>
                          <div className="flex items-center gap-2">
                            <span>{p.member_count}/{p.target_staff || "∞"}</span>
                            <Progress value={pct} className="h-1.5 flex-1" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {/* ── ANNUAIRE ── */}
            <TabsContent value="annuaire" className="space-y-4 mt-4">
              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher par nom, email ou pôle…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
                  {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
                </div>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm"><SelectValue placeholder="Rôle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les rôles</SelectItem>
                    {ASSIGNABLE_ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r] ?? r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterPole} onValueChange={setFilterPole}>
                  <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm"><SelectValue placeholder="Pôle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les pôles</SelectItem>
                    {polesRaw.map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={handleExportMembers} className="shrink-0">
                  <Download className="h-4 w-4 mr-1" /> Exporter
                </Button>
              </div>

              {filtered.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={members.length === 0 ? "Aucun collaborateur enregistré" : "Aucun membre ne correspond à vos filtres"}
                  description={members.length === 0 ? "Cliquez sur « Ajouter un collaborateur » pour commencer." : "Essayez d'élargir vos critères de recherche."}
                />
              ) : (
                <div className="rounded-lg border overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow className="bg-muted/40">
                        <TableHead className="text-xs uppercase text-muted-foreground">Membre</TableHead>
                        <TableHead className="text-xs uppercase text-muted-foreground">Rôle</TableHead>
                        <TableHead className="hidden md:table-cell text-xs uppercase text-muted-foreground">Pôle</TableHead>
                        <TableHead className="hidden lg:table-cell text-xs uppercase text-muted-foreground">Tags</TableHead>
                        <TableHead className="hidden xl:table-cell text-xs uppercase text-muted-foreground">Contact</TableHead>
                        <TableHead className="text-xs uppercase text-muted-foreground">Statut</TableHead>
                        <TableHead className="text-right w-[130px] text-xs uppercase text-muted-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((m) => (
                        <TableRow key={m.user_id} className={`cursor-pointer hover:bg-muted/40 border-b ${!m.is_active ? "opacity-50" : ""}`}>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 bg-primary/10 text-primary shrink-0">
                                <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">{initials(m.display_name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <span className="font-semibold text-sm">{m.display_name}</span>
                                <p className="text-xs text-muted-foreground">{m.email || "—"}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex flex-wrap gap-1">
                              {m.roles.map((r) => (
                                <Badge key={r} variant="outline" className={`text-[10px] ${ROLE_STYLES[r] || ROLE_STYLES.benevole}`}>
                                  {ROLE_LABELS[r] || r}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell py-3 text-sm text-muted-foreground">{m.pole_nom || "—"}</TableCell>
                          <TableCell className="hidden lg:table-cell py-3">
                            <div className="flex flex-wrap gap-1">
                              {(m.tags ?? []).map((t) => (
                                <Badge key={t} variant="outline" className={`text-[10px] ${TAG_STYLES[t as ProfileTag] || ""}`}>{t}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell py-3 text-xs text-muted-foreground">{m.phone || "—"}</TableCell>
                          <TableCell className="py-3">
                            <Badge className={m.is_active
                              ? m.has_account
                                ? "bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30 text-[10px]"
                                : "bg-amber-100 text-amber-700 border-amber-300 text-[10px]"
                              : "bg-destructive/15 text-destructive border-destructive/30 text-[10px]"
                            }>
                              {!m.is_active ? "Inactif" : m.has_account ? "Actif" : "Hors-ligne"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Tooltip><TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEditMember(m)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger><TooltipContent>Consulter</TooltipContent></Tooltip>
                              {isAdmin && (
                                <>
                                  <Tooltip><TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEditMember(m)}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger><TooltipContent>Modifier</TooltipContent></Tooltip>
                                  <Tooltip><TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => {
                                      if (m.phone) {
                                        const cleaned = m.phone.replace(/\s+/g, "").replace(/^0/, "33");
                                        window.open(`https://wa.me/${cleaned}`, "_blank");
                                      } else if (m.email) {
                                        window.open(`mailto:${m.email}`);
                                      } else {
                                        import("sonner").then(s => s.toast.error("Aucun contact disponible"));
                                      }
                                    }}>
                                      <MessageSquare className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger><TooltipContent>Contacter</TooltipContent></Tooltip>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"><MoreVertical className="h-3.5 w-3.5" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                      <DropdownMenuItem onClick={() => openEditMember(m)}><Shield className="h-3.5 w-3.5 mr-2" /> Gérer les accès</DropdownMenuItem>
                                      {isSuperAdmin && !isSelf(m) && (
                                        <DropdownMenuItem onClick={() => { startImpersonating({ id: m.user_id, name: m.display_name, roles: m.roles }); navigate("/"); }}>
                                          <Ghost className="h-3.5 w-3.5 mr-2" /> Se connecter en tant que
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuSeparator />
                                      {m.is_active ? (
                                        <DropdownMenuItem onClick={() => setDeactivateTarget(m)} disabled={isSelf(m)}><UserX className="h-3.5 w-3.5 mr-2" /> Désactiver</DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem onClick={() => handleReactivate(m)}><UserCheck2 className="h-3.5 w-3.5 mr-2" /> Réactiver</DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(m)} disabled={isSelf(m)}><Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* ── Pole Dialog ── */}
      <Dialog open={poleDialogOpen} onOpenChange={setPoleDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingPole ? "Modifier le pôle" : "Nouveau pôle"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type technique</Label>
              <Select value={poleForm.core_type || "custom"} onValueChange={(v) => {
                const ct = v === "custom" ? "" : v;
                const autoName = ct ? getDefaultPoleName(ct) : poleForm.nom;
                setPoleForm({ ...poleForm, core_type: ct, nom: poleForm.nom || autoName });
              }}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Personnalisé</SelectItem>
                  {CORE_TYPES.map((ct) => <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nom affiché</Label><Input value={poleForm.nom} onChange={(e) => setPoleForm({ ...poleForm, nom: e.target.value })} placeholder="Ex: Madrassa, Trésorerie…" /></div>
            <div><Label>Description</Label><Textarea value={poleForm.description} onChange={(e) => setPoleForm({ ...poleForm, description: e.target.value })} rows={2} /></div>
            <div><Label>Responsable</Label>
              <Select value={poleForm.manager_id} onValueChange={(v) => setPoleForm({ ...poleForm, manager_id: v })}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {members.filter((m) => m.is_active).map((m) => <SelectItem key={m.profile_id} value={m.profile_id}>{m.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Effectif cible</Label><Input type="number" value={poleForm.target_staff} onChange={(e) => setPoleForm({ ...poleForm, target_staff: parseInt(e.target.value) || 0 })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPoleDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSavePole} disabled={poleSaving}>{poleSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Member Edit Dialog ── */}
      <Dialog open={!!editMember} onOpenChange={() => setEditMember(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier — {editMember?.display_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom</Label><Input value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} /></div>
            <div><Label>Téléphone</Label><Input value={memberForm.phone} onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })} /></div>
            <div><Label>Rôles</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ASSIGNABLE_ROLES.map((r) => (
                  <Badge key={r} variant="outline"
                    className={`cursor-pointer text-xs ${memberForm.roles.includes(r) ? (ROLE_STYLES[r] || ROLE_STYLES.benevole) : "opacity-40"}`}
                    onClick={() => setMemberForm((f) => ({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] }))}
                  >
                    {ROLE_LABELS[r] || r}
                  </Badge>
                ))}
              </div>
            </div>
            <div><Label>Pôle</Label>
              <Select value={memberForm.pole_id} onValueChange={(v) => setMemberForm({ ...memberForm, pole_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {polesRaw.map((p) => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Compétences</Label><Input value={memberForm.competences} onChange={(e) => setMemberForm({ ...memberForm, competences: e.target.value })} placeholder="Séparées par des virgules" /></div>
            <div>
              <Label>Tags Profil</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {PROFILE_TAGS.map((t) => (
                  <Badge key={t} variant="outline"
                    className={`cursor-pointer ${memberForm.tags.includes(t) ? TAG_STYLES[t] : "opacity-40"}`}
                    onClick={() => setMemberForm((f) => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t] }))}
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMember(null)}>Annuler</Button>
            <Button onClick={handleSaveMember} disabled={memberSaving}>{memberSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Deactivate Confirm ── */}
      <Dialog open={!!deactivateTarget} onOpenChange={() => setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Désactiver ce compte ?</DialogTitle><DialogDescription>{deactivateTarget?.display_name} ne pourra plus se connecter.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={actionLoading}>{actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Désactiver"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer définitivement ?</DialogTitle><DialogDescription>Cette action est irréversible pour {deleteTarget?.display_name}.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={actionLoading}>{actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Supprimer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Smart Add Collaborator Dialog ── */}
      <AddCollaboratorDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} poles={polesRaw} onSuccess={fetchAll} />
    </main>
    </TooltipProvider>
  );
}
