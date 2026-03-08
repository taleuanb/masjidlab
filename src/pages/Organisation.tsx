import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Users,
  Plus,
  Pencil,
  Loader2,
  RefreshCw,
  Search,
  X,
  Shield,
  UserCheck,
  Tag,
  Trash2,
  Mail,
  MoreHorizontal,
  UserX,
  UserCheck2,
  Phone,
  PhoneCall,
  UserPlus,
  ExternalLink,
  UserCog,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


// ─── Types ───────────────────────────────────────────────────────────
type AppRole = "admin" | "imam_chef" | "benevole";

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  imam_chef: "Responsable",
  benevole: "Bénévole",
};
const ROLE_STYLES: Record<AppRole, string> = {
  admin: "bg-primary/10 text-primary border-primary/20",
  imam_chef: "bg-accent/10 text-accent border-accent/20",
  benevole: "bg-muted text-muted-foreground border-border",
};

interface PoleRow {
  id: string;
  nom: string;
  core_type: string | null;
  description: string | null;
  responsable_id: string | null;
  responsable_name: string | null;
  manager_id: string | null;
  manager_name: string | null;
  target_staff: number;
  member_count: number;
}

interface MemberRow {
  user_id: string;
  profile_id: string; // profiles.id (PK)
  display_name: string;
  email: string | null;
  phone: string | null;
  competences: string[] | null;
  pole_id: string | null;
  role: AppRole;
  role_row_id: string | null;
  is_active: boolean;
  has_account: boolean;
}

// ─── Component ───────────────────────────────────────────────────────
export default function OrganisationPage() {
  const { toast } = useToast();
  const { user: currentUser, dbRole } = useAuth();
  const isAdmin = dbRole === "admin" || dbRole === "super_admin";


  const [loading, setLoading] = useState(true);
  const [poles, setPoles] = useState<PoleRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [polesRaw, setPolesRaw] = useState<{ id: string; nom: string }[]>([]);
  const [search, setSearch] = useState("");

  // Pole dialog
  const [poleDialogOpen, setPoleDialogOpen] = useState(false);
  const [editingPole, setEditingPole] = useState<PoleRow | null>(null);
  const [poleForm, setPoleForm] = useState({ nom: "", description: "", manager_id: "none", target_staff: 0, core_type: "" });
  const [poleSaving, setPoleSaving] = useState(false);

  // Member edit dialog
  const [editMember, setEditMember] = useState<MemberRow | null>(null);
  const [memberForm, setMemberForm] = useState({ name: "", email: "", phone: "", role: "benevole" as AppRole, pole_id: "none", competences: "" });
  const [memberSaving, setMemberSaving] = useState(false);

  // Contact filter
  const [contactFilter, setContactFilter] = useState<"all" | "email" | "phone">("all");

  // Deactivate / Delete dialogs
  const [deactivateTarget, setDeactivateTarget] = useState<MemberRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MemberRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Add member dialog (dual-mode)
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"simple" | "invite">("simple");
  const [addForm, setAddForm] = useState({
    name: "", phone: "", email: "", role: "benevole" as AppRole,
    pole_id: "none", competences: "", sendInvite: false,
  });
  const [addSaving, setAddSaving] = useState(false);

  // ─── Fetch ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Poles
      const { data: polesData } = await supabase.from("poles").select("id, nom, core_type, description, responsable_id, manager_id, target_staff").order("nom");
      
      // All profiles
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, email, phone, competences, pole_id, id, is_active, has_account").order("display_name");
      
      // All roles
      const { data: roles } = await supabase.from("user_roles").select("id, user_id, role");

      const roleMap = new Map((roles || []).map((r) => [r.user_id, { role: r.role as AppRole, id: r.id }]));
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      // Build poles with counts, responsable name, manager name
      const enrichedPoles: PoleRow[] = (polesData || []).map((p: any) => {
        const memberCount = (profiles || []).filter((pr: any) => pr.pole_id === p.id).length;
        const resp = p.responsable_id ? profileMap.get(p.responsable_id) : null;
        const mgr = p.manager_id ? profileMap.get(p.manager_id) : null;
        return {
          id: p.id,
          nom: p.nom,
          core_type: p.core_type ?? null,
          description: p.description,
          responsable_id: p.responsable_id,
          responsable_name: resp?.display_name || null,
          manager_id: p.manager_id || null,
          manager_name: mgr?.display_name || null,
          target_staff: p.target_staff ?? 0,
          member_count: memberCount,
        };
      });
      setPoles(enrichedPoles);
      setPolesRaw((polesData || []).map((p: any) => ({ id: p.id, nom: p.nom })));

      // Build members
      const enrichedMembers: MemberRow[] = (profiles || []).map((p: any) => ({
        user_id: p.user_id,
        profile_id: p.id,
        display_name: p.display_name,
        email: p.email,
        phone: p.phone || null,
        competences: p.competences,
        pole_id: p.pole_id,
        role: roleMap.get(p.user_id)?.role || "benevole",
        role_row_id: roleMap.get(p.user_id)?.id || null,
        is_active: p.is_active !== false,
        has_account: p.has_account === true,
      }));
      setMembers(enrichedMembers);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
    setPoleForm({ nom: p.nom, description: p.description || "", manager_id: p.manager_id || "none", target_staff: p.target_staff });
    setPoleDialogOpen(true);
  };
  const handleDeletePole = async (p: PoleRow) => {
    if (p.member_count > 0) {
      toast({ title: "Suppression impossible", description: `${p.member_count} membre(s) sont encore rattachés à ce pôle. Réaffectez-les d'abord.`, variant: "destructive" });
      return;
    }
    try {
      await supabase.from("poles").delete().eq("id", p.id);
      toast({ title: "Pôle supprimé", description: `"${p.nom}" a été supprimé.` });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };
  const handleSavePole = async () => {
    if (!poleForm.nom.trim()) return;
    setPoleSaving(true);
    try {
      const payload: any = {
        nom: poleForm.nom,
        description: poleForm.description || null,
        manager_id: poleForm.manager_id === "none" ? null : poleForm.manager_id,
        target_staff: poleForm.target_staff,
      };
      if (editingPole) {
        await supabase.from("poles").update(payload).eq("id", editingPole.id);
        toast({ title: "Pôle mis à jour" });
      } else {
        await supabase.from("poles").insert(payload);
        toast({ title: "Pôle créé", description: `"${poleForm.nom}" ajouté.` });
      }
      setPoleDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setPoleSaving(false);
    }
  };

  // ─── Inline role/pole change ───────────────────────────────────────
  const handleInlineRoleChange = async (m: MemberRow, newRole: AppRole) => {
    try {
      if (m.role_row_id) {
        await supabase.from("user_roles").update({ role: newRole }).eq("id", m.role_row_id);
      } else {
        await supabase.from("user_roles").insert({ user_id: m.user_id, role: newRole });
      }
      toast({ title: "Rôle mis à jour", description: `${m.display_name} → ${ROLE_LABELS[newRole]}` });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const handleInlinePoleChange = async (m: MemberRow, poleId: string) => {
    try {
      await supabase.from("profiles").update({ pole_id: poleId === "none" ? null : poleId } as any).eq("user_id", m.user_id);
      const poleName = polesRaw.find((p) => p.id === poleId)?.nom || "Aucun";
      toast({ title: "Pôle mis à jour", description: `${m.display_name} → ${poleName}` });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const openEditMember = (m: MemberRow) => {
    setEditMember(m);
    setMemberForm({
      name: m.display_name,
      email: m.email || "",
      phone: m.phone || "",
      role: m.role,
      pole_id: m.pole_id || "none",
      competences: (m.competences || []).join(", "),
    });
  };
  const handleSaveMember = async () => {
    if (!editMember) return;
    setMemberSaving(true);
    try {
      const competencesArr = memberForm.competences.split(",").map((c) => c.trim()).filter(Boolean);
      await supabase.from("profiles").update({
        display_name: memberForm.name,
        email: memberForm.email.trim() || null,
        phone: memberForm.phone.trim() || null,
        competences: competencesArr,
        pole_id: memberForm.pole_id === "none" ? null : memberForm.pole_id,
      } as any).eq("user_id", editMember.user_id);

      if (editMember.role !== memberForm.role) {
        if (editMember.role_row_id) {
          await supabase.from("user_roles").update({ role: memberForm.role }).eq("id", editMember.role_row_id);
        } else {
          await supabase.from("user_roles").insert({ user_id: editMember.user_id, role: memberForm.role });
        }
      }

      toast({ title: "Profil mis à jour" });
      setEditMember(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setMemberSaving(false);
    }
  };

  // ─── Transform offline member to invited user ──────────────────────
  const handleTransformToUser = async (m: MemberRow) => {
    if (!m.email) return;
    try {
      const res = await supabase.functions.invoke("invite-member", {
        body: {
          email: m.email,
          display_name: m.display_name,
          role: m.role,
          pole_id: m.pole_id,
          redirect_to: `${window.location.origin}/set-password`,
        },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: "Invitation envoyée", description: `${m.display_name} recevra un email pour créer son accès.` });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  // ─── Add member (dual-mode) ─────────────────────────────────────────
  const openAddMember = () => {
    setAddForm({ name: "", phone: "", email: "", role: "benevole", pole_id: "none", competences: "", sendInvite: false });
    setAddMode("simple");
    setAddOpen(true);
  };

  const handleAddMember = async () => {
    if (!addForm.name.trim()) return;
    setAddSaving(true);
    try {
      if (addMode === "invite" && addForm.sendInvite && addForm.email.trim()) {
        // ── Invitation mode: use Supabase Auth invite ──
        const res = await supabase.functions.invoke("invite-member", {
          body: {
            email: addForm.email.trim(),
            display_name: addForm.name.trim(),
            role: addForm.role,
            pole_id: addForm.pole_id === "none" ? null : addForm.pole_id,
            redirect_to: `${window.location.origin}/set-password`,
          },
        });
        if (res.error) throw new Error(res.error.message);
        if (res.data?.error) throw new Error(res.data.error);
        toast({ title: "Invitation envoyée", description: `Un email a été envoyé à ${addForm.email.trim()}.` });
      } else {
        // ── Simple mode: insert profile directly ──
        const competencesArr = addForm.competences.split(",").map((c) => c.trim()).filter(Boolean);
        // We use a dummy UUID for user_id since this member has no Auth account
        const fakeUserId = crypto.randomUUID();
        const { error: insertErr } = await supabase.from("profiles").insert({
          user_id: fakeUserId,
          display_name: addForm.name.trim(),
          email: addForm.email.trim() || null,
          phone: addForm.phone.trim() || null,
          pole_id: addForm.pole_id === "none" ? null : addForm.pole_id,
          competences: competencesArr,
          has_account: false,
          is_active: true,
        } as any);
        if (insertErr) throw insertErr;

        // Insert role for this member
        await supabase.from("user_roles").insert({ user_id: fakeUserId, role: addForm.role });
        toast({ title: "Membre ajouté", description: `${addForm.name.trim()} a été ajouté à l'annuaire.` });
      }
      setAddOpen(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setAddSaving(false);
    }
  };

  // ─── Deactivate / Reactivate / Delete ─────────────────────────────
  const isSelf = (m: MemberRow) => m.user_id === currentUser?.id;

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setActionLoading(true);
    try {
      const res = await supabase.functions.invoke("manage-member", {
        body: { action: "deactivate", target_user_id: deactivateTarget.user_id },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: "Compte désactivé", description: `Le compte de ${deactivateTarget.display_name} a été désactivé avec succès.` });
      setDeactivateTarget(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (m: MemberRow) => {
    try {
      const res = await supabase.functions.invoke("manage-member", {
        body: { action: "reactivate", target_user_id: m.user_id },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: "Compte réactivé", description: `Le compte de ${m.display_name} a été réactivé.` });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const res = await supabase.functions.invoke("manage-member", {
        body: { action: "delete", target_user_id: deleteTarget.user_id },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: "Utilisateur retiré", description: `${deleteTarget.display_name} a été retiré du système.` });
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };


  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch = m.display_name.toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q)
      || (m.phone || "").includes(q)
      || ROLE_LABELS[m.role].toLowerCase().includes(q) || (m.competences || []).some((c) => c.toLowerCase().includes(q));
    const matchContact =
      contactFilter === "all" ? true :
      contactFilter === "email" ? !!m.email :
      contactFilter === "phone" ? !!m.phone && !m.email : true;
    return matchSearch && matchContact;
  });

  const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const poleName = (poleId: string | null) => polesRaw.find((p) => p.id === poleId)?.nom || null;

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div>
              <h1 className="text-xl font-bold text-foreground">Organisation</h1>
              <p className="text-sm text-muted-foreground">Pôles, membres et compétences</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="poles" className="space-y-4">
            <TabsList>
              <TabsTrigger value="poles" className="gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Pôles
              </TabsTrigger>
              <TabsTrigger value="members" className="gap-1.5">
                <Users className="h-3.5 w-3.5" /> Annuaire des Membres
              </TabsTrigger>
            </TabsList>

            {/* ═══════════ PÔLES TAB ═══════════ */}
            <TabsContent value="poles" className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={openAddPole}>
                  <Plus className="h-4 w-4 mr-1" /> Ajouter un Pôle
                </Button>
              </div>

              {poles.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-muted-foreground">Aucun pôle créé</CardContent></Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <AnimatePresence>
                    {poles.map((p) => {
                      const ratio = p.target_staff > 0 ? Math.min((p.member_count / p.target_staff) * 100, 100) : 0;
                      const isComplete = p.target_staff > 0 && p.member_count >= p.target_staff;
                      return (
                        <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                          <Card className="h-full">
                            <CardContent className="p-4 space-y-3">
                              {/* Header: nom + actions */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-base font-semibold text-foreground leading-tight">{p.nom}</p>
                                  {p.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                                  )}
                                </div>
                                {isAdmin && (
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditPole(p)} title="Modifier">
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="sm"
                                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                      title="Voir les membres"
                                      onClick={() => {
                                        const tabTrigger = document.querySelector<HTMLButtonElement>('[data-radix-tabs-trigger][value="members"]') ||
                                          document.querySelector<HTMLButtonElement>('[role="tab"][data-value="members"]');
                                        if (tabTrigger) tabTrigger.click();
                                      }}
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="sm"
                                      className={`h-7 w-7 p-0 ${p.member_count > 0 ? "text-muted-foreground/40 cursor-not-allowed" : "text-destructive/70 hover:text-destructive"}`}
                                      title={p.member_count > 0 ? `${p.member_count} membre(s) rattaché(s)` : "Supprimer"}
                                      onClick={() => handleDeletePole(p)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {/* Manager */}
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6 shrink-0">
                                  <AvatarFallback className="text-[9px] font-semibold bg-primary/10 text-primary">
                                    {p.manager_name ? p.manager_name.split(" ").map((n) => n[0]).join("").slice(0,2).toUpperCase() : "?"}
                                  </AvatarFallback>
                                </Avatar>
                                {p.manager_name ? (
                                  <span className="text-xs text-foreground font-medium truncate">{p.manager_name}</span>
                                ) : isAdmin ? (
                                  <button onClick={() => openEditPole(p)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                                    <Plus className="h-3 w-3" />
                                    <span>Assigner un responsable</span>
                                  </button>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">Non assigné</span>
                                )}
                              </div>

                              {/* Staff ratio */}
                              {p.target_staff > 0 ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Users className="h-3 w-3" />
                                      <span>{p.member_count}/{p.target_staff} membres</span>
                                    </div>
                                    <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${isComplete ? "bg-green-500/10 text-green-700 border-green-500/30" : "bg-orange-500/10 text-orange-700 border-orange-500/30"}`}>
                                      {isComplete ? "Complet" : "Sous-effectif"}
                                    </Badge>
                                  </div>
                                  <Progress
                                    value={ratio}
                                    className={`h-1.5 ${isComplete ? "[&>div]:bg-green-500" : "[&>div]:bg-orange-400"}`}
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Users className="h-3.5 w-3.5" />
                                  <span>{p.member_count} membre{p.member_count !== 1 ? "s" : ""}</span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </TabsContent>

            {/* ═══════════ MEMBERS TAB ═══════════ */}
            <TabsContent value="members" className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[160px] max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-8 text-xs" />
                  {search && (
                    <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
                {/* Contact filter */}
                <Select value={contactFilter} onValueChange={(v) => setContactFilter(v as "all" | "email" | "phone")}>
                  <SelectTrigger className="h-9 w-[150px] text-xs">
                    <SelectValue placeholder="Tous les contacts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les contacts</SelectItem>
                    <SelectItem value="email"><span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />Email uniquement</span></SelectItem>
                    <SelectItem value="phone"><span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />Téléphone uniquement</span></SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="text-xs">{filtered.length} résultat{filtered.length !== 1 ? "s" : ""}</Badge>
                <Button size="sm" onClick={openAddMember}>
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter un membre
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[210px]">Membre</TableHead>
                        <TableHead className="w-[180px]">Contact</TableHead>
                        <TableHead className="w-[150px]">Rôle</TableHead>
                        <TableHead className="w-[150px]">Pôle</TableHead>
                        <TableHead>Compétences</TableHead>
                        <TableHead className="w-[60px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Aucun membre trouvé</TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((m) => (
                          <TableRow key={m.user_id} className={!m.is_active ? "opacity-60 bg-muted/30" : ""}>
                            {/* Membre */}
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className={`text-[10px] font-semibold ${m.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                    {initials(m.display_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-medium text-foreground leading-tight">{m.display_name}</p>
                                  {!m.is_active && <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-destructive/10 text-destructive border-destructive/20">Inactif</Badge>}
                                  {m.is_active && m.has_account && <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-primary/10 text-primary border-primary/20">Actif</Badge>}
                                  {m.is_active && !m.has_account && <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-muted text-muted-foreground border-border">Hors-ligne</Badge>}
                                  {isSelf(m) && <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-secondary/50">Vous</Badge>}
                                </div>
                              </div>
                            </TableCell>
                            {/* Contact */}
                            <TableCell>
                              <div className="space-y-1">
                                {m.phone && (
                                  <a href={`tel:${m.phone}`} className="flex items-center gap-1.5 text-xs text-foreground hover:text-primary transition-colors group" title={`Appeler ${m.display_name}`}>
                                    <PhoneCall className="h-3 w-3 text-primary group-hover:scale-110 transition-transform" />
                                    <span>{m.phone}</span>
                                  </a>
                                )}
                                {m.email && (
                                  <a href={`mailto:${m.email}`} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors" title={m.email}>
                                    <Mail className="h-3 w-3" />
                                    <span className="truncate max-w-[130px]">{m.email}</span>
                                  </a>
                                )}
                                {!m.phone && !m.email && <span className="text-[11px] text-muted-foreground">—</span>}
                              </div>
                            </TableCell>
                            {/* Rôle */}
                            <TableCell>
                              {isAdmin ? (
                                <Select value={m.role} onValueChange={(v) => handleInlineRoleChange(m, v as AppRole)}>
                                  <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin"><span className="flex items-center gap-1.5"><Shield className="h-3 w-3" />Admin</span></SelectItem>
                                    <SelectItem value="imam_chef"><span className="flex items-center gap-1.5"><UserCheck className="h-3 w-3" />Responsable</span></SelectItem>
                                    <SelectItem value="benevole"><span className="flex items-center gap-1.5"><Users className="h-3 w-3" />Bénévole</span></SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant="outline" className={`text-[10px] ${ROLE_STYLES[m.role]}`}>{ROLE_LABELS[m.role]}</Badge>
                              )}
                            </TableCell>
                            {/* Pôle */}
                            <TableCell>
                              {isAdmin ? (
                                <Select value={m.pole_id || "none"} onValueChange={(v) => handleInlinePoleChange(m, v)}>
                                  <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Aucun pôle</SelectItem>
                                    {polesRaw.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-xs text-muted-foreground">{poleName(m.pole_id) || "—"}</span>
                              )}
                            </TableCell>
                            {/* Compétences */}
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(m.competences || []).length > 0 ? (
                                  (m.competences || []).slice(0, 3).map((c) => (
                                    <Badge key={c} variant="outline" className="text-[9px] h-4 px-1.5 bg-secondary/50">
                                      <Tag className="h-2 w-2 mr-0.5" />{c}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">—</span>
                                )}
                                {(m.competences || []).length > 3 && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">+{(m.competences || []).length - 3}</Badge>
                                )}
                              </div>
                            </TableCell>
                            {/* Actions */}
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEditMember(m)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                {isAdmin && !isSelf(m) && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56 bg-popover border border-border shadow-md z-50">
                                      {!m.has_account && m.email && (
                                        <>
                                          <DropdownMenuItem className="text-primary focus:text-primary focus:bg-primary/5 cursor-pointer" onClick={() => handleTransformToUser(m)}>
                                            <UserPlus className="h-3.5 w-3.5 mr-2" />
                                            Transformer en utilisateur
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                        </>
                                      )}
                                      {m.is_active ? (
                                        <DropdownMenuItem className="text-foreground focus:bg-muted cursor-pointer" onClick={() => setDeactivateTarget(m)}>
                                          <UserX className="h-3.5 w-3.5 mr-2" />Désactiver le compte
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem className="text-primary focus:text-primary focus:bg-primary/5 cursor-pointer" onClick={() => handleReactivate(m)}>
                                          <UserCheck2 className="h-3.5 w-3.5 mr-2" />Réactiver le compte
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/5 cursor-pointer" onClick={() => setDeleteTarget(m)}>
                                        <Trash2 className="h-3.5 w-3.5 mr-2" />Supprimer définitivement
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))

                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* ─── Pole Dialog ───────────────────────────────────────────── */}
      <Dialog open={poleDialogOpen} onOpenChange={setPoleDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingPole ? "Modifier le Pôle" : "Ajouter un Pôle"}</DialogTitle>
            <DialogDescription>
              {editingPole ? `Modification de "${editingPole.nom}"` : "Créez un nouveau pôle organisationnel"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nom du pôle</Label>
              <Input value={poleForm.nom} onChange={(e) => setPoleForm((f) => ({ ...f, nom: e.target.value }))} className="h-9" placeholder="Ex: Logistique" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea value={poleForm.description} onChange={(e) => setPoleForm((f) => ({ ...f, description: e.target.value }))} className="min-h-[60px]" placeholder="Description du pôle…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><UserCog className="h-3 w-3" />Responsable du pôle</Label>
              <Select value={poleForm.manager_id} onValueChange={(v) => setPoleForm((f) => ({ ...f, manager_id: v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Sélectionner un responsable…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun responsable</SelectItem>
                  {members
                    .filter((m) => m.is_active)
                    .map((m) => (
                      <SelectItem key={m.profile_id} value={m.profile_id}>
                        {m.display_name}
                        {m.role !== "benevole" && <span className="ml-1 text-muted-foreground text-[10px]">({ROLE_LABELS[m.role]})</span>}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Users className="h-3 w-3" />Besoin global en effectif</Label>
              <Input
                type="number"
                min={0}
                value={poleForm.target_staff}
                onChange={(e) => setPoleForm((f) => ({ ...f, target_staff: parseInt(e.target.value) || 0 }))}
                className="h-9"
                placeholder="0"
              />
              <p className="text-[10px] text-muted-foreground">Nombre de membres nécessaires pour ce pôle</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPoleDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSavePole} disabled={poleSaving || !poleForm.nom.trim()}>
              {poleSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {editingPole ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Member Edit Dialog ────────────────────────────────────── */}
      <Dialog open={!!editMember} onOpenChange={(open) => !open && setEditMember(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le profil</DialogTitle>
            <DialogDescription>{editMember?.display_name} — {editMember?.email || ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nom d'affichage</Label>
              <Input value={memberForm.name} onChange={(e) => setMemberForm((f) => ({ ...f, name: e.target.value }))} className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><Phone className="h-3 w-3" />Téléphone</Label>
                <Input value={memberForm.phone} onChange={(e) => setMemberForm((f) => ({ ...f, phone: e.target.value }))} className="h-9" placeholder="06 12 34 56 78" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><Mail className="h-3 w-3" />Email</Label>
                <Input type="email" value={memberForm.email} onChange={(e) => setMemberForm((f) => ({ ...f, email: e.target.value }))} className="h-9" placeholder="ahmed@example.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rôle</Label>
              <Select value={memberForm.role} onValueChange={(v) => setMemberForm((f) => ({ ...f, role: v as AppRole }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="imam_chef">Responsable</SelectItem>
                  <SelectItem value="benevole">Bénévole</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pôle</Label>
              <Select value={memberForm.pole_id} onValueChange={(v) => setMemberForm((f) => ({ ...f, pole_id: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun pôle</SelectItem>
                  {polesRaw.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Compétences <span className="text-muted-foreground">(séparées par virgules)</span></Label>
              <Input
                value={memberForm.competences}
                onChange={(e) => setMemberForm((f) => ({ ...f, competences: e.target.value }))}
                className="h-9"
                placeholder="enseignement, logistique, accueil…"
              />
              {memberForm.competences && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {memberForm.competences.split(",").map((c) => c.trim()).filter(Boolean).map((c) => (
                    <Badge key={c} variant="outline" className="text-[9px] h-4 px-1.5 bg-secondary/50">{c}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMember(null)}>Annuler</Button>
            <Button onClick={handleSaveMember} disabled={memberSaving || !memberForm.name.trim()}>
              {memberSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Member Dialog (dual-mode) ────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) setAddOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un membre</DialogTitle>
            <DialogDescription>
              Choisissez le mode d'enregistrement pour ce nouveau membre.
            </DialogDescription>
          </DialogHeader>

          {/* Mode tabs */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setAddMode("simple")}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${addMode === "simple" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              📋 Enregistrement simple
            </button>
            <button
              onClick={() => setAddMode("invite")}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${addMode === "invite" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              ✉️ Invitation numérique
            </button>
          </div>

          {addMode === "simple" && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              Le membre sera ajouté à l'annuaire <strong>sans compte numérique</strong>. Il apparaîtra avec le badge <strong>Hors-ligne</strong>.
            </p>
          )}
          {addMode === "invite" && (
            <p className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
              Un email d'invitation sera envoyé. Une fois le mot de passe créé, le membre aura accès à MASJIDLAB et passera en badge <strong>Actif</strong>.
            </p>
          )}

          <div className="space-y-3 py-1">
            {/* Common fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nom complet *</Label>
                <Input placeholder="Ahmed Ben Ali" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Téléphone</Label>
                <Input placeholder="06 12 34 56 78" value={addForm.phone} onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))} className="h-9" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Email {addMode === "invite" ? <span className="text-destructive">*</span> : <span className="text-muted-foreground">(optionnel)</span>}
              </Label>
              <Input
                type="email"
                placeholder="ahmed@example.com"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Rôle</Label>
                <Select value={addForm.role} onValueChange={(v) => setAddForm((f) => ({ ...f, role: v as AppRole }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="imam_chef">Responsable</SelectItem>
                    <SelectItem value="benevole">Bénévole</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pôle</Label>
                <Select value={addForm.pole_id} onValueChange={(v) => setAddForm((f) => ({ ...f, pole_id: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun pôle</SelectItem>
                    {polesRaw.map((p) => (<SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Compétences <span className="text-muted-foreground">(séparées par virgules)</span></Label>
              <Input
                placeholder="enseignement, logistique, accueil…"
                value={addForm.competences}
                onChange={(e) => setAddForm((f) => ({ ...f, competences: e.target.value }))}
                className="h-9"
              />
            </div>

            {addMode === "invite" && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-primary"
                  checked={addForm.sendInvite}
                  onChange={(e) => setAddForm((f) => ({ ...f, sendInvite: e.target.checked }))}
                />
                <span className="text-sm font-medium">Envoyer l'invitation par email maintenant</span>
              </label>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
            <Button
              onClick={handleAddMember}
              disabled={addSaving || !addForm.name.trim() || (addMode === "invite" && addForm.sendInvite && !addForm.email.trim())}
            >
              {addSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : (addMode === "invite" && addForm.sendInvite ? <Mail className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />)}
              {addMode === "invite" && addForm.sendInvite ? "Envoyer l'invitation" : "Ajouter le membre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ─── Deactivate Confirm Dialog ─────────────────────────────── */}
      <Dialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5" />
              Désactiver le compte
            </DialogTitle>
            <DialogDescription className="pt-2">
              Vous êtes sur le point de désactiver le compte de{" "}
              <strong>{deactivateTarget?.display_name}</strong>. Cette personne sera
              immédiatement déconnectée et ne pourra plus accéder à MASJIDLAB.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-sm text-accent-foreground">
            ℹ️ Le compte peut être réactivé à tout moment. Les données de l'utilisateur sont conservées.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>Annuler</Button>
            <Button
              variant="outline"
              className="border-accent/40 text-accent-foreground hover:bg-accent/10"
              onClick={handleDeactivate}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <UserX className="h-4 w-4 mr-1" />}
              Désactiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Hard Delete Confirm Dialog ────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Suppression définitive
            </DialogTitle>
            <DialogDescription className="pt-2">
              Vous êtes sur le point de supprimer définitivement le compte de{" "}
              <strong>{deleteTarget?.display_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-sm text-destructive space-y-2">
            <p className="font-semibold">⚠️ Attention, cette action est irréversible.</p>
            <p className="text-muted-foreground text-xs">
              Souhaitez-vous plutôt <strong>désactiver le compte</strong> pour conserver
              l'historique des activités (contributions, plannings) ?
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setDeleteTarget(null);
                if (deleteTarget) setDeactivateTarget(deleteTarget);
              }}
            >
              <UserX className="h-4 w-4 mr-1" />
              Désactiver à la place
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

