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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  description: string | null;
  responsable_id: string | null;
  responsable_name: string | null;
  member_count: number;
}

interface MemberRow {
  user_id: string;
  display_name: string;
  email: string | null;
  competences: string[] | null;
  pole_id: string | null;
  role: AppRole;
  role_row_id: string | null;
}

// ─── Component ───────────────────────────────────────────────────────
export default function OrganisationPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [poles, setPoles] = useState<PoleRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [polesRaw, setPolesRaw] = useState<{ id: string; nom: string }[]>([]);
  const [search, setSearch] = useState("");

  // Pole dialog
  const [poleDialogOpen, setPoleDialogOpen] = useState(false);
  const [editingPole, setEditingPole] = useState<PoleRow | null>(null);
  const [poleForm, setPoleForm] = useState({ nom: "", description: "" });
  const [poleSaving, setPoleSaving] = useState(false);

  // Member edit dialog
  const [editMember, setEditMember] = useState<MemberRow | null>(null);
  const [memberForm, setMemberForm] = useState({ name: "", role: "benevole" as AppRole, pole_id: "none", competences: "" });
  const [memberSaving, setMemberSaving] = useState(false);

  // ─── Fetch ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Poles
      const { data: polesData } = await supabase.from("poles").select("id, nom, description, responsable_id").order("nom");
      
      // All profiles
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, email, competences, pole_id, id").order("display_name");
      
      // All roles
      const { data: roles } = await supabase.from("user_roles").select("id, user_id, role");

      const roleMap = new Map((roles || []).map((r) => [r.user_id, { role: r.role as AppRole, id: r.id }]));
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      const profileByUserId = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      // Build poles with counts & responsable name
      const enrichedPoles: PoleRow[] = (polesData || []).map((p) => {
        const memberCount = (profiles || []).filter((pr: any) => pr.pole_id === p.id).length;
        const resp = p.responsable_id ? profileMap.get(p.responsable_id) : null;
        return {
          id: p.id,
          nom: p.nom,
          description: p.description,
          responsable_id: p.responsable_id,
          responsable_name: resp?.display_name || null,
          member_count: memberCount,
        };
      });
      setPoles(enrichedPoles);
      setPolesRaw((polesData || []).map((p) => ({ id: p.id, nom: p.nom })));

      // Build members
      const enrichedMembers: MemberRow[] = (profiles || []).map((p: any) => ({
        user_id: p.user_id,
        display_name: p.display_name,
        email: p.email,
        competences: p.competences,
        pole_id: p.pole_id,
        role: roleMap.get(p.user_id)?.role || "benevole",
        role_row_id: roleMap.get(p.user_id)?.id || null,
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
    setPoleForm({ nom: "", description: "" });
    setPoleDialogOpen(true);
  };
  const openEditPole = (p: PoleRow) => {
    setEditingPole(p);
    setPoleForm({ nom: p.nom, description: p.description || "" });
    setPoleDialogOpen(true);
  };
  const handleSavePole = async () => {
    if (!poleForm.nom.trim()) return;
    setPoleSaving(true);
    try {
      if (editingPole) {
        await supabase.from("poles").update({ nom: poleForm.nom, description: poleForm.description || null }).eq("id", editingPole.id);
        toast({ title: "Pôle mis à jour" });
      } else {
        await supabase.from("poles").insert({ nom: poleForm.nom, description: poleForm.description || null });
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

  // ─── Competences edit ──────────────────────────────────────────────
  const openEditMember = (m: MemberRow) => {
    setEditMember(m);
    setMemberForm({
      name: m.display_name,
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

  // ─── Filter ────────────────────────────────────────────────────────
  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    return m.display_name.toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q)
      || ROLE_LABELS[m.role].toLowerCase().includes(q) || (m.competences || []).some((c) => c.toLowerCase().includes(q));
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
                    {poles.map((p) => (
                      <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                        <Card className="h-full">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-base font-semibold text-foreground">{p.nom}</p>
                                {p.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                                )}
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => openEditPole(p)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <UserCheck className="h-3.5 w-3.5 text-primary" />
                                <span>{p.responsable_name || <span className="italic">Non assigné</span>}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5" />
                                <span>{p.member_count} membre{p.member_count !== 1 ? "s" : ""}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </TabsContent>

            {/* ═══════════ MEMBERS TAB ═══════════ */}
            <TabsContent value="members" className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-8 text-xs" />
                  {search && (
                    <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
                <Badge variant="outline" className="text-xs">{filtered.length} résultat{filtered.length !== 1 ? "s" : ""}</Badge>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[220px]">Membre</TableHead>
                        <TableHead className="w-[160px]">Rôle</TableHead>
                        <TableHead className="w-[160px]">Pôle</TableHead>
                        <TableHead>Compétences</TableHead>
                        <TableHead className="w-[60px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Aucun membre trouvé</TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((m) => (
                          <TableRow key={m.user_id}>
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                                    {initials(m.display_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium text-foreground leading-tight">{m.display_name}</p>
                                  <p className="text-[11px] text-muted-foreground">{m.email || "—"}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select value={m.role} onValueChange={(v) => handleInlineRoleChange(m, v as AppRole)}>
                                <SelectTrigger className="h-8 text-xs w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">
                                    <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" />Admin</span>
                                  </SelectItem>
                                  <SelectItem value="imam_chef">
                                    <span className="flex items-center gap-1.5"><UserCheck className="h-3 w-3" />Responsable</span>
                                  </SelectItem>
                                  <SelectItem value="benevole">
                                    <span className="flex items-center gap-1.5"><Users className="h-3 w-3" />Bénévole</span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select value={m.pole_id || "none"} onValueChange={(v) => handleInlinePoleChange(m, v)}>
                                <SelectTrigger className="h-8 text-xs w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Aucun pôle</SelectItem>
                                  {polesRaw.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
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
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => openEditMember(m)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
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
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nom d'affichage</Label>
              <Input value={memberForm.name} onChange={(e) => setMemberForm((f) => ({ ...f, name: e.target.value }))} className="h-9" />
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
    </main>
  );
}
