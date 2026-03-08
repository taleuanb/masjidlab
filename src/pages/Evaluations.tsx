import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ClipboardCheck, Plus, Loader2, ArrowLeft, Save, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

type ClassWithDetails = {
  id: string;
  nom: string;
  niveau: string | null;
  subjects: { id: string; name: string }[];
};

type Evaluation = {
  id: string;
  title: string;
  date: string;
  max_points: number;
  subject_id: string | null;
  subject?: { name: string } | null;
};

const Evaluations = () => {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedEvalId, setSelectedEvalId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [evalForm, setEvalForm] = useState({ title: "", date: undefined as Date | undefined, subject_id: "", max_points: "20" });
  const [grades, setGrades] = useState<Record<string, { score: string; comment: string }>>({});

  // ── Fetch classes ──
  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ["eval_classes", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_classes")
        .select("id, nom, niveau")
        .eq("org_id", orgId!)
        .order("nom");
      if (error) throw error;

      const classIds = (data ?? []).map((c) => c.id);
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
      return (data ?? []).map((c) => ({ ...c, subjects: subjectMap[c.id] ?? [] })) as ClassWithDetails[];
    },
  });

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  // ── Evaluations for selected class ──
  const { data: evaluations = [], isLoading: loadingEvals } = useQuery({
    queryKey: ["evaluations", selectedClassId],
    enabled: !!selectedClassId && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_evaluations")
        .select("*, subject:madrasa_subjects(name)")
        .eq("class_id", selectedClassId!)
        .eq("org_id", orgId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Evaluation[];
    },
  });

  const selectedEval = evaluations.find((e) => e.id === selectedEvalId);

  // ── Students enrolled in class ──
  const { data: students = [] } = useQuery({
    queryKey: ["eval_students", selectedClassId],
    enabled: !!selectedClassId && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_enrollments")
        .select("student_id, student:madrasa_students(id, nom, prenom)")
        .eq("class_id", selectedClassId!)
        .eq("org_id", orgId!)
        .eq("statut", "Actif");
      if (error) throw error;
      return (data ?? []).map((e: any) => e.student).filter(Boolean) as { id: string; nom: string; prenom: string }[];
    },
  });

  // ── Existing grades for selected eval ──
  const { data: existingGrades = [] } = useQuery({
    queryKey: ["grades", selectedEvalId],
    enabled: !!selectedEvalId && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_grades")
        .select("*")
        .eq("evaluation_id", selectedEvalId!)
        .eq("org_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Initialize grades when eval or existing grades change
  useMemo(() => {
    if (!selectedEvalId || students.length === 0) return;
    const map: Record<string, { score: string; comment: string }> = {};
    for (const s of students) {
      const existing = existingGrades.find((g) => g.student_id === s.id);
      map[s.id] = {
        score: existing?.score != null ? String(existing.score) : "",
        comment: existing?.comment ?? "",
      };
    }
    setGrades(map);
  }, [selectedEvalId, students, existingGrades]);

  // ── Create evaluation ──
  const createEval = useMutation({
    mutationFn: async () => {
      if (!evalForm.title.trim() || !evalForm.date) throw new Error("Titre et date requis");
      const { error } = await supabase.from("madrasa_evaluations").insert({
        title: evalForm.title.trim(),
        date: format(evalForm.date, "yyyy-MM-dd"),
        subject_id: evalForm.subject_id || null,
        max_points: Number(evalForm.max_points) || 20,
        class_id: selectedClassId!,
        org_id: orgId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluations", selectedClassId] });
      setDialogOpen(false);
      setEvalForm({ title: "", date: undefined, subject_id: "", max_points: "20" });
      toast({ title: "Évaluation créée avec succès" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // ── Save grades ──
  const saveGrades = useMutation({
    mutationFn: async () => {
      if (!selectedEvalId || !orgId) throw new Error("Données manquantes");
      const maxPts = selectedEval?.max_points ?? 20;
      const rows = Object.entries(grades).map(([student_id, { score, comment }]) => {
        const numScore = score === "" ? null : Number(score);
        if (numScore !== null && (isNaN(numScore) || numScore < 0 || numScore > maxPts)) {
          throw new Error(`Note invalide pour un élève (max ${maxPts})`);
        }
        return { evaluation_id: selectedEvalId, student_id, org_id: orgId, score: numScore, comment: comment || null };
      });

      // Upsert: delete existing then insert
      await supabase.from("madrasa_grades").delete().eq("evaluation_id", selectedEvalId).eq("org_id", orgId);
      if (rows.length > 0) {
        const { error } = await supabase.from("madrasa_grades").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades", selectedEvalId] });
      toast({ title: "Notes enregistrées", description: `${Object.keys(grades).length} notes sauvegardées.` });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // ── Average KPI ──
  const average = useMemo(() => {
    const scores = Object.values(grades).map((g) => Number(g.score)).filter((n) => !isNaN(n) && g.score !== "");
    // Need to re-check with proper filter
    const validScores = Object.values(grades).filter((g) => g.score !== "" && !isNaN(Number(g.score))).map((g) => Number(g.score));
    if (validScores.length === 0) return null;
    return validScores.reduce((a, b) => a + b, 0) / validScores.length;
  }, [grades]);

  // ── GRADE ENTRY VIEW ──
  if (selectedEvalId && selectedEval) {
    const maxPts = selectedEval.max_points ?? 20;
    return (
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="icon" onClick={() => setSelectedEvalId(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">{selectedEval.title}</h1>
              <p className="text-sm text-muted-foreground">
                {selectedClass?.nom} • {format(new Date(selectedEval.date), "d MMMM yyyy", { locale: fr })} • Barème /{maxPts}
              </p>
            </div>
            <Button onClick={() => saveGrades.mutate()} disabled={saveGrades.isPending} className="shrink-0">
              {saveGrades.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </Button>
          </div>

          {/* Average KPI */}
          {average !== null && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Moyenne de la classe</p>
                  <p className="text-2xl font-bold text-primary">{average.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">/ {maxPts}</span></p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grades table */}
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun élève inscrit dans cette classe.</p>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Élève</TableHead>
                    <TableHead className="w-[120px]">Note /{maxPts}</TableHead>
                    <TableHead>Commentaire</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => {
                    const g = grades[s.id] ?? { score: "", comment: "" };
                    const scoreNum = Number(g.score);
                    const isInvalid = g.score !== "" && (isNaN(scoreNum) || scoreNum < 0 || scoreNum > maxPts);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.prenom} {s.nom}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={maxPts}
                            step={0.5}
                            value={g.score}
                            onChange={(e) => setGrades((prev) => ({ ...prev, [s.id]: { ...prev[s.id], score: e.target.value } }))}
                            className={cn("h-9 w-20", isInvalid && "border-destructive focus-visible:ring-destructive")}
                            placeholder="—"
                          />
                          {isInvalid && <p className="text-[10px] text-destructive mt-0.5">Max {maxPts}</p>}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={g.comment}
                            onChange={(e) => setGrades((prev) => ({ ...prev, [s.id]: { ...prev[s.id], comment: e.target.value } }))}
                            className="h-9"
                            placeholder="Commentaire optionnel"
                            maxLength={200}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </main>
    );
  }

  // ── EVALUATIONS LIST VIEW (per class) ──
  if (selectedClassId && selectedClass) {
    return (
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="icon" onClick={() => setSelectedClassId(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <ClipboardCheck className="h-5 w-5 text-accent" />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-foreground">{selectedClass.nom}</h1>
              <p className="text-sm text-muted-foreground">Évaluations • {students.length} élèves inscrits</p>
            </div>
            <Button size="sm" onClick={() => { setEvalForm({ title: "", date: undefined, subject_id: "", max_points: "20" }); setDialogOpen(true); }}>
              <Plus className="h-4 w-4" /> Nouvel examen
            </Button>
          </div>

          {loadingEvals ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : evaluations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">Aucune évaluation créée pour cette classe.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {evaluations.map((ev) => (
                <Card key={ev.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSelectedEvalId(ev.id)}>
                  <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{ev.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(ev.date), "d MMM yyyy", { locale: fr })}
                        {ev.subject?.name && ` • ${ev.subject.name}`}
                      </p>
                    </div>
                    <Badge variant="outline">/{ev.max_points ?? 20}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Create Evaluation Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nouvel examen</DialogTitle>
              <DialogDescription>Créez une évaluation pour {selectedClass.nom}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-1">
              <div className="space-y-1.5">
                <Label className="text-xs">Titre *</Label>
                <Input value={evalForm.title} onChange={(e) => setEvalForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex: Contrôle de Tajwid" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal", !evalForm.date && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {evalForm.date ? format(evalForm.date, "d MMMM yyyy", { locale: fr }) : "Sélectionner une date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={evalForm.date} onSelect={(d) => setEvalForm((f) => ({ ...f, date: d }))} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Matière</Label>
                <Select value={evalForm.subject_id} onValueChange={(v) => setEvalForm((f) => ({ ...f, subject_id: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Sélectionner une matière" /></SelectTrigger>
                  <SelectContent>
                    {selectedClass.subjects.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Barème</Label>
                <Input type="number" value={evalForm.max_points} onChange={(e) => setEvalForm((f) => ({ ...f, max_points: e.target.value }))} min={1} max={100} className="h-9 w-24" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-muted-foreground">Annuler</Button>
              <Button onClick={() => createEval.mutate()} disabled={createEval.isPending || !evalForm.title.trim() || !evalForm.date}>
                {createEval.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    );
  }

  // ── CLASS SELECTION VIEW ──
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <ClipboardCheck className="h-5 w-5 text-accent" />
          <h1 className="text-xl font-bold text-foreground">Évaluations & Notes</h1>
        </div>

        <p className="text-sm text-muted-foreground">Sélectionnez une classe pour gérer ses évaluations et saisir les notes.</p>

        {loadingClasses ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : classes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">Aucune classe configurée.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((c) => (
              <Card key={c.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSelectedClassId(c.id)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{c.nom}</CardTitle>
                  {c.niveau && <CardDescription>{c.niveau}</CardDescription>}
                </CardHeader>
                <CardContent>
                  {c.subjects.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {c.subjects.map((s) => (
                        <Badge key={s.id} variant="secondary" className="text-[10px] font-normal">{s.name}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default Evaluations;
