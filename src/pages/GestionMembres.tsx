import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
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
  Mail,
  MoreHorizontal,
  UserX,
  Trash2,
  UserCheck2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Label } from "@/components/ui/label";

// ─── Types ───────────────────────────────────────────────────────────
type AppRole = "admin" | "imam_chef" | "benevole";

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  imam_chef: "Imam / Chef de Pôle",
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
}

const PROFILE_TAGS = ["Fidèle", "Donateur", "Parent", "Élève"] as const;
type ProfileTag = typeof PROFILE_TAGS[number];

const TAG_STYLES: Record<ProfileTag, string> = {
  "Fidèle": "bg-primary/10 text-primary border-primary/20",
  "Donateur": "bg-green-500/10 text-green-700 border-green-500/20",
  "Parent": "bg-blue-500/10 text-blue-700 border-blue-500/20",
  "Élève": "bg-amber-500/10 text-amber-700 border-amber-500/20",
};

interface MemberRow {
  user_id: string;
  display_name: string;
  email: string | null;
  competences: string[] | null;
  tags: string[];
  pole_id: string | null;
  pole_nom: string | null;
  role: AppRole;
  role_row_id: string | null;
  is_active: boolean;
}

// ─── Component ───────────────────────────────────────────────────────
export default function GestionMembresPage() {
  const { toast } = useToast();
  const { user: currentUser, dbRole } = useAuth();
  const isAdmin = dbRole === "admin" || dbRole === "super_admin";

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [poles, setPoles] = useState<PoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit dialog
  const [editTarget, setEditTarget] = useState<MemberRow | null>(null);
  const [formRole, setFormRole] = useState<AppRole>("benevole");
  const [formPole, setFormPole] = useState<string>("none");
  const [formName, setFormName] = useState("");
  const [formCompetences, setFormCompetences] = useState("");
  const [formTags, setFormTags] = useState<string[]>([]);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("benevole");
  const [invitePole, setInvitePole] = useState("none");
  const [inviting, setInviting] = useState(false);

  // Action modals
  const [deactivateTarget, setDeactivateTarget] = useState<MemberRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MemberRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ─── Fetch ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: polesData } = await supabase
        .from("poles")
        .select("id, nom")
        .order("nom");
      setPoles(polesData || []);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, email, competences, pole_id, is_active, tags")
        .order("display_name");

      const { data: roles } = await supabase
        .from("user_roles")
        .select("id, user_id, role");

      const roleMap = new Map(
        (roles || []).map((r) => [r.user_id, { role: r.role as AppRole, id: r.id }])
      );
      const poleMap = new Map(
        (polesData || []).map((p) => [p.id, p.nom])
      );

      const merged: MemberRow[] = (profiles || []).map((p: any) => ({
        user_id: p.user_id,
        display_name: p.display_name,
        email: p.email,
        competences: p.competences,
        tags: p.tags ?? [],
        pole_id: p.pole_id,
        pole_nom: p.pole_id ? poleMap.get(p.pole_id) || null : null,
        role: roleMap.get(p.user_id)?.role || "benevole",
        role_row_id: roleMap.get(p.user_id)?.id || null,
        is_active: p.is_active !== false, // default true if null
      }));

      setMembers(merged);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── Edit handlers ─────────────────────────────────────────────────
  const openEdit = (m: MemberRow) => {
    setEditTarget(m);
    setFormRole(m.role);
    setFormPole(m.pole_id || "none");
    setFormName(m.display_name);
    setFormCompetences((m.competences || []).join(", "));
    setFormTags(m.tags ?? []);
  };

  const handleSave = async () => {
    if (!editTarget) return;
    setSaving(true);

    try {
      const competencesArr = formCompetences
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          display_name: formName,
          competences: competencesArr,
          tags: formTags,
          pole_id: formPole === "none" ? null : formPole,
        } as any)
        .eq("user_id", editTarget.user_id);
      if (profErr) throw profErr;

      if (editTarget.role !== formRole) {
        if (editTarget.role_row_id) {
          const { error: roleErr } = await supabase
            .from("user_roles")
            .update({ role: formRole })
            .eq("id", editTarget.role_row_id);
          if (roleErr) throw roleErr;
        } else {
          const { error: roleErr } = await supabase
            .from("user_roles")
            .insert({ user_id: editTarget.user_id, role: formRole });
          if (roleErr) throw roleErr;
        }
      }

      toast({ title: "Profil mis à jour", description: `${formName} sauvegardé.` });
      setEditTarget(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ─── Invite handler ─────────────────────────────────────────────────
  const handleInvite = async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await supabase.functions.invoke("invite-member", {
        body: {
          email: inviteEmail.trim(),
          display_name: inviteName.trim(),
          role: inviteRole,
          pole_id: invitePole === "none" ? null : invitePole,
          redirect_to: `${window.location.origin}/set-password`,
        },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast({ title: "Invitation envoyée", description: `Invitation envoyée avec succès à ${inviteEmail.trim()}` });
      setInviteOpen(false);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("benevole");
      setInvitePole("none");
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  // ─── Deactivate / Reactivate ────────────────────────────────────────
  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setActionLoading(true);
    try {
      const res = await supabase.functions.invoke("manage-member", {
        body: { action: "deactivate", target_user_id: deactivateTarget.user_id },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast({
        title: "Compte désactivé",
        description: `Le compte de ${deactivateTarget.display_name} a été désactivé avec succès.`,
      });
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

      toast({
        title: "Compte réactivé",
        description: `Le compte de ${m.display_name} a été réactivé.`,
      });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  // ─── Hard Delete ────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const res = await supabase.functions.invoke("manage-member", {
        body: { action: "delete", target_user_id: deleteTarget.user_id },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast({
        title: "Utilisateur retiré",
        description: `${deleteTarget.display_name} a été retiré du système.`,
      });
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Filter ────────────────────────────────────────────────────────
  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.display_name.toLowerCase().includes(q) ||
      (m.email || "").toLowerCase().includes(q) ||
      ROLE_LABELS[m.role].toLowerCase().includes(q) ||
      (m.pole_nom || "").toLowerCase().includes(q) ||
      (m.competences || []).some((c) => c.toLowerCase().includes(q))
    );
  });

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const isSelf = (m: MemberRow) => m.user_id === currentUser?.id;

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div>
              <h1 className="text-xl font-bold text-foreground">Gestion des Membres</h1>
              <p className="text-sm text-muted-foreground">
                {members.length} membre{members.length !== 1 ? "s" : ""} enregistré{members.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-[200px] pl-8 text-xs"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <Mail className="h-4 w-4 mr-1" />
                Inviter un membre
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[260px]">Membre</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Pôle</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Compétences</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        Aucun membre trouvé
                      </TableCell>
                    </TableRow>
                  ) : (
                    <AnimatePresence>
                      {filtered.map((m) => (
                        <motion.tr
                          key={m.user_id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`border-b border-border ${!m.is_active ? "opacity-60 bg-muted/30" : ""}`}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className={`text-xs font-semibold ${m.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                  {initials(m.display_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-medium text-foreground">{m.display_name}</p>
                                  {!m.is_active && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-destructive/10 text-destructive border-destructive/20">
                                      Inactif
                                    </Badge>
                                  )}
                                  {isSelf(m) && (
                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-secondary/50">
                                      Vous
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">{m.email || "—"}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[11px] ${ROLE_STYLES[m.role]}`}>
                              {m.role === "admin" && <Shield className="h-3 w-3 mr-1" />}
                              {m.role === "imam_chef" && <UserCheck className="h-3 w-3 mr-1" />}
                              {ROLE_LABELS[m.role]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {m.pole_nom ? (
                              <Badge variant="outline" className="text-[11px]">{m.pole_nom}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {m.tags.length > 0 ? m.tags.map((t) => (
                                <Badge key={t} variant="outline" className={`text-[10px] h-5 px-1.5 ${TAG_STYLES[t as ProfileTag] ?? ""}`}>
                                  {t}
                                </Badge>
                              )) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(m.competences || []).length > 0 ? (
                                (m.competences || []).slice(0, 4).map((c) => (
                                  <Badge key={c} variant="outline" className="text-[10px] h-5 px-1.5 bg-secondary/50">
                                    <Tag className="h-2.5 w-2.5 mr-0.5" />
                                    {c}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">Aucune</span>
                              )}
                              {(m.competences || []).length > 4 && (
                                <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                  +{(m.competences || []).length - 4}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {isAdmin && !isSelf(m) && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-52 bg-popover border border-border shadow-md z-50">
                                    {m.is_active ? (
                                      <DropdownMenuItem
                                        className="text-foreground focus:bg-muted cursor-pointer"
                                        onClick={() => setDeactivateTarget(m)}
                                      >
                                        <UserX className="h-3.5 w-3.5 mr-2" />
                                        Désactiver le compte
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        className="text-primary focus:text-primary focus:bg-primary/5 cursor-pointer"
                                        onClick={() => handleReactivate(m)}
                                      >
                                        <UserCheck2 className="h-3.5 w-3.5 mr-2" />
                                        Réactiver le compte
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive focus:bg-destructive/5 cursor-pointer"
                                      onClick={() => setDeleteTarget(m)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                                      Supprimer définitivement
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ─── Edit Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le profil</DialogTitle>
            <DialogDescription>
              {editTarget?.display_name} — {editTarget?.email || ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-xs">Nom d'affichage</Label>
              <Input id="edit-name" value={formName} onChange={(e) => setFormName(e.target.value)} className="h-9" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Rôle</Label>
              <Select value={formRole} onValueChange={(v) => setFormRole(v as AppRole)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="imam_chef">Imam / Chef de Pôle</SelectItem>
                  <SelectItem value="benevole">Bénévole</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Pôle</Label>
              <Select value={formPole} onValueChange={setFormPole}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun pôle</SelectItem>
                  {poles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tags Profil</Label>
              <div className="flex flex-wrap gap-2">
                {PROFILE_TAGS.map((tag) => {
                  const active = formTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setFormTags((prev) => active ? prev.filter((t) => t !== tag) : [...prev, tag])}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${active ? TAG_STYLES[tag] + " font-medium" : "border-border text-muted-foreground hover:bg-muted"}`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-comp" className="text-xs">
                Compétences <span className="text-muted-foreground">(séparées par des virgules)</span>
              </Label>
              <Input
                id="edit-comp"
                placeholder="enseignement, logistique, accueil…"
                value={formCompetences}
                onChange={(e) => setFormCompetences(e.target.value)}
                className="h-9"
              />
              {formCompetences && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {formCompetences.split(",").map((c) => c.trim()).filter(Boolean).map((c) => (
                    <Badge key={c} variant="outline" className="text-[10px] h-5 px-1.5 bg-secondary/50">{c}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Invite Dialog ─────────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Inviter un nouveau membre</DialogTitle>
            <DialogDescription>
              Un email de bienvenue sera envoyé avec un lien pour configurer le mot de passe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv-name" className="text-xs">Nom complet</Label>
              <Input id="inv-name" placeholder="Ahmed Ben Ali" value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-email" className="text-xs">Adresse email</Label>
              <Input id="inv-email" type="email" placeholder="ahmed@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rôle</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="imam_chef">Imam / Chef de Pôle</SelectItem>
                  <SelectItem value="benevole">Bénévole</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pôle</Label>
              <Select value={invitePole} onValueChange={setInvitePole}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun pôle</SelectItem>
                  {poles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Annuler</Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteName.trim() || !inviteEmail.trim()}>
              {inviting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
              Envoyer l'invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Deactivate Confirm Dialog ─────────────────────────────── */}
      <Dialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <UserX className="h-5 w-5" />
              Désactiver le compte
            </DialogTitle>
            <DialogDescription className="pt-2">
              Vous êtes sur le point de désactiver le compte de{" "}
              <strong>{deactivateTarget?.display_name}</strong>. Cette personne sera
              immédiatement déconnectée et ne pourra plus accéder à MASJIDI.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-sm text-accent-foreground">
            ℹ️ Le compte peut être réactivé à tout moment depuis l'annuaire. Les données de l'utilisateur (contributions, plannings) sont conservées.
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
              l'historique des activités (contributions, cours, plannings) ?
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
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
