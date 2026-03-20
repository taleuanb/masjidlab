import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { BookOpen, Trash2, Loader2, Plus, Users, GraduationCap, Filter, Pencil, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClassProgressBoard } from "@/components/ClassProgressBoard";
import type { Tables } from "@/integrations/supabase/types";

type ClassRow = {
  id: string;
  nom: string;
  niveau: string | null;
  prof_id: string | null;
  salle_id: string | null;
  prof: { display_name: string } | null;
  salle: { name: string } | null;
  subjects: { id: string; name: string }[];
};

const Classes = () => {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRow | null>(null);
  const [form, setForm] = useState({ nom: "", niveau: "", prof_id: "", salle_id: "" });
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [filterNiveau, setFilterNiveau] = useState<string>("all");
  const [progressClassId, setProgressClassId] = useState<string>("");

  const isEditing = !!editingClass;

  // ── Fetch classes with joined prof, salle, and subjects ──
  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["madrasa_classes", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_classes")
        .select("*, prof:profiles!madrasa_classes_prof_id_fkey(display_name), salle:rooms!madrasa_classes_salle_id_fkey(name)")
        .eq("org_id", orgId!)
        .order("nom");
      if (error) throw error;

      const classIds = (data ?? []).map((c: any) => c.id);
      let subjectMap: Record<string, { id: string; name: string }[]> = {};
      if (classIds.length > 0) {
        const { data: links } = await supabase
          .from("madrasa_class_subjects")
          .select("class_id, subject:madrasa_subjects(id, name)")
          .in("class_id", classIds);
        for (const link of links ?? []) {
          if (!subjectMap[link.class_id]) subjectMap[link.class_id] = [];
          if (link.subject) subjectMap[link.class_id].push(link.subject as any);
        }
      }

      return (data ?? []).map((c: any) => ({ ...c, subjects: subjectMap[c.id] ?? [] })) as ClassRow[];
    },
  });

  // ── Reference data ──
  const { data: levels = [] } = useQuery({
    queryKey: ["madrasa_levels", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_levels").select("*").eq("org_id", orgId!).order("label");
      if (error) throw error;
      return data as Tables<"madrasa_levels">[];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["madrasa_subjects", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_subjects").select("*").eq("org_id", orgId!).order("name");
      if (error) throw error;
      return data as Tables<"madrasa_subjects">[];
    },
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers_education", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, user_roles!inner(role)")
        .eq("user_roles.role", "enseignant")
        .eq("org_id", orgId!);
      if (error) throw error;
      return (data ?? []).map((t: any) => ({ id: t.id, display_name: t.display_name }));
    },
  });

  // ── Mutations ──
  const saveClass = useMutation({
    mutationFn: async () => {
      if (!form.nom.trim()) throw new Error("Nom requis");

      if (isEditing) {
        // Update class
        const { error } = await supabase
          .from("madrasa_classes")
          .update({ nom: form.nom.trim(), niveau: form.niveau || null, prof_id: form.prof_id || null, salle_id: form.salle_id || null })
          .eq("id", editingClass.id);
        if (error) throw error;

        // Sync subjects: delete old, insert new
        await supabase.from("madrasa_class_subjects").delete().eq("class_id", editingClass.id);
        if (selectedSubjects.length > 0) {
          const links = selectedSubjects.map((sid) => ({ class_id: editingClass.id, subject_id: sid }));
          const { error: linkErr } = await supabase.from("madrasa_class_subjects").insert(links);
          if (linkErr) throw linkErr;
        }
      } else {
        // Create class
        const { data: created, error } = await supabase
          .from("madrasa_classes")
          .insert({ nom: form.nom.trim(), niveau: form.niveau || null, prof_id: form.prof_id || null, salle_id: form.salle_id || null, org_id: orgId! })
          .select("id")
          .single();
        if (error) throw error;
        if (selectedSubjects.length > 0) {
          const links = selectedSubjects.map((sid) => ({ class_id: created.id, subject_id: sid }));
          const { error: linkErr } = await supabase.from("madrasa_class_subjects").insert(links);
          if (linkErr) throw linkErr;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["madrasa_classes", orgId] });
      setDialogOpen(false);
      resetForm();
      toast({ title: isEditing ? "Classe modifiée" : "Classe créée" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteClass = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("madrasa_class_subjects").delete().eq("class_id", id);
      const { error } = await supabase.from("madrasa_classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["madrasa_classes", orgId] }); toast({ title: "Classe supprimée" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => { setForm({ nom: "", niveau: "", prof_id: "", salle_id: "" }); setSelectedSubjects([]); setEditingClass(null); };
  const toggleSubject = (id: string) => setSelectedSubjects((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);

  const openEdit = (c: ClassRow) => {
    setEditingClass(c);
    setForm({ nom: c.nom, niveau: c.niveau ?? "", prof_id: c.prof_id ?? "", salle_id: c.salle_id ?? "" });
    setSelectedSubjects(c.subjects.map((s) => s.id));
    setDialogOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <BookOpen className="h-5 w-5 text-accent" />
          <h1 className="text-xl font-bold text-foreground">Classes</h1>
          <Badge variant="secondary" className="ml-1">{classes.length}</Badge>
          <Button size="sm" className="ml-auto gradient-positive border-0" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nouvelle classe
          </Button>
        </div>

        <Tabs defaultValue="liste" className="w-full">
          <TabsList>
            <TabsTrigger value="liste" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Liste des classes
            </TabsTrigger>
            <TabsTrigger value="progression" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Vue Progrès
            </TabsTrigger>
          </TabsList>

          <TabsContent value="liste" className="mt-4 space-y-4">
            {/* Filter */}
            {classes.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterNiveau} onValueChange={setFilterNiveau}>
                  <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Filtrer par niveau" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les niveaux</SelectItem>
                    {levels.map((l) => (<SelectItem key={l.id} value={l.label}>{l.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Grid */}
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : classes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
                <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">Aucune classe créée.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Commencez par configurer les niveaux et matières dans Configuration &gt; Madrassa.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {classes.filter((c) => filterNiveau === "all" || c.niveau === filterNiveau).map((c) => (
                  <Card key={c.id} className="group relative cursor-pointer hover:border-primary/30 transition-colors" onClick={() => openEdit(c)}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{c.nom}</CardTitle>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer « {c.nom} » ?</AlertDialogTitle>
                                <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="text-muted-foreground">Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteClass.mutate(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {c.niveau && <Badge variant="outline" className="text-xs">{c.niveau}</Badge>}
                      {c.prof?.display_name && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{c.prof.display_name}</span>
                        </div>
                      )}
                      {c.subjects.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {c.subjects.map((s) => (
                            <Badge key={s.id} variant="secondary" className="text-[10px] font-normal">{s.name}</Badge>
                          ))}
                        </div>
                      )}
                      {!c.niveau && !c.prof?.display_name && c.subjects.length === 0 && (
                        <p className="text-xs text-muted-foreground/50 italic">Aucun détail configuré</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="progression" className="mt-4 space-y-4">
            {classes.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                Créez des classes pour visualiser la progression.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <Select value={progressClassId || classes[0]?.id} onValueChange={setProgressClassId}>
                    <SelectTrigger className="h-9 w-[250px]">
                      <SelectValue placeholder="Sélectionner une classe…" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nom} {c.niveau ? `(${c.niveau})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(() => {
                  const activeId = progressClassId || classes[0]?.id;
                  const activeClass = classes.find((c) => c.id === activeId);
                  if (!activeClass) return null;
                  return (
                    <ClassProgressBoard
                      classId={activeClass.id}
                      className={activeClass.nom}
                      subjects={activeClass.subjects}
                    />
                  );
                })()}
              </>
            )}
          </TabsContent>
        </Tabs>
        )}
      </div>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Modifier la classe" : "Nouvelle classe"}</DialogTitle>
            <DialogDescription>{isEditing ? `Modifiez « ${editingClass?.nom} » et ses matières.` : "Créez une classe et liez-la à des matières."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Nom de la classe *</Label>
              <Input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} placeholder="Ex: CE1 - Groupe A" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Niveau</Label>
              <Select value={form.niveau} onValueChange={(v) => setForm((f) => ({ ...f, niveau: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Sélectionner un niveau" /></SelectTrigger>
                <SelectContent>{levels.map((l) => (<SelectItem key={l.id} value={l.label}>{l.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Professeur</Label>
              <Select value={form.prof_id} onValueChange={(v) => setForm((f) => ({ ...f, prof_id: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Assigner un professeur" /></SelectTrigger>
                <SelectContent>{teachers.map((t) => (<SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Matières</Label>
              {subjects.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune matière configurée.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto rounded-md border p-3">
                  {subjects.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={selectedSubjects.includes(s.id)} onCheckedChange={() => toggleSubject(s.id)} />
                      <span className="truncate">{s.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDialogOpen(false); resetForm(); }} className="text-muted-foreground">Annuler</Button>
            <Button onClick={() => saveClass.mutate()} disabled={saveClass.isPending || !form.nom.trim()} className="gradient-positive border-0">
              {saveClass.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default Classes;
