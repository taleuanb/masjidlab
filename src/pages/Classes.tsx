import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { BookOpen, Trash2, Loader2, Plus, Users, GraduationCap } from "lucide-react";
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
import type { Tables } from "@/integrations/supabase/types";

const Classes = () => {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ nom: "", niveau: "", prof_id: "", salle_id: "" });
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

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

      // Fetch subjects for each class
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

      return (data ?? []).map((c: any) => ({ ...c, subjects: subjectMap[c.id] ?? [] }));
    },
  });

  // ── Reference data ──
  const { data: levels = [] } = useQuery({
    queryKey: ["madrasa_levels", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_levels")
        .select("*")
        .eq("org_id", orgId!)
        .order("label");
      if (error) throw error;
      return data as Tables<"madrasa_levels">[];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["madrasa_subjects", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_subjects")
        .select("*")
        .eq("org_id", orgId!)
        .order("name");
      if (error) throw error;
      return data as Tables<"madrasa_subjects">[];
    },
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["imam_chef", "benevole"]);
      const userIds = (roles ?? []).map((r) => r.user_id);
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, user_id")
        .in("user_id", userIds)
        .eq("org_id", orgId!)
        .order("display_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Mutations ──
  const createClass = useMutation({
    mutationFn: async () => {
      if (!form.nom.trim()) throw new Error("Nom requis");
      const { data: created, error } = await supabase
        .from("madrasa_classes")
        .insert({
          nom: form.nom.trim(),
          niveau: form.niveau || null,
          prof_id: form.prof_id || null,
          salle_id: form.salle_id || null,
          org_id: orgId!,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Link subjects
      if (selectedSubjects.length > 0) {
        const links = selectedSubjects.map((sid) => ({ class_id: created.id, subject_id: sid }));
        const { error: linkErr } = await supabase.from("madrasa_class_subjects").insert(links);
        if (linkErr) throw linkErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["madrasa_classes", orgId] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Classe créée" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteClass = useMutation({
    mutationFn: async (id: string) => {
      // Delete linked subjects first
      await supabase.from("madrasa_class_subjects").delete().eq("class_id", id);
      const { error } = await supabase.from("madrasa_classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["madrasa_classes", orgId] });
      toast({ title: "Classe supprimée" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setForm({ nom: "", niveau: "", prof_id: "", salle_id: "" });
    setSelectedSubjects([]);
  };

  const toggleSubject = (id: string) =>
    setSelectedSubjects((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Classes</h1>
          <Badge variant="secondary" className="ml-1">{classes.length}</Badge>
          <Button size="sm" className="ml-auto" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Nouvelle classe
          </Button>
        </div>

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
            {classes.map((c: any) => (
              <Card key={c.id} className="group relative">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{c.nom}</CardTitle>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer « {c.nom} » ?</AlertDialogTitle>
                          <AlertDialogDescription>Cette action est irréversible. Les inscriptions liées seront également supprimées.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteClass.mutate(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {c.niveau && (
                    <Badge variant="outline" className="text-xs">{c.niveau}</Badge>
                  )}

                  {c.prof?.display_name && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{c.prof.display_name}</span>
                    </div>
                  )}

                  {c.subjects.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {c.subjects.map((s: any) => (
                        <Badge key={s.id} variant="secondary" className="text-[10px] font-normal">
                          {s.name}
                        </Badge>
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
      </div>

      {/* ── Create Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle classe</DialogTitle>
            <DialogDescription>Créez une classe et liez-la à des matières.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Nom de la classe *</Label>
              <Input
                value={form.nom}
                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                placeholder="Ex: CE1 - Groupe A"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Niveau</Label>
              <Select value={form.niveau} onValueChange={(v) => setForm((f) => ({ ...f, niveau: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Sélectionner un niveau" /></SelectTrigger>
                <SelectContent>
                  {levels.map((l) => (
                    <SelectItem key={l.id} value={l.label}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Professeur</Label>
              <Select value={form.prof_id} onValueChange={(v) => setForm((f) => ({ ...f, prof_id: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Assigner un professeur" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Matières</Label>
              {subjects.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune matière configurée. Ajoutez-en dans Configuration &gt; Madrassa.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto rounded-md border p-3">
                  {subjects.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={selectedSubjects.includes(s.id)}
                        onCheckedChange={() => toggleSubject(s.id)}
                      />
                      <span className="truncate">{s.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => createClass.mutate()} disabled={createClass.isPending || !form.nom.trim()}>
              {createClass.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default Classes;
