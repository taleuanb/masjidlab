import React, { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Plus, Trash2, Loader2, CalendarDays, ShieldCheck,
  GraduationCap, Layers, BookOpen, Settings2, Star,
  BarChart3, Eye, GripVertical, ChevronUp, ChevronDown,
  AlertTriangle, Users, Pencil, MessageCircle, FileText,
  Clock, LayoutGrid, ChevronRight, FolderOpen, Folder,
  Sparkles, RefreshCw, Tag, Inbox,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
import type { Json, Tables } from "@/integrations/supabase/types";
import { CommunicationsTab } from "@/components/madrasa/CommunicationsTab";
import { LaunchpadWizard } from "@/components/madrasa/LaunchpadWizard";

/* ── Tracking types ── */
interface FormField {
  key: string;
  label: string;
  type: "text" | "number" | "rating5" | "rating10" | "checkbox";
  required: boolean;
}
const FIELD_TYPE_LABELS: Record<FormField["type"], string> = {
  text: "Texte", number: "Nombre", rating5: "Note sur 5", rating10: "Note sur 10", checkbox: "Case à cocher",
};
const SUBJECT_CATEGORIES = [
  { value: "quran", label: "Coran" },
  { value: "arabic", label: "Arabe" },
  { value: "fiqh", label: "Fiqh" },
  { value: "sira", label: "Sîra / Histoire" },
  { value: "aqida", label: "'Aqîda" },
  { value: "other", label: "Autre" },
] as const;

/* ── Shared helpers ── */

const CATEGORY_COLORS: Record<string, string> = {
  quran: "bg-emerald-100 text-emerald-800 border-emerald-300",
  arabic: "bg-cyan-100 text-cyan-800 border-cyan-300",
  fiqh: "bg-amber-100 text-amber-800 border-amber-300",
  sira: "bg-violet-100 text-violet-800 border-violet-300",
  aqida: "bg-indigo-100 text-indigo-800 border-indigo-300",
  other: "bg-muted text-muted-foreground border-border",
};

function EmptyState({ icon: Icon, message, hint }: { icon: React.ElementType; message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed rounded-lg bg-muted/10">
      <Icon className="h-8 w-8 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      {hint && <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">{hint}</p>}
    </div>
  );
}

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
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs">Label *</Label>
          <Input placeholder="Ex: 2025-2026" value={label} onChange={(e) => setLabel(e.target.value)} className="h-9" />
        </div>
        <DatePickerField label="Début" date={startDate} onSelect={setStartDate} />
        <DatePickerField label="Fin" date={endDate} onSelect={setEndDate} />
        <Button onClick={() => addYear.mutate()} disabled={addYear.isPending} size="sm" className="h-9 bg-[hsl(var(--brand-navy))] hover:bg-[hsl(var(--brand-navy))]/90 text-white">
          {addYear.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Ajouter
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : years.length === 0 ? (
        <EmptyState icon={CalendarDays} message="Aucune année scolaire configurée." hint="Créez votre première année scolaire pour commencer à planifier." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Label</TableHead>
              <TableHead>Période</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-center">Courante</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {years.map((y) => (
              <TableRow key={y.id} className="hover:bg-muted/30">
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
    </div>
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
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder="Nom du cycle" value={nom} onChange={(e) => setNom(e.target.value)} className="h-9" />
        <Input placeholder="Description (optionnel)" value={desc} onChange={(e) => setDesc(e.target.value)} className="h-9" />
        <Button onClick={() => addCycle.mutate()} disabled={addCycle.isPending} size="sm" className="h-9 bg-[hsl(var(--brand-navy))] hover:bg-[hsl(var(--brand-navy))]/90 text-white">
          {addCycle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Ajouter
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : cycles.length === 0 ? (
        <EmptyState icon={RefreshCw} message="Aucun cycle configuré." hint="Utilisez le Launchpad ou cliquez sur 'Ajouter' pour créer vos types d'écoles." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Nom</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cycles.map((c) => (
              <TableRow key={c.id} className="hover:bg-muted/30">
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
    </div>
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
   Tracking — Form Preview & Builder (inlined from TrackingConfigTab)
   ═══════════════════════════════════════════════════════════════════════════ */

function FormPreview({ fields }: { fields: FormField[] }) {
  if (fields.length === 0) return <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-12">Ajoutez des champs pour voir la prévisualisation.</div>;
  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label className="text-sm">{f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}</Label>
          {f.type === "text" && <Input disabled placeholder={`Saisir ${f.label.toLowerCase()}…`} className="bg-muted/30" />}
          {f.type === "number" && <Input type="number" disabled placeholder="0" className="bg-muted/30 w-32" />}
          {(f.type === "rating5" || f.type === "rating10") && <Select disabled><SelectTrigger className="w-32 bg-muted/30"><SelectValue placeholder={`/ ${f.type === "rating5" ? 5 : 10}`} /></SelectTrigger></Select>}
          {f.type === "checkbox" && <div className="flex items-center gap-2"><Checkbox disabled /><span className="text-sm text-muted-foreground">{f.label}</span></div>}
        </div>
      ))}
      <Separator className="my-3" />
      <div className="space-y-1.5"><Label className="text-sm">À faire (prochaine séance)</Label><Input disabled placeholder="Devoirs / objectifs…" className="bg-muted/30" /></div>
    </div>
  );
}

function FormBuilderDialog({ open, onOpenChange, subject, orgId }: { open: boolean; onOpenChange: (v: boolean) => void; subject: Tables<"madrasa_subjects">; orgId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ["session_config", subject.id, orgId], enabled: open && !!orgId,
    queryFn: async () => { const { data, error } = await supabase.from("madrasa_session_configs").select("*").eq("subject_id", subject.id).eq("org_id", orgId).maybeSingle(); if (error) throw error; return data; },
  });
  const [fields, setFields] = React.useState<FormField[]>([]);
  const [initialized, setInitialized] = React.useState(false);
  React.useEffect(() => { if (!open) { setInitialized(false); return; } if (isLoading || initialized) return; if (existingConfig?.form_schema_json) { try { const parsed = existingConfig.form_schema_json as unknown as FormField[]; setFields(Array.isArray(parsed) ? parsed : []); } catch { setFields([]); } } else { setFields([]); } setInitialized(true); }, [open, isLoading, existingConfig, initialized]);
  const addField = () => setFields((p) => [...p, { key: `field_${Date.now()}`, label: "", type: "text", required: false }]);
  const updateField = (idx: number, patch: Partial<FormField>) => setFields((p) => p.map((f, i) => i === idx ? { ...f, ...patch } : f));
  const removeField = (idx: number) => setFields((p) => p.filter((_, i) => i !== idx));
  const moveField = (idx: number, dir: -1 | 1) => { const t = idx + dir; if (t < 0 || t >= fields.length) return; setFields((p) => { const c = [...p]; [c[idx], c[t]] = [c[t], c[idx]]; return c; }); };
  const saveMutation = useMutation({
    mutationFn: async () => {
      const clean = fields.filter((f) => f.label.trim());
      if (clean.length === 0) throw new Error("Ajoutez au moins un champ.");
      const final = clean.map((f, i) => ({ ...f, key: f.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `champ_${i}` }));
      const schemaJson = final as unknown as Json;
      if (existingConfig?.id) { const { error } = await supabase.from("madrasa_session_configs").update({ form_schema_json: schemaJson }).eq("id", existingConfig.id); if (error) throw error; }
      else { const { error } = await supabase.from("madrasa_session_configs").insert({ subject_id: subject.id, org_id: orgId, form_schema_json: schemaJson }); if (error) throw error; }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["session_config", subject.id, orgId] }); queryClient.invalidateQueries({ queryKey: ["session_configs_all", orgId] }); toast({ title: `Configuration enregistrée pour ${subject.name} ✓` }); onOpenChange(false); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg"><Settings2 className="h-5 w-5 text-primary" /> Formulaire de suivi — {subject.name}</DialogTitle>
          <DialogDescription>Configurez les champs que l'Oustaz devra remplir après chaque séance.</DialogDescription>
        </DialogHeader>
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-12 text-muted-foreground" /> : (
          <div className="flex-1 min-h-0 overflow-y-auto px-6">
            <div className="grid md:grid-cols-2 gap-6 pb-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Champs du formulaire</h4>
                  <Button size="sm" variant="outline" onClick={addField}><Plus className="h-4 w-4" /> Ajouter un champ</Button>
                </div>
                {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucun champ configuré.</p>}
                <div className="space-y-2">
                  {fields.map((field, idx) => (
                    <Card key={field.key} className="rounded-lg border bg-card">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                          <Input placeholder="Label du champ…" value={field.label} onChange={(e) => updateField(idx, { label: e.target.value })} className="flex-1 h-8 text-sm" />
                          <div className="flex gap-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveField(idx, -1)} disabled={idx === 0}><ChevronUp className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1}><ChevronDown className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeField(idx)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Select value={field.type} onValueChange={(v) => updateField(idx, { type: v as FormField["type"] })}>
                            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>{Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}</SelectContent>
                          </Select>
                          <div className="flex items-center gap-1.5 ml-auto"><Switch checked={field.required} onCheckedChange={(v) => updateField(idx, { required: v })} className="scale-75" /><span className="text-xs text-muted-foreground">Requis</span></div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3"><Eye className="h-4 w-4 text-muted-foreground" /><h4 className="font-semibold text-sm">Prévisualisation Oustaz</h4></div>
                <Card className="rounded-lg border-dashed bg-muted/20"><CardContent className="p-4"><FormPreview fields={fields} /></CardContent></Card>
              </div>
            </div>
          </div>
        )}
        <div className="shrink-0 border-t bg-background px-6 py-4">
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || fields.length === 0}>
              {saveMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</> : "Enregistrer la configuration"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. CURSUS — Matières + Suivi intégré
   ═══════════════════════════════════════════════════════════════════════════ */

function SubjectsSection() {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<Tables<"madrasa_subjects"> | null>(null);

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["madrasa_subjects", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_subjects").select("*").eq("org_id", orgId!).order("category").order("name");
      if (error) throw error;
      return data as Tables<"madrasa_subjects">[];
    },
  });

  const { data: configs = [] } = useQuery({
    queryKey: ["session_configs_all", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_session_configs").select("subject_id, form_schema_json").eq("org_id", orgId!);
      if (error) throw error;
      return data;
    },
  });
  const configuredSet = new Set(configs.map((c) => c.subject_id));

  const addSubject = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error("Nom requis");
      const { error } = await supabase.from("madrasa_subjects").insert({
        name: newName.trim(),
        category: newCategory || null,
        org_id: orgId!,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["madrasa_subjects", orgId] }); setNewName(""); setNewCategory(""); toast({ title: "Matière ajoutée" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteSubject = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("madrasa_subjects").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["madrasa_subjects", orgId] }); toast({ title: "Matière supprimée" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const catLabel = (cat: string | null) => SUBJECT_CATEGORIES.find(c => c.value === cat)?.label ?? cat ?? "—";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><BookOpen className="h-5 w-5" /> Matières & Suivi</CardTitle>
          <CardDescription>Catalogue de matières enseignées et configuration des formulaires de suivi par matière.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Nom de la matière…" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSubject.mutate()} className="h-9" />
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Catégorie…" /></SelectTrigger>
              <SelectContent>
                {SUBJECT_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => addSubject.mutate()} disabled={addSubject.isPending} size="sm" className="h-9">
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          </div>
          {isLoading ? (
            <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune matière configurée.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Suivi</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((s) => {
                  const configured = configuredSet.has(s.id);
                  const fieldCount = configured ? ((configs.find((c) => c.subject_id === s.id)?.form_schema_json as unknown as FormField[])?.length ?? 0) : 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>
                        {s.category ? <Badge variant="outline">{catLabel(s.category)}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant={configured ? "outline" : "secondary"} className="text-xs h-7" onClick={() => setSelectedSubject(s)}>
                          <Settings2 className="h-3.5 w-3.5 mr-1" />
                          {configured ? `${fieldCount} champ(s)` : "Configurer"}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteSubject.mutate(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {selectedSubject && orgId && (
        <FormBuilderDialog open={!!selectedSubject} onOpenChange={(v) => !v && setSelectedSubject(null)} subject={selectedSubject} orgId={orgId} />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. CURSUS — Niveaux groupés par Cycle
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
      if (!cycleId) throw new Error("Le cycle est obligatoire");
      const { error } = await supabase.from("madrasa_levels").insert({
        label: label.trim(),
        description: desc.trim() || null,
        tarif_mensuel: tarif ? Number(tarif) : 0,
        cycle_id: cycleId,
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

  // Group levels by cycle
  const grouped = React.useMemo(() => {
    const map = new Map<string, { cycleName: string; items: any[] }>();
    const orphans: any[] = [];
    for (const l of levels as any[]) {
      const cId = l.cycle_id as string | null;
      const cName = l.madrasa_cycles?.nom as string | undefined;
      if (cId && cName) {
        if (!map.has(cId)) map.set(cId, { cycleName: cName, items: [] });
        map.get(cId)!.items.push(l);
      } else {
        orphans.push(l);
      }
    }
    return { groups: Array.from(map.entries()), orphans };
  }, [levels]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Layers className="h-5 w-5" /> Niveaux</CardTitle>
        <CardDescription>Définissez les niveaux scolaires, rattachez-les à un cycle et fixez le tarif.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {cycles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Créez d'abord un <strong>Cycle</strong> dans l'onglet Pilotage avant d'ajouter des niveaux.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-5">
            <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} className="h-9" />
            <Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} className="h-9" />
            <Select value={cycleId} onValueChange={setCycleId}>
              <SelectTrigger className={cn("h-9", !cycleId && "text-muted-foreground")}><SelectValue placeholder="Cycle *" /></SelectTrigger>
              <SelectContent>
                {cycles.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" min={0} placeholder="Tarif (€)" value={tarif} onChange={(e) => setTarif(e.target.value)} className="h-9" />
            <Button onClick={() => addLevel.mutate()} disabled={addLevel.isPending || !cycleId} size="sm" className="h-9">
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : levels.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun niveau configuré.</p>
        ) : (
          <div className="space-y-6">
            {grouped.groups.map(([cId, { cycleName, items }]) => (
              <div key={cId}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs">{cycleName}</Badge>
                  <span className="text-xs text-muted-foreground">{items.length} niveau(x)</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Tarif</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.label}</TableCell>
                        <TableCell className="text-muted-foreground">{l.description ?? "—"}</TableCell>
                        <TableCell className="text-right">{fmt(l.tarif_mensuel)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => deleteLevel.mutate(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
            {grouped.orphans.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs text-muted-foreground">Sans cycle</Badge>
                </div>
                <Table>
                  <TableHeader><TableRow><TableHead>Label</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Tarif</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
                  <TableBody>
                    {grouped.orphans.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.label}</TableCell>
                        <TableCell className="text-muted-foreground">{l.description ?? "—"}</TableCell>
                        <TableCell className="text-right">{fmt(l.tarif_mensuel)}</TableCell>
                        <TableCell><Button variant="ghost" size="icon" onClick={() => deleteLevel.mutate(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. CLASSES — CRUD complet + Planning
   ═══════════════════════════════════════════════════════════════════════════ */

const DAY_LABELS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"] as const;

interface ScheduleSlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject_ids: string[];
}

function ClassesSection() {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ nom: "", levelId: "", salleId: "", capacityMax: "15", profId: "" });
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);

  // Current academic year
  const { data: currentYear } = useQuery({
    queryKey: ["madrasa_academic_years_current", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_academic_years").select("*").eq("org_id", orgId!).eq("is_current", true).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["madrasa_classes", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_classes")
        .select("*, madrasa_levels(label, madrasa_cycles(nom)), rooms:salle_id(name, floor, capacity), profiles:prof_id(display_name)")
        .eq("org_id", orgId!)
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  // All schedules for schedule summary in list
  const { data: allSchedules = [] } = useQuery({
    queryKey: ["madrasa_schedules_all", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_schedules").select("*").eq("org_id", orgId!);
      if (error) throw error;
      return data;
    },
  });

  const { data: levels = [] } = useQuery({
    queryKey: ["madrasa_levels", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_levels").select("*, madrasa_cycles(nom)").eq("org_id", orgId!).order("label");
      if (error) throw error;
      return data;
    },
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("rooms").select("*").eq("org_id", orgId!).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, display_name").eq("org_id", orgId!).eq("is_active", true).order("display_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["madrasa_subjects", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_subjects").select("id, name, category").eq("org_id", orgId!).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Enrollment counts per class
  const { data: enrollmentCounts = [] } = useQuery({
    queryKey: ["enrollment_counts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_enrollments").select("class_id").eq("org_id", orgId!).eq("statut", "Actif");
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const e of data || []) { counts.set(e.class_id, (counts.get(e.class_id) || 0) + 1); }
      return counts;
    },
  });

  // Schedule summary map
  const scheduleSummary = React.useMemo(() => {
    const map = new Map<string, string>();
    const byClass = new Map<string, typeof allSchedules>();
    for (const s of allSchedules) {
      if (!byClass.has(s.class_id)) byClass.set(s.class_id, []);
      byClass.get(s.class_id)!.push(s);
    }
    for (const [cid, slots] of byClass.entries()) {
      const parts = slots.map(s => `${DAY_LABELS[s.day_of_week] ?? "?"} ${s.start_time?.slice(0, 5)} - ${s.end_time?.slice(0, 5)}`);
      map.set(cid, parts.join(" · "));
    }
    return map;
  }, [allSchedules]);

  const openAdd = () => {
    if (!currentYear) {
      toast({ title: "Aucune année courante", description: "Définissez une année courante dans l'onglet Pilotage avant de créer une classe.", variant: "destructive" });
      return;
    }
    setEditing(null);
    setForm({ nom: "", levelId: "", salleId: "", capacityMax: "15", profId: "" });
    setSchedules([]);
    setDialogOpen(true);
  };

  const openEdit = async (c: any) => {
    setEditing(c);
    setForm({
      nom: c.nom,
      levelId: c.level_id || "",
      salleId: c.salle_id || "",
      capacityMax: String(c.capacity_max ?? 15),
      profId: c.prof_id || "",
    });
    // Load existing schedules for this class
    const { data: existingSchedules } = await supabase
      .from("madrasa_schedules")
      .select("*")
      .eq("class_id", c.id)
      .eq("org_id", orgId!);
    setSchedules(
      (existingSchedules || []).map(s => ({
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        subject_ids: s.subject_ids || [],
      }))
    );
    setDialogOpen(true);
  };

  const addSlot = () => {
    setSchedules(prev => [...prev, { day_of_week: 6, start_time: "09:00", end_time: "12:00", subject_ids: [] }]);
  };

  const removeSlot = (idx: number) => {
    setSchedules(prev => prev.filter((_, i) => i !== idx));
  };

  const updateSlot = (idx: number, patch: Partial<ScheduleSlot>) => {
    setSchedules(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };

  const toggleSubject = (idx: number, subjectId: string) => {
    setSchedules(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      const has = s.subject_ids.includes(subjectId);
      return { ...s, subject_ids: has ? s.subject_ids.filter(id => id !== subjectId) : [...s.subject_ids, subjectId] };
    }));
  };

  const saveClass = useMutation({
    mutationFn: async () => {
      if (!form.nom.trim()) throw new Error("Le nom est requis");
      if (!currentYear) throw new Error("Aucune année courante définie");
      if (schedules.length === 0) throw new Error("Ajoutez au moins un créneau de cours");

      const payload: any = {
        nom: form.nom.trim(),
        level_id: form.levelId || null,
        salle_id: form.salleId || null,
        capacity_max: parseInt(form.capacityMax) || 15,
        prof_id: form.profId || null,
        org_id: orgId!,
        academic_year_id: currentYear.id,
      };

      let classId: string;

      if (editing) {
        const { error } = await supabase.from("madrasa_classes").update(payload).eq("id", editing.id);
        if (error) throw error;
        classId = editing.id;
      } else {
        const { data, error } = await supabase.from("madrasa_classes").insert(payload).select("id").single();
        if (error) throw error;
        classId = data.id;
      }

      // Transactional schedule sync: delete old, insert new
      const { error: delErr } = await supabase.from("madrasa_schedules").delete().eq("class_id", classId).eq("org_id", orgId!);
      if (delErr) throw delErr;

      if (schedules.length > 0) {
        const rows = schedules.map(s => ({
          class_id: classId,
          org_id: orgId!,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          subject_ids: s.subject_ids,
        }));
        const { error: insErr } = await supabase.from("madrasa_schedules").insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["madrasa_classes", orgId] });
      qc.invalidateQueries({ queryKey: ["madrasa_schedules_all", orgId] });
      setDialogOpen(false);
      toast({ title: editing ? "Classe modifiée" : "Classe créée" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteClass = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("madrasa_classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["madrasa_classes", orgId] });
      qc.invalidateQueries({ queryKey: ["madrasa_schedules_all", orgId] });
      toast({ title: "Classe supprimée" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const subjectName = (id: string) => (subjects as any[]).find((s: any) => s.id === id)?.name ?? id;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Classes</CardTitle>
            <CardDescription>
              Gestion des classes rattachées à l'année {currentYear?.label ?? "—"}.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Nouvelle classe</Button>
        </CardHeader>
        <CardContent>
          {!currentYear && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Aucune année courante définie. Rendez-vous dans l'onglet <strong>Pilotage</strong> pour en activer une.
            </div>
          )}
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : classes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune classe configurée pour cette année.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead>Enseignant</TableHead>
                  <TableHead>Salle</TableHead>
                  <TableHead className="text-center">Remplissage</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((c: any) => {
                  const enrolled = enrollmentCounts instanceof Map ? (enrollmentCounts.get(c.id) || 0) : 0;
                  const cap = c.capacity_max || 15;
                  const pct = Math.min(100, Math.round((enrolled / cap) * 100));
                  const room = c.rooms as any;
                  const level = c.madrasa_levels as any;
                  const prof = c.profiles as any;
                  const schedText = scheduleSummary.get(c.id);

                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nom}</TableCell>
                      <TableCell>
                        {level?.label ? (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-xs">{level.label}</Badge>
                            {level.madrasa_cycles?.nom && <span className="text-xs text-muted-foreground">({level.madrasa_cycles.nom})</span>}
                          </div>
                        ) : c.niveau ? (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-xs text-muted-foreground italic">{c.niveau}</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="text-sm">{prof?.display_name ?? "—"}</span>
                          {schedText && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{schedText}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {room?.name ? `${room.name} - ${room.floor} (${room.capacity})` : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500")}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{enrolled}/{cap}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteClass.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog ajout/édition avec planning */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la classe" : "Nouvelle classe"}</DialogTitle>
            <DialogDescription>
              {editing ? "Modifiez les informations et le planning." : "Créez une classe et définissez son planning."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Nom */}
            <div className="space-y-2">
              <Label>Nom de la classe *</Label>
              <Input placeholder="Ex: CE1 - Groupe A" value={form.nom} onChange={(e) => setForm(f => ({ ...f, nom: e.target.value }))} />
            </div>

            {/* Niveau */}
            <div className="space-y-2">
              <Label>Niveau</Label>
              <Select value={form.levelId} onValueChange={(v) => setForm(f => ({ ...f, levelId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  {(levels as any[]).map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label} {l.madrasa_cycles?.nom ? `(${l.madrasa_cycles.nom})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Professeur */}
            <div className="space-y-2">
              <Label>Professeur</Label>
              <Select value={form.profId} onValueChange={(v) => setForm(f => ({ ...f, profId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  {(teachers as any[]).map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Salle + Capacité */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Salle</Label>
                <Select value={form.salleId} onValueChange={(v) => setForm(f => ({ ...f, salleId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>
                    {(rooms as any[]).map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} - {r.floor} ({r.capacity} places)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Capacité max</Label>
                <Input type="number" min={1} value={form.capacityMax} onChange={(e) => setForm(f => ({ ...f, capacityMax: e.target.value }))} />
              </div>
            </div>

            {/* ── Planning des cours ── */}
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label className="text-base font-semibold">Planning des cours</Label>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addSlot}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter un créneau
              </Button>
            </div>

            {schedules.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
                Aucun créneau défini. Ajoutez au moins un créneau de cours.
              </p>
            )}

            <div className="space-y-4">
              {schedules.map((slot, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-3 bg-muted/30">
                  {/* Row: Day + Times + Delete */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={String(slot.day_of_week)} onValueChange={(v) => updateSlot(idx, { day_of_week: Number(v) })}>
                      <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAY_LABELS.map((label, i) => (
                          <SelectItem key={i} value={String(i)}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <Input
                        type="time"
                        className="w-[110px] h-9"
                        value={slot.start_time}
                        onChange={(e) => updateSlot(idx, { start_time: e.target.value })}
                      />
                      <span className="text-muted-foreground text-sm">→</span>
                      <Input
                        type="time"
                        className="w-[110px] h-9"
                        value={slot.end_time}
                        onChange={(e) => updateSlot(idx, { end_time: e.target.value })}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 ml-auto" onClick={() => removeSlot(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  {/* Subjects multi-select as checkboxes + badges */}
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">{slot.subject_ids.length} matière(s)</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full justify-start h-auto min-h-[36px] py-1.5 px-3 font-normal">
                          {slot.subject_ids.length === 0 ? (
                            <span className="text-muted-foreground">Sélectionner des matières…</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {slot.subject_ids.map(id => (
                                <Badge key={id} variant="secondary" className="text-xs">{subjectName(id)}</Badge>
                              ))}
                            </div>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2 max-h-60 overflow-y-auto" align="start">
                        {(subjects as any[]).length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-2">Aucune matière. Créez-en dans l'onglet Cursus.</p>
                        ) : (
                          <div className="space-y-1">
                            {(subjects as any[]).map((s: any) => (
                              <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer text-sm">
                                <Checkbox
                                  checked={slot.subject_ids.includes(s.id)}
                                  onCheckedChange={() => toggleSubject(idx, s.id)}
                                />
                                <span>{s.name}</span>
                                {s.category && <Badge variant="outline" className="text-[10px] ml-auto">{s.category}</Badge>}
                              </label>
                            ))}
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => saveClass.mutate()} disabled={saveClass.isPending || !form.nom.trim()}>
              {saveClass.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. PARAMÈTRES — Général + Communications intégrées
   ═══════════════════════════════════════════════════════════════════════════ */

function SettingsSection() {
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
        <CardTitle className="text-lg flex items-center gap-2"><Settings2 className="h-5 w-5" /> Paramètres généraux</CardTitle>
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
          <Label>Seuil d'alerte absences</Label>
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
   5. STUDIO — IDE-style 3-column view
   ═══════════════════════════════════════════════════════════════════════════ */

type StudioSelection = 
  | { type: "none" }
  | { type: "level"; id: string }
  | { type: "class"; id: string };

function StudioSection() {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [selection, setSelection] = useState<StudioSelection>({ type: "none" });
  const [expandedCycles, setExpandedCycles] = useState<Set<string>>(new Set());
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [launchpadOpen, setLaunchpadOpen] = useState(false);

  // Class form state (reused from ClassesSection pattern)
  const [classForm, setClassForm] = useState({ nom: "", levelId: "", salleId: "", capacityMax: "15", profId: "" });
  const [classSchedules, setClassSchedules] = useState<ScheduleSlot[]>([]);

  /* ── Queries ── */
  const { data: years = [] } = useQuery({
    queryKey: ["madrasa_academic_years", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_academic_years").select("*").eq("org_id", orgId!).order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Auto-select current year
  React.useEffect(() => {
    if (years.length > 0 && !selectedYearId) {
      const cur = years.find(y => y.is_current);
      setSelectedYearId(cur?.id ?? years[0].id);
    }
  }, [years, selectedYearId]);

  const { data: cycles = [] } = useQuery({
    queryKey: ["madrasa_cycles", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_cycles").select("*").eq("org_id", orgId!).order("nom");
      if (error) throw error;
      return data;
    },
  });

  const { data: levels = [] } = useQuery({
    queryKey: ["madrasa_levels", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_levels").select("*, madrasa_cycles(nom)").eq("org_id", orgId!).order("label");
      if (error) throw error;
      return data;
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["madrasa_classes", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_classes")
        .select("*, madrasa_levels(label, madrasa_cycles(nom)), rooms:salle_id(name, floor, capacity), profiles:prof_id(display_name)")
        .eq("org_id", orgId!)
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("rooms").select("*").eq("org_id", orgId!).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, display_name").eq("org_id", orgId!).eq("is_active", true).order("display_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["madrasa_subjects", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_subjects").select("id, name, category").eq("org_id", orgId!).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollmentCountsRaw = [] } = useQuery({
    queryKey: ["enrollment_counts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_enrollments").select("class_id").eq("org_id", orgId!).eq("statut", "Actif");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allSchedules = [] } = useQuery({
    queryKey: ["madrasa_schedules_all", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("madrasa_schedules").select("*").eq("org_id", orgId!);
      if (error) throw error;
      return data;
    },
  });

  const enrollmentCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of enrollmentCountsRaw) { counts.set(e.class_id, (counts.get(e.class_id) || 0) + 1); }
    return counts;
  }, [enrollmentCountsRaw]);

  // Tree structure: cycles > levels > classes
  const tree = React.useMemo(() => {
    return cycles.map(cycle => {
      const cycleLevels = (levels as any[]).filter((l: any) => l.cycle_id === cycle.id);
      return {
        ...cycle,
        levels: cycleLevels.map((level: any) => ({
          ...level,
          classes: (classes as any[]).filter((c: any) => c.level_id === level.id && (!selectedYearId || c.academic_year_id === selectedYearId)),
        })),
      };
    });
  }, [cycles, levels, classes, selectedYearId]);

  const toggleCycle = (id: string) => setExpandedCycles(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleLevel = (id: string) => setExpandedLevels(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // Load class into form when selecting
  const selectClass = async (c: any) => {
    setSelection({ type: "class", id: c.id });
    setClassForm({
      nom: c.nom,
      levelId: c.level_id || "",
      salleId: c.salle_id || "",
      capacityMax: String(c.capacity_max ?? 15),
      profId: c.prof_id || "",
    });
    const { data: existingSchedules } = await supabase
      .from("madrasa_schedules").select("*").eq("class_id", c.id).eq("org_id", orgId!);
    setClassSchedules(
      (existingSchedules || []).map(s => ({
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        subject_ids: s.subject_ids || [],
      }))
    );
  };

  // Schedule helpers
  const addSlot = () => setClassSchedules(prev => [...prev, { day_of_week: 6, start_time: "09:00", end_time: "12:00", subject_ids: [] }]);
  const removeSlot = (idx: number) => setClassSchedules(prev => prev.filter((_, i) => i !== idx));
  const updateSlot = (idx: number, patch: Partial<ScheduleSlot>) => setClassSchedules(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  const toggleSubject = (idx: number, subjectId: string) => {
    setClassSchedules(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      const has = s.subject_ids.includes(subjectId);
      return { ...s, subject_ids: has ? s.subject_ids.filter(id => id !== subjectId) : [...s.subject_ids, subjectId] };
    }));
  };

  const subjectName = (id: string) => (subjects as any[]).find((s: any) => s.id === id)?.name ?? id;

  // Save class mutation (reuses same logic as ClassesSection)
  const saveClass = useMutation({
    mutationFn: async () => {
      if (!classForm.nom.trim()) throw new Error("Le nom est requis");
      if (!selectedYearId) throw new Error("Aucune année sélectionnée");
      if (classSchedules.length === 0) throw new Error("Ajoutez au moins un créneau");

      const classId = selection.type === "class" && selection.id !== "__new__" ? selection.id : null;
      const payload: any = {
        nom: classForm.nom.trim(),
        level_id: classForm.levelId || null,
        salle_id: classForm.salleId || null,
        capacity_max: parseInt(classForm.capacityMax) || 15,
        prof_id: classForm.profId || null,
        org_id: orgId!,
        academic_year_id: selectedYearId,
      };

      let finalId: string;
      if (classId) {
        const { error } = await supabase.from("madrasa_classes").update(payload).eq("id", classId);
        if (error) throw error;
        finalId = classId;
      } else {
        const { data, error } = await supabase.from("madrasa_classes").insert(payload).select("id").single();
        if (error) throw error;
        finalId = data.id;
        setSelection({ type: "class", id: finalId });
      }

      const { error: delErr } = await supabase.from("madrasa_schedules").delete().eq("class_id", finalId).eq("org_id", orgId!);
      if (delErr) throw delErr;

      if (classSchedules.length > 0) {
        const rows = classSchedules.map(s => ({ class_id: finalId, org_id: orgId!, day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time, subject_ids: s.subject_ids }));
        const { error: insErr } = await supabase.from("madrasa_schedules").insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["madrasa_classes", orgId] });
      qc.invalidateQueries({ queryKey: ["madrasa_schedules_all", orgId] });
      toast({ title: "Classe enregistrée" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // Inspector data
  const selectedLevel = selection.type === "level" ? (levels as any[]).find((l: any) => l.id === selection.id) : null;
  const isNewClass = selection.type === "class" && selection.id === "__new__";
  const selectedClass = selection.type === "class" && !isNewClass ? (classes as any[]).find((c: any) => c.id === selection.id) : null;

  // Student management for selected class
  const selectedClassId = selection.type === "class" && selection.id !== "__new__" ? selection.id : null;

  const { data: classEnrollments = [], refetch: refetchEnrollments } = useQuery({
    queryKey: ["class_enrollments", selectedClassId, orgId],
    enabled: !!selectedClassId && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_enrollments")
        .select("id, student_id, madrasa_students(id, nom, prenom)")
        .eq("class_id", selectedClassId!)
        .eq("org_id", orgId!)
        .eq("statut", "Actif");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allStudents = [] } = useQuery({
    queryKey: ["madrasa_students_all", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_students")
        .select("id, nom, prenom")
        .eq("org_id", orgId!)
        .order("nom");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [studentSearch, setStudentSearch] = useState("");
  const [showStudentSearch, setShowStudentSearch] = useState(false);

  const enrolledStudentIds = React.useMemo(() => new Set(classEnrollments.map((e: any) => e.student_id)), [classEnrollments]);

  const filteredStudents = React.useMemo(() => {
    if (!studentSearch.trim()) return [];
    const q = studentSearch.toLowerCase();
    return allStudents.filter((s: any) => !enrolledStudentIds.has(s.id) && (`${s.prenom} ${s.nom}`.toLowerCase().includes(q) || `${s.nom} ${s.prenom}`.toLowerCase().includes(q))).slice(0, 10);
  }, [allStudents, studentSearch, enrolledStudentIds]);

  const enrollStudent = useMutation({
    mutationFn: async (studentId: string) => {
      if (!selectedClassId || !orgId || !selectedYearId) throw new Error("Données manquantes");
      const currentYear = years.find(y => y.id === selectedYearId);
      const { error } = await supabase.from("madrasa_enrollments").insert({
        student_id: studentId,
        class_id: selectedClassId,
        org_id: orgId,
        annee_scolaire: currentYear?.label ?? "2025/2026",
        academic_year_id: selectedYearId,
        statut: "Actif",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchEnrollments();
      qc.invalidateQueries({ queryKey: ["enrollment_counts", orgId] });
      setStudentSearch("");
      setShowStudentSearch(false);
      toast({ title: "Élève inscrit" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const removeEnrollment = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase.from("madrasa_enrollments").update({ statut: "Retiré" }).eq("id", enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchEnrollments();
      qc.invalidateQueries({ queryKey: ["enrollment_counts", orgId] });
      toast({ title: "Élève retiré de la classe" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const inspectorClasses = React.useMemo(() => {
    if (selection.type === "level") return (classes as any[]).filter((c: any) => c.level_id === selection.id);
    if (selection.type === "class" && selectedClass) return (classes as any[]).filter((c: any) => c.level_id === selectedClass.level_id);
    if (isNewClass && classForm.levelId) return (classes as any[]).filter((c: any) => c.level_id === classForm.levelId);
    return [];
  }, [selection, classes, selectedClass, isNewClass, classForm.levelId]);

  const alerts = React.useMemo(() => {
    const items: { msg: string; severity: "warning" | "error" }[] = [];
    const schedByClass = new Map<string, any[]>();
    for (const s of allSchedules) {
      if (!schedByClass.has(s.class_id)) schedByClass.set(s.class_id, []);
      schedByClass.get(s.class_id)!.push(s);
    }
    // Classes without schedules
    for (const c of classes as any[]) {
      if (!schedByClass.has(c.id) || schedByClass.get(c.id)!.length === 0) {
        items.push({ msg: `"${c.nom}" n'a aucun créneau`, severity: "warning" });
      }
    }
    // Room conflicts: same room, same day, overlapping times
    const roomSlots: { room: string; day: number; start: string; end: string; className: string }[] = [];
    for (const c of classes as any[]) {
      if (!c.salle_id) continue;
      const scheds = schedByClass.get(c.id) || [];
      for (const s of scheds) {
        roomSlots.push({ room: c.salle_id, day: s.day_of_week, start: s.start_time, end: s.end_time, className: c.nom });
      }
    }
    for (let i = 0; i < roomSlots.length; i++) {
      for (let j = i + 1; j < roomSlots.length; j++) {
        const a = roomSlots[i], b = roomSlots[j];
        if (a.room === b.room && a.day === b.day && a.start < b.end && b.start < a.end) {
          items.push({ msg: `Conflit salle : "${a.className}" & "${b.className}" le ${DAY_LABELS[a.day]}`, severity: "error" });
        }
      }
    }
    return items;
  }, [classes, allSchedules]);

  return (
    <>
    <div className="border rounded-lg overflow-hidden flex" style={{ minHeight: 600 }}>
      {/* ── Sidebar Left: Tree ── */}
      <div className="w-[250px] shrink-0 border-r bg-muted/20 flex flex-col">
        <div className="p-3 border-b space-y-1">
          <Label className="text-xs text-muted-foreground">Année scolaire</Label>
          <Select value={selectedYearId} onValueChange={setSelectedYearId}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y.id} value={y.id}>
                  {y.label} {y.is_current ? "★" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="px-3 pb-2">
          <Button
            onClick={() => setLaunchpadOpen(true)}
            className="w-full h-9 text-xs gap-1.5 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            size="sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Lancer un cursus
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {tree.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">Aucun cycle configuré.</p>
            )}
            {tree.map(cycle => {
              const isExpanded = expandedCycles.has(cycle.id);
              return (
                <div key={cycle.id}>
                  <button
                    onClick={() => toggleCycle(cycle.id)}
                    className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-sm hover:bg-accent text-sm font-medium"
                  >
                    <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")} />
                    <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{cycle.nom}</span>
                  </button>
                  {isExpanded && cycle.levels.map((level: any) => {
                    const isLevelExpanded = expandedLevels.has(level.id);
                    const isLevelSelected = selection.type === "level" && selection.id === level.id;
                    return (
                      <div key={level.id} className="ml-4">
                        <button
                          onClick={() => { toggleLevel(level.id); setSelection({ type: "level", id: level.id }); }}
                          className={cn(
                            "flex items-center gap-1.5 w-full text-left px-2 py-1 rounded-sm hover:bg-accent text-sm",
                            isLevelSelected && "bg-accent font-medium"
                          )}
                        >
                          <ChevronRight className={cn("h-3 w-3 transition-transform", isLevelExpanded && "rotate-90")} />
                          {isLevelExpanded ? <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" /> : <Folder className="h-3.5 w-3.5 text-muted-foreground" />}
                          <span className="truncate">{level.label}</span>
                          <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1">{level.classes.length}</Badge>
                        </button>
                        {isLevelExpanded && level.classes.map((c: any) => {
                          const isClassSelected = selection.type === "class" && selection.id === c.id;
                          return (
                            <button
                              key={c.id}
                              onClick={() => selectClass(c)}
                              className={cn(
                                "flex items-center gap-1.5 w-full text-left ml-4 px-2 py-1 rounded-sm hover:bg-accent text-xs",
                                isClassSelected && "bg-primary/10 text-primary font-medium"
                              )}
                            >
                              <GraduationCap className="h-3 w-3 shrink-0" />
                              <span className="truncate">{c.nom}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* ── Canvas Central: Editor ── */}
      <div className="flex-1 overflow-y-auto">
        <ScrollArea className="h-full">
          <div className="p-4">
            {selection.type === "none" && (
              <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
                <LayoutGrid className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">Sélectionnez un niveau ou une classe dans l'arborescence.</p>
              </div>
            )}

            {/* ── Level selected: compact subjects & tarif ── */}
             {selection.type === "level" && selectedLevel && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    {selectedLevel.label}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedLevel.madrasa_cycles?.nom ?? "—"} · Tarif : {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(selectedLevel.tarif_mensuel ?? 0)}/mois
                  </p>
                </div>
                <Separator />
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Classes de ce niveau</h4>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs"
                    onClick={() => {
                      setSelection({ type: "class", id: "__new__" });
                      setClassForm({
                        nom: "",
                        levelId: selectedLevel.id,
                        salleId: "",
                        capacityMax: "15",
                        profId: "",
                      });
                      setClassSchedules([]);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Nouvelle classe
                  </Button>
                </div>
                <div>
                  {inspectorClasses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune classe rattachée.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {inspectorClasses.map((c: any) => {
                        const enrolled = enrollmentCounts.get(c.id) || 0;
                        const cap = c.capacity_max || 15;
                        return (
                          <button
                            key={c.id}
                            onClick={() => selectClass(c)}
                            className="border rounded-md p-3 text-left hover:bg-accent/50 transition-colors"
                          >
                            <p className="font-medium text-sm">{c.nom}</p>
                            <p className="text-xs text-muted-foreground">{c.profiles?.display_name ?? "—"}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Progress value={Math.min(100, Math.round((enrolled / cap) * 100))} className="h-1.5 flex-1" />
                              <span className="text-[10px] text-muted-foreground">{enrolled}/{cap}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

             {/* ── Class selected: full edit form with planning ── */}
            {selection.type === "class" && (selectedClass || isNewClass) && (
              <div className="space-y-4 max-w-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    {isNewClass ? "Nouvelle classe" : selectedClass?.nom}
                  </h3>
                  <Button size="sm" onClick={() => saveClass.mutate()} disabled={saveClass.isPending}>
                    {saveClass.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    {isNewClass ? "Créer" : "Enregistrer"}
                  </Button>
                </div>
                <Separator />

                {/* Basic fields */}
                <div className="space-y-2">
                  <Label>Nom de la classe *</Label>
                  <Input value={classForm.nom} onChange={(e) => setClassForm(f => ({ ...f, nom: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Niveau</Label>
                    <Select value={classForm.levelId} onValueChange={(v) => setClassForm(f => ({ ...f, levelId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                      <SelectContent>
                        {(levels as any[]).map((l: any) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.label} {l.madrasa_cycles?.nom ? `(${l.madrasa_cycles.nom})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Professeur</Label>
                    <Select value={classForm.profId} onValueChange={(v) => setClassForm(f => ({ ...f, profId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                      <SelectContent>
                        {(teachers as any[]).map((t: any) => (
                          <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Salle</Label>
                    <Select value={classForm.salleId} onValueChange={(v) => setClassForm(f => ({ ...f, salleId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                      <SelectContent>
                        {(rooms as any[]).map((r: any) => (
                          <SelectItem key={r.id} value={r.id}>{r.name} - {r.floor} ({r.capacity})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Capacité max</Label>
                    <Input type="number" min={1} value={classForm.capacityMax} onChange={(e) => setClassForm(f => ({ ...f, capacityMax: e.target.value }))} />
                  </div>
                </div>

                {/* Planning */}
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-base font-semibold">Planning des cours</Label>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addSlot}>
                    <Plus className="h-4 w-4 mr-1" /> Ajouter un créneau
                  </Button>
                </div>

                {classSchedules.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
                    Aucun créneau défini.
                  </p>
                )}

                <div className="space-y-3">
                  {classSchedules.map((slot, idx) => (
                    <div key={idx} className="border rounded-lg p-3 space-y-3 bg-muted/30">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select value={String(slot.day_of_week)} onValueChange={(v) => updateSlot(idx, { day_of_week: Number(v) })}>
                          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {DAY_LABELS.map((label, i) => <SelectItem key={i} value={String(i)}>{label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input type="time" className="w-[100px] h-8 text-xs" value={slot.start_time} onChange={(e) => updateSlot(idx, { start_time: e.target.value })} />
                        <span className="text-muted-foreground text-xs">→</span>
                        <Input type="time" className="w-[100px] h-8 text-xs" value={slot.end_time} onChange={(e) => updateSlot(idx, { end_time: e.target.value })} />
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={() => removeSlot(idx)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground">{slot.subject_ids.length} matière(s)</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full justify-start h-auto min-h-[32px] py-1 px-2 font-normal text-xs">
                              {slot.subject_ids.length === 0 ? (
                                <span className="text-muted-foreground">Matières…</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {slot.subject_ids.map(id => <Badge key={id} variant="secondary" className="text-[10px]">{subjectName(id)}</Badge>)}
                                </div>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2 max-h-52 overflow-y-auto" align="start">
                            {(subjects as any[]).length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-2">Aucune matière.</p>
                            ) : (
                              <div className="space-y-0.5">
                                {(subjects as any[]).map((s: any) => (
                                  <label key={s.id} className="flex items-center gap-2 px-2 py-1 rounded-sm hover:bg-accent cursor-pointer text-xs">
                                    <Checkbox checked={slot.subject_ids.includes(s.id)} onCheckedChange={() => toggleSubject(idx, s.id)} />
                                    <span>{s.name}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Student Management ── */}
                {!isNewClass && selectedClassId && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <Label className="text-base font-semibold">Gestion des élèves</Label>
                          <Badge variant="outline" className="text-xs">
                            {classEnrollments.length} / {parseInt(classForm.capacityMax) || 15} élèves
                          </Badge>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowStudentSearch(!showStudentSearch)}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Inscrire un élève
                        </Button>
                      </div>

                      {showStudentSearch && (
                        <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                          <Input
                            placeholder="Rechercher un élève par nom ou prénom…"
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            autoFocus
                            className="h-9"
                          />
                          {filteredStudents.length > 0 && (
                            <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                              {filteredStudents.map((s: any) => (
                                <button
                                  key={s.id}
                                  onClick={() => enrollStudent.mutate(s.id)}
                                  disabled={enrollStudent.isPending}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                                >
                                  <span>{s.prenom} {s.nom}</span>
                                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                              ))}
                            </div>
                          )}
                          {studentSearch.trim() && filteredStudents.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-2">Aucun élève trouvé.</p>
                          )}
                        </div>
                      )}

                      {classEnrollments.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
                          Aucun élève inscrit dans cette classe.
                        </p>
                      ) : (
                        <div className="border rounded-md divide-y">
                          {classEnrollments.map((enrollment: any) => {
                            const student = enrollment.madrasa_students;
                            return (
                              <div key={enrollment.id} className="flex items-center justify-between px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                                    {student?.prenom?.[0]}{student?.nom?.[0]}
                                  </div>
                                  <span className="text-sm">{student?.prenom} {student?.nom}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => removeEnrollment.mutate(enrollment.id)}
                                  disabled={removeEnrollment.isPending}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── Inspector Right ── */}
      <div className="w-[280px] shrink-0 border-l bg-muted/20 overflow-y-auto">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-4">
            {/* Filling widget */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Remplissage</h4>
              {inspectorClasses.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sélectionnez un niveau ou une classe.</p>
              ) : (
                <div className="space-y-2">
                  {inspectorClasses.map((c: any) => {
                    const enrolled = enrollmentCounts.get(c.id) || 0;
                    const cap = c.capacity_max || 15;
                    const pct = Math.min(100, Math.round((enrolled / cap) * 100));
                    return (
                      <div key={c.id} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="truncate font-medium">{c.nom}</span>
                          <span className="text-muted-foreground">{enrolled}/{cap}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator />

            {/* Alerts widget */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Alertes {alerts.length > 0 && <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1">{alerts.length}</Badge>}
              </h4>
              {alerts.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune alerte détectée. ✓</p>
              ) : (
                <div className="space-y-1.5">
                  {alerts.slice(0, 10).map((a, i) => (
                    <div key={i} className={cn("text-xs p-2 rounded-md border", a.severity === "error" ? "bg-destructive/10 border-destructive/20 text-destructive" : "bg-amber-50 border-amber-200 text-amber-800")}>
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                        <span>{a.msg}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>

    <LaunchpadWizard open={launchpadOpen} onOpenChange={setLaunchpadOpen} orgId={orgId} onSuccess={() => {
      qc.invalidateQueries({ queryKey: ["madrasa_cycles", orgId] });
      qc.invalidateQueries({ queryKey: ["madrasa_levels", orgId] });
      qc.invalidateQueries({ queryKey: ["madrasa_subjects", orgId] });
    }} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN HUB
   ═══════════════════════════════════════════════════════════════════════════ */

export function MadrasaHub() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="studio" className="space-y-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
          <TabsTrigger value="studio" className="gap-1.5 text-xs">
            <LayoutGrid className="h-3.5 w-3.5" /> Studio
          </TabsTrigger>
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

        {/* 0. Studio */}
        <TabsContent value="studio">
          <StudioSection />
        </TabsContent>

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
        </TabsContent>

        {/* 3. Classes */}
        <TabsContent value="classes" className="space-y-6">
          <ClassesSection />
        </TabsContent>

        {/* 4. Paramètres & Communications */}
        <TabsContent value="parametres" className="space-y-6">
          <SettingsSection />
          <CommunicationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
