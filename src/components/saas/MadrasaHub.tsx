import React, { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Plus, Trash2, Loader2, CalendarDays, ShieldCheck,
  GraduationCap, Layers, BookOpen, Settings2, Star,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { TrackingConfigTab } from "@/components/madrasa/TrackingConfigTab";
import { CommunicationsTab } from "@/components/madrasa/CommunicationsTab";

/* ═══════════════════════════════════════════════════════════════════════════
   Shared helpers
   ═══════════════════════════════════════════════════════════════════════════ */

function DatePickerField({ label, date, onSelect }: { label: string; date: Date | undefined; onSelect: (d: Date | undefined) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
            <CalendarDays className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP", { locale: fr }) : "Sélectionner…"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. PILOTAGE — Années Scolaires
   ═══════════════════════════════════════════════════════════════════════════ */

function AcademicYearsSection() {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const { data: years = [], isLoading } = useQuery({
    queryKey: ["madrasa_academic_years", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_academic_years")
        .select("*")
        .eq("org_id", orgId!)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as Tables<"madrasa_academic_years">[];
    },
  });

  const addYear = useMutation({
    mutationFn: async () => {
      if (!label.trim()) throw new Error("Le label est requis");
      const { error } = await supabase.from("madrasa_academic_years").insert({
        label: label.trim(),
        org_id: orgId!,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        is_current: years.length === 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["madrasa_academic_years", orgId] });
      setLabel(""); setStartDate(undefined); setEndDate(undefined);
      toast({ title: "Année scolaire créée" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const setCurrent = useMutation({
    mutationFn: async (id: string) => {
      // Reset all first
      const { error: e1 } = await supabase
        .from("madrasa_academic_years")
        .update({ is_current: false })
        .eq("org_id", orgId!);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("madrasa_academic_years")
        .update({ is_current: true })
        .eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["madrasa_academic_years", orgId] });
      toast({ title: "Année courante mise à jour" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteYear = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("madrasa_academic_years").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["madrasa_academic_years", orgId] });
      toast({ title: "Année supprimée" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const fmtDate = (d: string | null) => d ? format(new Date(d), "d MMM yyyy", { locale: fr }) : "—";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarDays className="h-5 w-5" /> Années Scolaires
        </CardTitle>
        <CardDescription>Définissez les sessions scolaires et activez l'année en cours.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Label *</Label>
            <Input placeholder="Ex: 2025-2026" value={label} onChange={(e) => setLabel(e.target.value)} className="h-9" />
          </div>
          <DatePickerField label="Début" date={startDate} onSelect={setStartDate} />
          <DatePickerField label="Fin" date={endDate} onSelect={setEndDate} />
          <Button onClick={() => addYear.mutate()} disabled={addYear.isPending} size="sm" className="h-9">
            {addYear.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Ajouter
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : years.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Aucune année scolaire configurée.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Période</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-center">Courante</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {years.map((y) => (
                <TableRow key={y.id}>
                  <TableCell className="font-medium">{y.label}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fmtDate(y.start_date)} → {fmtDate(y.end_date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={y.status === "open" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground"}>
                      {y.status === "open" ? "Ouverte" : y.status === "closed" ? "Clôturée" : y.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {y.is_current ? (
                      <Star className="h-4 w-4 text-amber-500 mx-auto fill-amber-500" />
                    ) : (
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrent.mutate(y.id)}>
                        Activer
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteYear.mutate(y.id)} disabled={!!y.is_current}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. PILOTAGE — Cycles
   ═══════════════════════════════════════════════════════════════════════════ */

function CyclesSection() {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [nom, setNom] = useState("");
  const [desc, setDesc] = useState("");

  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ["madrasa_cycles", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_cycles")
        .select("*")
        .eq("org_id", orgId!)
        .order("nom");
      if (error) throw error;
      return data as Tables<"madrasa_cycles">[];
    },
  });

  const addCycle = useMutation({
    mutationFn: async () => {
      if (!nom.trim()) throw new Error("Le nom est requis");
      const { error } = await supabase.from("madrasa_cycles").insert({
        nom: nom.trim(),
        description: desc.trim() || null,
        org_id: orgId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["madrasa_cycles", orgId] });
      setNom(""); setDesc("");
      toast({ title: "Cycle créé" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteCycle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("madrasa_cycles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["madrasa_cycles", orgId] });
      toast({ title: "Cycle supprimé" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="h-5 w-5" /> Cycles
        </CardTitle>
        <CardDescription>Regroupez vos niveaux par type d'école (ex: Enfants, Adultes, Intensif).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <Input placeholder="Nom du cycle" value={nom} onChange={(e) => setNom(e.target.value)} className="h-9" />
          <Input placeholder="Description (optionnel)" value={desc} onChange={(e) => setDesc(e.target.value)} className="h-9" />
          <Button onClick={() => addCycle.mutate()} disabled={addCycle.isPending} size="sm" className="h-9">
            {addCycle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Ajouter
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : cycles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Aucun cycle configuré. Créez vos types d'écoles pour structurer le cursus.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cycles.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nom}</TableCell>
                  <TableCell className="text-muted-foreground">{c.description ?? "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteCycle.mutate(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. PILOTAGE — Calendrier Scolaire
   ═══════════════════════════════════════════════════════════════════════════ */

const CALENDAR_TYPE_OPTIONS = [
  { value: "holiday", label: "Fermeture / Vacances", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "exam", label: "Période d'examens", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "pedagogical", label: "Jalon interne", color: "bg-sky-100 text-sky-700 border-sky-200" },
] as const;

function calendarTypeBadge(type: string) {
  const opt = CALENDAR_TYPE_OPTIONS.find((o) => o.value === type);
  return opt ?? { label: type, color: "bg-muted text-muted-foreground" };
}

function CalendarSection() {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("holiday");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [affectsClasses, setAffectsClasses] = useState(true);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["madrasa_calendar", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_calendar")
        .select("*")
        .eq("org_id", orgId!)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data as Tables<"madrasa_calendar">[];
    },
  });

  const addEntry = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Le titre est requis");
      if (!startDate || !endDate) throw new Error("Les dates sont requises");
      if (endDate < startDate) throw new Error("La date de fin doit être après le début");
      const { error } = await supabase.from("madrasa_calendar").insert({
        title: title.trim(), type,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        affects_classes: affectsClasses,
        org_id: orgId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["madrasa_calendar", orgId] });
      resetForm();
      toast({ title: "Période ajoutée" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("madrasa_calendar").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["madrasa_calendar", orgId] });
      toast({ title: "Période supprimée" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  function resetForm() {
    setTitle(""); setType("holiday"); setStartDate(undefined); setEndDate(undefined);
    setAffectsClasses(true); setOpen(false);
  }

  const fmtDate = (d: string) => format(new Date(d), "d MMM yyyy", { locale: fr });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5" /> Calendrier Scolaire
            </CardTitle>
            <CardDescription>Fermetures, vacances et jalons qui impactent l'assiduité.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune période configurée. Ajoutez vos vacances et jalons pour protéger l'assiduité.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">Cours suspendus</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const badge = calendarTypeBadge(e.type);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.title}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {fmtDate(e.start_date)} → {fmtDate(e.end_date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badge.color}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {e.affects_classes ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <ShieldCheck className="h-4 w-4 text-emerald-500 mx-auto" />
                              </TooltipTrigger>
                              <TooltipContent>L'assiduité est protégée pendant cette période</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-xs text-muted-foreground">Non</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteEntry.mutate(e.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog ajout période */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle période</DialogTitle>
            <DialogDescription>Ajoutez une fermeture, vacance ou jalon au calendrier scolaire.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input placeholder="Ex: Vacances d'Hiver, Aïd al-Fitr…" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CALENDAR_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DatePickerField label="Début" date={startDate} onSelect={setStartDate} />
              <DatePickerField label="Fin" date={endDate} onSelect={setEndDate} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Suspendre les cours</Label>
                <p className="text-xs text-muted-foreground">Protège l'assiduité des élèves</p>
              </div>
              <Switch checked={affectsClasses} onCheckedChange={setAffectsClasses} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Annuler</Button>
            <Button onClick={() => addEntry.mutate()} disabled={addEntry.isPending}>
              {addEntry.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. CURSUS — Matières (from MadrasaSettingsPanel)
   ═══════════════════════════════════════════════════════════════════════════ */

function SubjectsSection() {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["madrasa_subjects", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_subjects").select("*").eq("org_id", orgId!).order("name");
      if (error) throw error;
      return data as Tables<"madrasa_subjects">[];
    },
  });

  const addSubject = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error("Nom requis");
      const { error } = await supabase.from("madrasa_subjects").insert({ name: newName.trim(), org_id: orgId! });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["madrasa_subjects", orgId] }); setNewName(""); toast({ title: "Matière ajoutée" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteSubject = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("madrasa_subjects").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["madrasa_subjects", orgId] }); toast({ title: "Matière supprimée" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><BookOpen className="h-5 w-5" /> Matières</CardTitle>
        <CardDescription>Catalogue de matières enseignées.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Nom de la matière…" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSubject.mutate()} />
          <Button onClick={() => addSubject.mutate()} disabled={addSubject.isPending} size="sm"><Plus className="h-4 w-4" /> Ajouter</Button>
        </div>
        {isLoading ? (
          <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucune matière configurée.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Nom</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
            <TableBody>
              {subjects.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => deleteSubject.mutate(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. CURSUS — Niveaux (from MadrasaSettingsPanel)
   ═══════════════════════════════════════════════════════════════════════════ */

function LevelsSection() {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [desc, setDesc] = useState("");
  const [tarif, setTarif] = useState("");
  const [cycleId, setCycleId] = useState("");

  const { data: levels = [], isLoading } = useQuery({
    queryKey: ["madrasa_levels", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_levels").select("*, madrasa_cycles(nom)").eq("org_id", orgId!).order("label");
      if (error) throw error;
      return data;
    },
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ["madrasa_cycles", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_cycles").select("*").eq("org_id", orgId!).order("nom");
      if (error) throw error;
      return data as Tables<"madrasa_cycles">[];
    },
  });

  const addLevel = useMutation({
    mutationFn: async () => {
      if (!label.trim()) throw new Error("Label requis");
      const { error } = await supabase.from("madrasa_levels").insert({
        label: label.trim(),
        description: desc.trim() || null,
        tarif_mensuel: tarif ? Number(tarif) : 0,
        cycle_id: cycleId || null,
        org_id: orgId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["madrasa_levels", orgId] });
      setLabel(""); setDesc(""); setTarif(""); setCycleId("");
      toast({ title: "Niveau ajouté" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteLevel = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("madrasa_levels").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["madrasa_levels", orgId] }); toast({ title: "Niveau supprimé" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const fmt = (n: number | null) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Layers className="h-5 w-5" /> Niveaux</CardTitle>
        <CardDescription>Définissez les niveaux scolaires, rattachez-les à un cycle et fixez le tarif.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-5">
          <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} className="h-9" />
          <Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} className="h-9" />
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Cycle…" /></SelectTrigger>
            <SelectContent>
              {cycles.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" min={0} placeholder="Tarif (€)" value={tarif} onChange={(e) => setTarif(e.target.value)} className="h-9" />
          <Button onClick={() => addLevel.mutate()} disabled={addLevel.isPending} size="sm" className="h-9">
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : levels.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun niveau configuré.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Tarif</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {levels.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.label}</TableCell>
                  <TableCell>
                    {l.madrasa_cycles?.nom ? (
                      <Badge variant="outline">{l.madrasa_cycles.nom}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.description ?? "—"}</TableCell>
                  <TableCell className="text-right">{fmt(l.tarif_mensuel)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteLevel.mutate(l.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. PARAMÈTRES — Général (from MadrasaSettingsPanel)
   ═══════════════════════════════════════════════════════════════════════════ */

function GeneralSettingsSection() {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["madrasa_settings", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_settings").select("*").eq("org_id", orgId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [billingCycle, setBillingCycle] = useState("");
  const [threshold, setThreshold] = useState("");
  const [currency, setCurrency] = useState("");

  React.useEffect(() => {
    if (settings) {
      setBillingCycle(settings.billing_cycle ?? "mensuel");
      setThreshold(String(settings.attendance_threshold ?? 3));
      setCurrency(settings.currency ?? "EUR");
    }
  }, [settings]);

  const upsert = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("madrasa_settings").upsert({
        org_id: orgId!, billing_cycle: billingCycle,
        attendance_threshold: Number(threshold), currency,
      }, { onConflict: "org_id" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["madrasa_settings", orgId] }); toast({ title: "Paramètres enregistrés" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Paramètres généraux</CardTitle>
        <CardDescription>Configuration de base du module Éducation.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Cycle de facturation</Label>
          <Select value={billingCycle} onValueChange={setBillingCycle}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mensuel">Mensuel</SelectItem>
              <SelectItem value="trimestriel">Trimestriel</SelectItem>
              <SelectItem value="annuel">Annuel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Seuil d'absences</Label>
          <Input type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Devise</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EUR">EUR (€)</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="GBP">GBP (£)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-3 flex justify-end">
          <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN HUB
   ═══════════════════════════════════════════════════════════════════════════ */

export function MadrasaHub() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="pilotage" className="space-y-4">
        <TabsList className="grid w-full max-w-xl grid-cols-4">
          <TabsTrigger value="pilotage" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" /> Pilotage
          </TabsTrigger>
          <TabsTrigger value="cursus" className="gap-1.5 text-xs">
            <BookOpen className="h-3.5 w-3.5" /> Cursus
          </TabsTrigger>
          <TabsTrigger value="classes" className="gap-1.5 text-xs">
            <GraduationCap className="h-3.5 w-3.5" /> Classes
          </TabsTrigger>
          <TabsTrigger value="parametres" className="gap-1.5 text-xs">
            <Settings2 className="h-3.5 w-3.5" /> Paramètres
          </TabsTrigger>
        </TabsList>

        {/* 1. Pilotage */}
        <TabsContent value="pilotage" className="space-y-6">
          <AcademicYearsSection />
          <CyclesSection />
          <CalendarSection />
        </TabsContent>

        {/* 2. Cursus */}
        <TabsContent value="cursus" className="space-y-6">
          <SubjectsSection />
          <LevelsSection />
          <TrackingConfigTab />
        </TabsContent>

        {/* 3. Classes — placeholder for now */}
        <TabsContent value="classes" className="space-y-6">
          <Card>
            <CardContent className="py-12 text-center">
              <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                La gestion des classes est accessible depuis le menu <strong>Éducation → Classes</strong>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. Paramètres */}
        <TabsContent value="parametres" className="space-y-6">
          <GeneralSettingsSection />
          <CommunicationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
