import { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ClipboardList, PlusCircle, Loader2, Check, ChevronRight, ChevronLeft,
  User, Users, Receipt, Search, GraduationCap, AlertCircle, UserPlus, Clock,
  FileSpreadsheet, MoreHorizontal, Download, Eye, Pencil, Trash2,
  CheckCircle2, Inbox, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown } from "lucide-react";
import { BulkImportDialog } from "@/components/madrasa/BulkImportDialog";
import { motion, AnimatePresence } from "framer-motion";
import { ViewSwitcher, type ViewMode } from "@/components/ui/ViewSwitcher";
import { StatCards, type StatCardItem } from "@/components/shared/StatCards";
import { EnrollmentCard, type EnrollmentCardData } from "@/components/madrasa/EnrollmentCard";

// ── Types ────────────────────────────────────────────────
interface Level {
  id: string;
  label: string;
  tarif_mensuel: number | null;
  cycle_id: string | null;
}

interface Cycle {
  id: string;
  nom: string;
}

interface ClassRow {
  id: string;
  nom: string;
  niveau: string | null;
  level_id: string | null;
}

interface EnrollmentRow {
  id: string;
  annee_scolaire: string;
  statut: string | null;
  created_at: string | null;
  student: { nom: string; prenom: string; niveau: string | null } | null;
  classe: { nom: string } | null;
}

interface ParentSearchResult {
  user_id: string;
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  roles: string[];
  existingFamilyId: string | null;
}

// ── Current school year ──
function getCurrentSchoolYear(): string {
  const now = new Date();
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}/${year + 1}`;
}

// ── Stepper ──────────────────────────────────────────────
const STEPS = [
  { label: "Élève", icon: User },
  { label: "Parents", icon: Users },
  { label: "Récapitulatif", icon: Receipt },
];

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const isActive = i === current;
        const isDone = i < current;
        return (
          <div key={s.label} className="flex items-center gap-2">
            {i > 0 && (
              <div className={cn("h-px w-8", isDone ? "bg-primary" : "bg-border")} />
            )}
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                isActive && "bg-primary text-primary-foreground",
                isDone && "bg-primary/10 text-primary",
                !isActive && !isDone && "bg-muted text-muted-foreground"
              )}
            >
              {isDone ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Role label mapping ──
const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: "Admin", color: "bg-purple-100 text-purple-700 border-purple-300" },
  responsable: { label: "Responsable", color: "bg-amber-100 text-amber-700 border-amber-300" },
  enseignant: { label: "Enseignant", color: "bg-sky-100 text-sky-700 border-sky-300" },
  benevole: { label: "Bénévole", color: "bg-muted text-muted-foreground border-border" },
  parent: { label: "Parent", color: "bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30" },
  super_admin: { label: "Super Admin", color: "bg-destructive/15 text-destructive border-destructive/30" },
};

const SANDBOX_VALUE = "__sandbox__";

const PREF_DAYS = ["Samedi", "Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

// ── Enrollment Dialog ────────────────────────────────────
function EnrollmentWizard({
  open,
  onOpenChange,
  orgId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Student
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [gender, setGender] = useState<string>("");
  const [age, setAge] = useState<string>("");
  const [niveauId, setNiveauId] = useState("");
  const [classId, setClassId] = useState("");

  // Assessment & Preferences
  const [testLevel, setTestLevel] = useState("");
  const [assessmentNotes, setAssessmentNotes] = useState("");
  const [prefDays, setPrefDays] = useState<string[]>([]);
  const [siblingPriority, setSiblingPriority] = useState(false);
  const [assessmentOpen, setAssessmentOpen] = useState(false);

  // Step 2: Parent
  const [parentMode, setParentMode] = useState<"search" | "new">("search");
  const [parentSearch, setParentSearch] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [parentName, setParentName] = useState("");
  const [suggestedFamilyId, setSuggestedFamilyId] = useState<string | null>(null);
  const [newParentNom, setNewParentNom] = useState("");
  const [newParentPrenom, setNewParentPrenom] = useState("");
  const [newParentEmail, setNewParentEmail] = useState("");
  const [newParentPhone, setNewParentPhone] = useState("");
  const [parentComboOpen, setParentComboOpen] = useState(false);
  const [phoneDuplicate, setPhoneDuplicate] = useState<{ id: string; user_id: string; display_name: string; email: string | null } | null>(null);

  // Data
  const [levels, setLevels] = useState<Level[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [parentResults, setParentResults] = useState<ParentSearchResult[]>([]);
  const [billingCycle, setBillingCycle] = useState<"mensuel" | "trimestriel">("mensuel");
  const [duplicateWarning, setDuplicateWarning] = useState("");
  const [academicYearId, setAcademicYearId] = useState<string | null>(null);

  const annee = getCurrentSchoolYear();

  // Fetch levels, cycles, classes & current academic year
  useEffect(() => {
    if (!open || !orgId) return;
    Promise.all([
      supabase.from("madrasa_levels").select("id, label, tarif_mensuel, cycle_id").eq("org_id", orgId),
      supabase.from("madrasa_cycles").select("id, nom").eq("org_id", orgId).order("nom"),
      supabase.from("madrasa_classes").select("id, nom, niveau, level_id").eq("org_id", orgId),
      supabase.from("madrasa_academic_years").select("id, label").eq("org_id", orgId).eq("is_current", true).maybeSingle(),
    ]).then(([levelsRes, cyclesRes, classesRes, ayRes]) => {
      setLevels((levelsRes.data ?? []) as Level[]);
      setCycles((cyclesRes.data ?? []) as Cycle[]);
      setClasses((classesRes.data ?? []) as ClassRow[]);
      if (ayRes.data) setAcademicYearId(ayRes.data.id);
    });
  }, [open, orgId]);

  // Group levels by cycle
  const groupedLevels = useMemo(() => {
    const groups: { cycle: Cycle; levels: Level[] }[] = [];
    const cycleMap = new Map(cycles.map(c => [c.id, c]));
    const ungrouped: Level[] = [];

    for (const level of levels) {
      if (level.cycle_id && cycleMap.has(level.cycle_id)) {
        let group = groups.find(g => g.cycle.id === level.cycle_id);
        if (!group) {
          group = { cycle: cycleMap.get(level.cycle_id)!, levels: [] };
          groups.push(group);
        }
        group.levels.push(level);
      } else {
        ungrouped.push(level);
      }
    }
    return { groups, ungrouped };
  }, [levels, cycles]);

  // Get selected level display label
  const selectedLevel = levels.find((l) => l.id === niveauId);
  const selectedLevelDisplay = useMemo(() => {
    if (!selectedLevel) return null;
    const cycle = selectedLevel.cycle_id ? cycles.find(c => c.id === selectedLevel.cycle_id) : null;
    return cycle ? `${cycle.nom} > ${selectedLevel.label}` : selectedLevel.label;
  }, [selectedLevel, cycles]);

  // Search parents with roles
  useEffect(() => {
    if (parentSearch.length < 2 || !orgId) {
      setParentResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, id, display_name, email, phone")
        .eq("org_id", orgId)
        .or(`display_name.ilike.%${parentSearch}%,email.ilike.%${parentSearch}%,phone.ilike.%${parentSearch}%`)
        .limit(8);

      if (!profiles || profiles.length === 0) {
        setParentResults([]);
        return;
      }

      const userIds = profiles.map(p => p.user_id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const roleMap: Record<string, string[]> = {};
      for (const r of (roles ?? [])) {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      }

      const profileIds = profiles.map(p => p.id);
      const { data: existingChildren } = await supabase
        .from("madrasa_students")
        .select("parent_id, family_id")
        .in("parent_id", profileIds)
        .limit(50);

      const familyMap: Record<string, string> = {};
      for (const child of (existingChildren ?? [])) {
        if (child.parent_id && child.family_id) {
          familyMap[child.parent_id] = child.family_id;
        }
      }

      setParentResults(profiles.map(p => ({
        user_id: p.user_id,
        id: p.id,
        display_name: p.display_name,
        email: p.email,
        phone: p.phone,
        roles: roleMap[p.user_id] ?? [],
        existingFamilyId: familyMap[p.id] ?? null,
      })));
    }, 300);
    return () => clearTimeout(timeout);
  }, [parentSearch, orgId]);

  // Duplicate check
  useEffect(() => {
    if (!nom.trim() || !prenom.trim() || !orgId) {
      setDuplicateWarning("");
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("madrasa_students")
        .select("id")
        .eq("nom", nom.trim())
        .eq("prenom", prenom.trim())
        .eq("org_id", orgId)
        .maybeSingle();
      if (data) {
        setDuplicateWarning("Un élève avec ce nom existe déjà. L'inscription sera liée au profil existant.");
      } else {
        setDuplicateWarning("");
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [nom, prenom, orgId]);

  // Phone duplicate detection
  const normalizePhone = useCallback((p: string) => p.replace(/[\s.\-()]/g, ""), []);

  useEffect(() => {
    const cleaned = normalizePhone(newParentPhone);
    if (cleaned.length < 10 || !orgId || parentMode !== "new") {
      setPhoneDuplicate(null);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, user_id, display_name, email, phone")
        .eq("org_id", orgId)
        .not("phone", "is", null)
        .limit(100);

      const match = (profiles ?? []).find(
        (p) => p.phone && normalizePhone(p.phone) === cleaned
      );
      setPhoneDuplicate(match ? { id: match.id, user_id: match.user_id, display_name: match.display_name, email: match.email } : null);
    }, 400);
    return () => clearTimeout(timeout);
  }, [newParentPhone, orgId, parentMode, normalizePhone]);

  const handleUseExistingProfile = async () => {
    if (!phoneDuplicate) return;
    setParentId(phoneDuplicate.id);
    setParentName(phoneDuplicate.display_name);
    const { data: children } = await supabase
      .from("madrasa_students")
      .select("family_id")
      .eq("parent_id", phoneDuplicate.id)
      .not("family_id", "is", null)
      .limit(1);
    const fId = children?.[0]?.family_id ?? null;
    setSuggestedFamilyId(fId);
    if (fId) setSiblingPriority(true);
    setParentMode("search");
    setNewParentNom(""); setNewParentPrenom(""); setNewParentEmail(""); setNewParentPhone("");
    setPhoneDuplicate(null);
  };

  const isSandbox = classId === SANDBOX_VALUE;
  const effectiveClassId = isSandbox ? null : classId;

  const filteredClasses = niveauId
    ? classes.filter((c) => c.level_id === niveauId || (!c.level_id && c.niveau === selectedLevel?.label))
    : classes;

  const tarifMensuel = selectedLevel?.tarif_mensuel ?? 0;
  const nbFees = billingCycle === "mensuel" ? 10 : 4;
  const feeAmount = billingCycle === "mensuel" ? tarifMensuel : tarifMensuel * 3;
  const totalAnnuel = billingCycle === "mensuel" ? tarifMensuel * 10 : feeAmount * 4;

  // Validation: only niveau is required (class is optional / sandbox)
  const canGoStep2 = !!(nom.trim() && prenom.trim() && niveauId);
  const canGoStep3 = parentMode === "search"
    ? true
    : (newParentPhone.trim().length >= 10) && (newParentEmail ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newParentEmail) : true);

  const handleSelectParent = (p: ParentSearchResult) => {
    setParentId(p.id);
    setParentName(p.display_name);
    setSuggestedFamilyId(p.existingFamilyId);
    if (p.existingFamilyId) setSiblingPriority(true);
    setParentComboOpen(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("enroll-student", {
        body: {
          student_nom: nom.trim(),
          student_prenom: prenom.trim(),
          age: age ? parseInt(age, 10) : null,
          gender: gender || null,
          level_id: niveauId || null,
          parent_id: parentId,
          parent_nom: parentMode === "new" ? newParentNom.trim() : null,
          parent_prenom: parentMode === "new" ? newParentPrenom.trim() : null,
          parent_email: parentMode === "new" ? newParentEmail.trim() : null,
          parent_phone: parentMode === "new" ? newParentPhone.trim() : null,
          class_id: effectiveClassId,
          annee_scolaire: annee,
          academic_year_id: academicYearId,
          tarif_mensuel: tarifMensuel,
          billing_cycle: billingCycle,
          org_id: orgId,
          family_id: suggestedFamilyId,
          assessment: {
            test_level: testLevel || null,
            notes: assessmentNotes || null,
          },
          preferences: {
            days: prefDays,
            sibling_priority: siblingPriority,
          },
        },
      });

      if (error) throw error;
      const result = data as { success: boolean; error?: string; fees_generated?: number };
      if (!result.success) throw new Error(result.error);

      const sandboxMsg = isSandbox
        ? "L'élève a été placé dans le Sandbox. Vous pourrez l'affecter à une classe plus tard depuis le Studio."
        : `${result.fees_generated ?? 0} échéances générées.`;

      toast({
        title: "✅ Inscription réussie !",
        description: `${prenom} ${nom} inscrit(e). ${sandboxMsg}`,
      });

      // Reset
      setStep(0);
      setNom(""); setPrenom(""); setGender(""); setAge(""); setNiveauId(""); setClassId("");
      setTestLevel(""); setAssessmentNotes(""); setPrefDays([]); setSiblingPriority(false);
      setParentId(null); setParentName(""); setParentSearch(""); setSuggestedFamilyId(null);
      setNewParentNom(""); setNewParentPrenom(""); setNewParentEmail(""); setNewParentPhone("");
      setBillingCycle("mensuel");
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetOnClose = (v: boolean) => {
    if (!v) setStep(0);
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={resetOnClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Nouvelle inscription — {annee}
          </DialogTitle>
          <DialogDescription>Remplissez les informations pour inscrire un élève.</DialogDescription>
        </DialogHeader>

        <Stepper current={step} />

        {/* ── Step 1: Student ── */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Prénom *</label>
                <Input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom de l'élève" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Nom *</label>
                <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de famille" />
              </div>
            </div>

            {duplicateWarning && (
              <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-400/30 p-3 text-sm text-amber-700">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {duplicateWarning}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Genre</label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculin</SelectItem>
                    <SelectItem value="F">Féminin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Âge</label>
                <Input
                  type="number"
                  min={3}
                  max={99}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Ex: 12"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Niveau *</label>
                <Select value={niveauId} onValueChange={setNiveauId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un niveau">
                      {selectedLevelDisplay ?? "Choisir un niveau"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {groupedLevels.groups.map((g) => (
                      <SelectGroup key={g.cycle.id}>
                        <SelectLabel className="text-xs font-bold uppercase tracking-wide text-brand-navy">
                          {g.cycle.nom}
                        </SelectLabel>
                        {g.levels.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.label} {l.tarif_mensuel ? `— ${l.tarif_mensuel} €/mois` : ""}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                    {groupedLevels.ungrouped.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Autres niveaux
                        </SelectLabel>
                        {groupedLevels.ungrouped.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.label} {l.tarif_mensuel ? `— ${l.tarif_mensuel} €/mois` : ""}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Classe</label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une classe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SANDBOX_VALUE}>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-amber-600 font-medium">Mettre en attente (Sandbox)</span>
                      </span>
                    </SelectItem>
                    <Separator className="my-1" />
                    {filteredClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nom} {c.niveau ? `(${c.niveau})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Assessment & Preferences collapsible */}
            <Collapsible open={assessmentOpen} onOpenChange={setAssessmentOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
                  <span className="text-xs font-medium">📋 Évaluation & Préférences</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", assessmentOpen && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                {/* Assessment */}
                <div className="rounded-lg border border-border p-3 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Évaluation initiale</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Niveau évalué</label>
                      <Select value={testLevel} onValueChange={setTestLevel}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un niveau" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="debutant">Débutant</SelectItem>
                          <SelectItem value="intermediaire">Intermédiaire</SelectItem>
                          <SelectItem value="confirme">Confirmé</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium mb-1 block">Observations</label>
                      <Textarea
                        value={assessmentNotes}
                        onChange={(e) => setAssessmentNotes(e.target.value)}
                        placeholder="Remarques sur le niveau de l'élève…"
                        className="min-h-[60px]"
                      />
                    </div>
                  </div>
                </div>

                {/* Preferences */}
                <div className="rounded-lg border border-border p-3 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Préférences</p>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Créneaux souhaités</label>
                    <div className="flex flex-wrap gap-2">
                      {PREF_DAYS.map((day) => (
                        <label key={day} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <Checkbox
                            checked={prefDays.includes(day)}
                            onCheckedChange={(checked) => {
                              setPrefDays(prev =>
                                checked ? [...prev, day] : prev.filter(d => d !== day)
                              );
                            }}
                          />
                          {day}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Priorité fratrie</label>
                    <Switch checked={siblingPriority} onCheckedChange={setSiblingPriority} />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(1)} disabled={!canGoStep2}>
                Suivant <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Parent ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={parentMode === "search" ? "default" : "outline"}
                size="sm"
                onClick={() => setParentMode("search")}
              >
                <Search className="h-3.5 w-3.5 mr-1" />
                Rechercher un parent
              </Button>
              <Button
                variant={parentMode === "new" ? "default" : "outline"}
                size="sm"
                onClick={() => { setParentMode("new"); setParentId(null); setParentName(""); setSuggestedFamilyId(null); }}
              >
                <PlusCircle className="h-3.5 w-3.5 mr-1" />
                Nouveau parent
              </Button>
            </div>

            {parentMode === "search" ? (
              <div className="space-y-3">
                {parentId && (
                  <div className="flex items-center gap-2 rounded-md bg-primary/10 border border-primary/30 p-3 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span>Parent sélectionné : <strong>{parentName}</strong></span>
                    {suggestedFamilyId && (
                      <Badge variant="outline" className="text-[10px] bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30">
                        👨‍👩‍👧‍👦 Fratrie détectée
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-xs" onClick={() => { setParentId(null); setParentName(""); setSuggestedFamilyId(null); }}>
                      Changer
                    </Button>
                  </div>
                )}

                {!parentId && (
                  <Popover open={parentComboOpen} onOpenChange={setParentComboOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal text-muted-foreground">
                        <Search className="h-4 w-4 mr-2" />
                        Rechercher par nom, email ou téléphone…
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Nom, email ou téléphone…"
                          value={parentSearch}
                          onValueChange={setParentSearch}
                        />
                        <CommandList>
                          {parentSearch.length >= 2 && parentResults.length === 0 && (
                            <CommandEmpty>
                              <div className="flex flex-col items-center gap-2 py-4">
                                <p className="text-sm text-muted-foreground">Aucun profil trouvé</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => { setParentMode("new"); setParentComboOpen(false); }}
                                >
                                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                                  Créer un nouveau profil parent
                                </Button>
                              </div>
                            </CommandEmpty>
                          )}
                          {parentResults.length > 0 && (
                            <CommandGroup heading="Profils trouvés">
                              {parentResults.map((p) => (
                                <CommandItem
                                  key={p.user_id}
                                  value={p.user_id}
                                  onSelect={() => handleSelectParent(p)}
                                  className="flex flex-col items-start gap-1 py-2.5"
                                >
                                  <div className="flex items-center gap-2 w-full">
                                    <span className="font-medium text-sm">{p.display_name}</span>
                                    {p.roles.map((r) => {
                                      const cfg = ROLE_LABELS[r];
                                      if (!cfg) return null;
                                      return (
                                        <Badge key={r} variant="outline" className={cn("text-[9px] px-1.5 py-0 font-semibold", cfg.color)}>
                                          {cfg.label}
                                        </Badge>
                                      );
                                    })}
                                    {p.existingFamilyId && (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30 ml-auto">
                                        👨‍👩‍👧‍👦 Fratrie
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    {p.email && <span>{p.email}</span>}
                                    {p.phone && <span>{p.phone}</span>}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Prénom du parent</label>
                  <Input value={newParentPrenom} onChange={(e) => setNewParentPrenom(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Nom du parent</label>
                  <Input value={newParentNom} onChange={(e) => setNewParentNom(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Email</label>
                  <Input type="email" value={newParentEmail} onChange={(e) => setNewParentEmail(e.target.value)} placeholder="parent@email.com" />
                  {newParentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newParentEmail) && (
                    <p className="text-xs text-destructive mt-1">Email invalide</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Téléphone <span className="text-destructive">*</span></label>
                  <Input value={newParentPhone} onChange={(e) => setNewParentPhone(e.target.value)} placeholder="+33 6 12 34 56 78" />
                  {newParentPhone.trim().length > 0 && newParentPhone.trim().length < 10 && (
                    <p className="text-xs text-destructive mt-1">Minimum 10 caractères requis</p>
                  )}
                  {!newParentPhone.trim() && (
                    <p className="text-xs text-muted-foreground mt-1">Obligatoire pour un nouveau parent (min. 10 caractères)</p>
                  )}
                </div>
                {phoneDuplicate && (
                  <div className="sm:col-span-2 rounded-lg border border-amber-400/50 bg-amber-500/10 p-3 space-y-2">
                    <div className="flex items-start gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-amber-700">
                          Ce numéro est déjà lié au profil : <strong>{phoneDuplicate.display_name}</strong>
                        </p>
                        {phoneDuplicate.email && (
                          <p className="text-xs text-muted-foreground mt-0.5">{phoneDuplicate.email}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full border-amber-400/50 text-amber-700 hover:bg-amber-500/15"
                      onClick={handleUseExistingProfile}
                    >
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      Utiliser ce profil existant
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Retour
              </Button>
              <Button onClick={() => setStep(2)} disabled={!canGoStep3}>
                Suivant <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Recap & Finance ── */}
        {step === 2 && (
          <div className="space-y-4">
            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="grid grid-cols-[120px_1fr] gap-y-1.5">
                  <span className="text-muted-foreground">Élève</span>
                  <span className="font-medium">
                    {prenom} {nom}
                    {gender && (
                      <Badge variant="outline" className={cn("ml-2 text-[10px]", gender === "M" ? "bg-sky-100 text-sky-700 border-sky-300" : "bg-pink-100 text-pink-700 border-pink-300")}>
                        {gender}
                      </Badge>
                    )}
                  </span>
                  {age && (
                    <>
                      <span className="text-muted-foreground">Âge</span>
                      <span>{age} ans</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Niveau</span>
                  <span>{selectedLevelDisplay ?? "—"}</span>
                  <span className="text-muted-foreground">Classe</span>
                  <span>
                    {isSandbox ? (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-400/30 text-[10px]">
                        <Clock className="h-3 w-3 mr-1" /> Sandbox (en attente)
                      </Badge>
                    ) : (
                      classes.find((c) => c.id === classId)?.nom ?? "—"
                    )}
                  </span>
                  <span className="text-muted-foreground">Parent</span>
                  <span>
                    {parentId ? parentName : parentMode === "new" && newParentPrenom
                      ? `${newParentPrenom} ${newParentNom}` : "Aucun"}
                  </span>
                  {suggestedFamilyId && (
                    <>
                      <span className="text-muted-foreground">Fratrie</span>
                      <Badge variant="outline" className="text-[10px] w-fit bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30">
                        👨‍👩‍👧‍👦 Regroupement automatique
                      </Badge>
                    </>
                  )}
                  {(testLevel || assessmentNotes) && (
                    <>
                      <span className="text-muted-foreground">Évaluation</span>
                      <span>
                        {testLevel && <Badge variant="outline" className="text-[10px] mr-1">{testLevel === "debutant" ? "Débutant" : testLevel === "intermediaire" ? "Intermédiaire" : "Confirmé"}</Badge>}
                        {assessmentNotes && <span className="text-muted-foreground">{assessmentNotes.substring(0, 60)}{assessmentNotes.length > 60 ? "…" : ""}</span>}
                      </span>
                    </>
                  )}
                  {prefDays.length > 0 && (
                    <>
                      <span className="text-muted-foreground">Créneaux</span>
                      <span className="flex flex-wrap gap-1">
                        {prefDays.map(d => (
                          <Badge key={d} variant="outline" className="text-[10px]">{d}</Badge>
                        ))}
                      </span>
                    </>
                  )}
                  <span className="text-muted-foreground">Année</span>
                  <span>{annee}</span>
                </div>
              </CardContent>
            </Card>

            <Separator />

            <div>
              <label className="text-sm font-medium mb-1.5 block">Cycle de facturation</label>
              <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as "mensuel" | "trimestriel")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensuel">Mensuel (10 échéances)</SelectItem>
                  <SelectItem value="trimestriel">Trimestriel (4 échéances)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tarif mensuel</span>
                  <span className="font-semibold">{tarifMensuel.toLocaleString("fr-FR")} €</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Échéances à générer</span>
                  <span className="font-semibold">{nbFees} × {feeAmount.toLocaleString("fr-FR")} €</span>
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total annuel estimé</span>
                  <span className="text-lg font-bold text-primary">{totalAnnuel.toLocaleString("fr-FR")} €</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Retour
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Confirmer l'inscription
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Status display mapping (UI only — does NOT change DB values) ──
const STATUS_MAP: Record<string, { label: string; className: string }> = {
  en_attente: { label: "🟡 Sandbox (À placer)", className: "bg-amber-500/10 text-amber-700 border-amber-400/30" },
  place: { label: "🟢 Placé", className: "bg-brand-emerald/10 text-brand-emerald border-brand-emerald/30" },
  annule: { label: "🔴 Annulé", className: "bg-destructive/10 text-destructive border-destructive/30" },
};

function getStatusDisplay(statut: string | null, classe: { nom: string } | null) {
  if (!statut && !classe) return STATUS_MAP["en_attente"];
  if (classe === null) return STATUS_MAP["en_attente"];
  return STATUS_MAP[statut ?? ""] ?? { label: statut ?? "—", className: "" };
}

// ── Main Page ────────────────────────────────────────────
const Inscriptions = () => {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [enrollmentToDelete, setEnrollmentToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [statusTab, setStatusTab] = useState("all");
  const [filterLevel, setFilterLevel] = useState("__all__");
  const [filterClass, setFilterClass] = useState("__all__");

  // Real classes & levels from DB
  const [allClasses, setAllClasses] = useState<{ id: string; nom: string; level_id: string | null }[]>([]);
  const [allLevels, setAllLevels] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      supabase.from("madrasa_classes").select("id, nom, level_id").eq("org_id", orgId).order("nom"),
      supabase.from("madrasa_levels").select("id, label").eq("org_id", orgId).order("label"),
    ]).then(([clsRes, lvlRes]) => {
      setAllClasses((clsRes.data ?? []) as { id: string; nom: string; level_id: string | null }[]);
      setAllLevels((lvlRes.data ?? []) as { id: string; label: string }[]);
    });
  }, [orgId]);

  const fetchEnrollments = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("madrasa_enrollments")
        .select(`
          id, annee_scolaire, statut, created_at,
          student:madrasa_students!madrasa_enrollments_student_id_fkey(nom, prenom, niveau),
          classe:madrasa_classes!madrasa_enrollments_class_id_fkey(nom)
        `)
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setEnrollments((data ?? []).map((d: unknown) => {
        const row = d as Record<string, unknown>;
        return {
          ...row,
          student: row.student ?? null,
          classe: row.classe ?? null,
        } as EnrollmentRow;
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [orgId, toast]);

  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

  // Compute enrollment counts per class
  const classEnrollmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of enrollments) {
      if (e.classe?.nom) {
        // Find class by name to get its ID
        const cls = allClasses.find(c => c.nom === e.classe?.nom);
        if (cls) counts.set(cls.id, (counts.get(cls.id) ?? 0) + 1);
      }
    }
    return counts;
  }, [enrollments, allClasses]);

  const filtered = useMemo(() => {
    return enrollments.filter((e) => {
      // Tab filter
      if (statusTab === "sandbox" && !(e.statut === "en_attente" || e.classe === null)) return false;
      if (statusTab === "active" && !(e.statut === "place" && e.classe !== null)) return false;
      if (statusTab === "suspended" && e.statut !== "annule") return false;

      // Level filter (match by level label from allLevels)
      if (filterLevel !== "__all__") {
        const lvl = allLevels.find(l => l.id === filterLevel);
        if (lvl && e.student?.niveau !== lvl.label) return false;
        if (!lvl && e.student?.niveau !== filterLevel) return false;
      }

      // Class filter (by class ID)
      if (filterClass !== "__all__") {
        if (filterClass === "__sandbox__" && e.classe !== null) return false;
        if (filterClass !== "__sandbox__") {
          const cls = allClasses.find(c => c.id === filterClass);
          if (!cls || e.classe?.nom !== cls.nom) return false;
        }
      }

      // Search
      if (search) {
        const q = search.toLowerCase();
        const name = `${e.student?.prenom ?? ""} ${e.student?.nom ?? ""}`.toLowerCase();
        if (!name.includes(q) && !e.classe?.nom?.toLowerCase().includes(q)) return false;
      }

      return true;
    });
  }, [enrollments, search, statusTab, filterLevel, filterClass]);

  const stats = useMemo(() => {
    const total = enrollments.length;
    const actif = enrollments.filter((e) => e.statut === "place").length;
    const pending = enrollments.filter((e) => e.statut === "en_attente").length;
    const sandbox = enrollments.filter((e) => e.classe === null).length;
    return { total, actif, pending, sandbox };
  }, [enrollments]);

  return (
    <TooltipProvider>
    <main className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <ClipboardList className="h-5 w-5 text-brand-cyan" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">Inscriptions</h1>
            <p className="text-sm text-muted-foreground">Gestion des inscriptions scolaires — {getCurrentSchoolYear()}</p>
          </div>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast({ title: "Export CSV", description: "L'export CSV sera bientôt disponible." })}
          >
            <Download className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Exporter</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setBulkImportOpen(true)}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Import en masse</span>
          </Button>
          <Button onClick={() => setWizardOpen(true)} className="bg-brand-navy hover:bg-brand-navy/90">
            <UserPlus className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Nouvelle inscription</span>
            <span className="sm:hidden">Inscrire</span>
          </Button>
        </div>

        {/* KPI Cards */}
        <StatCards items={[
          { label: "Total Inscriptions", value: stats.total, icon: ClipboardList, subValue: `année ${getCurrentSchoolYear()}` },
          { label: "Actives", value: stats.actif, icon: CheckCircle2, subValue: `sur ${stats.total} inscription(s)`, progress: stats.total > 0 ? Math.round((stats.actif / stats.total) * 100) : 0 },
          { label: "En attente", value: stats.pending, icon: Clock, subValue: "à placer en classe" },
          { label: "Sandbox", value: stats.sandbox, icon: Inbox, subValue: "sans affectation" },
        ]} />

        {/* Tabs */}
        <Tabs value={statusTab} onValueChange={setStatusTab}>
          <TabsList>
           <TabsTrigger value="all">Toutes</TabsTrigger>
            <TabsTrigger value="sandbox">🟡 Sandbox</TabsTrigger>
            <TabsTrigger value="active">🟢 Placés</TabsTrigger>
            <TabsTrigger value="suspended">🔴 Annulés</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher un élève ou une classe…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <Select value={filterLevel} onValueChange={setFilterLevel}>
            <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm"><SelectValue placeholder="Tous les niveaux" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous les niveaux</SelectItem>
              {allLevels.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterClass} onValueChange={setFilterClass}>
            <SelectTrigger className="w-full sm:w-[220px] h-9 text-sm"><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Toutes les classes</SelectItem>
              <SelectItem value="__sandbox__">🟡 Sandbox (non placés)</SelectItem>
              {allClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom} ({classEnrollmentCounts.get(c.id) ?? 0})</SelectItem>)}
            </SelectContent>
          </Select>
          <ViewSwitcher viewMode={viewMode} onViewChange={setViewMode} className="shrink-0 ml-auto" />
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border bg-card p-10 text-center space-y-2">
            <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">
              {filterClass !== "__all__" && filterClass !== "__sandbox__"
                ? "Aucun élève inscrit dans cette classe pour le moment."
                : "Aucune inscription trouvée"}
            </p>
            <p className="text-xs text-muted-foreground">
              {filterClass !== "__all__" && filterClass !== "__sandbox__"
                ? "Les élèves peuvent être affectés depuis le Studio de placement."
                : "Cliquez sur \"Nouvelle inscription\" pour commencer."}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Élève</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead className="hidden md:table-cell">Niveau</TableHead>
                  <TableHead className="hidden sm:table-cell">Année</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden lg:table-cell">Date</TableHead>
                  <TableHead className="text-right w-[130px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => {
                  const initials = `${e.student?.prenom?.[0] ?? ""}${e.student?.nom?.[0] ?? ""}`.toUpperCase();
                  return (
                    <TableRow key={e.id} className="hover:bg-muted/40 border-b">
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-brand-navy/10 text-brand-navy text-xs font-semibold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-semibold text-sm">
                            {e.student ? `${e.student.prenom} ${e.student.nom}` : "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {e.classe?.nom ?? (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-400/30 font-semibold">
                            🟡 En attente d'affectation
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {e.student?.niveau ? (
                          <Badge variant="outline" className="text-[10px]">{e.student.niveau}</Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{e.annee_scolaire}</TableCell>
                      <TableCell>
                        {(() => {
                          const display = getStatusDisplay(e.statut, e.classe);
                          return (
                            <Badge variant="outline" className={cn("text-[10px]", display.className)}>
                              {display.label}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {e.created_at ? format(new Date(e.created_at), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => toast({ title: "👁️ Voir l'élève", description: "Fonctionnalité à venir." })}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Voir la fiche</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-brand-emerald hover:text-brand-emerald/80"
                                onClick={() => toast({ title: "✅ Valider", description: "Fonctionnalité à venir." })}
                              >
                                <UserCheck className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Valider l'inscription</TooltipContent>
                          </Tooltip>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => toast({ title: "✏️ Modifier le statut", description: "Fonctionnalité à venir." })}>
                                <Pencil className="h-3.5 w-3.5 mr-2" /> Modifier le statut
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setEnrollmentToDelete(e.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Annuler l'inscription
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {orgId && (
        <>
          <EnrollmentWizard
            open={wizardOpen}
            onOpenChange={setWizardOpen}
            orgId={orgId}
            onSuccess={fetchEnrollments}
          />
          <BulkImportDialog
            open={bulkImportOpen}
            onOpenChange={setBulkImportOpen}
            orgId={orgId}
            onSuccess={fetchEnrollments}
          />
        </>
      )}

      <AlertDialog open={!!enrollmentToDelete} onOpenChange={(open) => { if (!open) setEnrollmentToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cette inscription ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action retirera l'élève de sa classe ou de la file d'attente pour cette année scolaire. Le profil de l'élève ne sera pas supprimé de la base de données.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Retour</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={async () => {
                if (!enrollmentToDelete) return;
                setDeleting(true);
                try {
                  const { error } = await supabase
                    .from("madrasa_enrollments")
                    .update({ statut: "annule" })
                    .eq("id", enrollmentToDelete);
                  if (error) throw error;
                  toast({ title: "✅ Inscription annulée", description: "L'inscription a été retirée avec succès." });
                  fetchEnrollments();
                } catch (err: unknown) {
                  const message = err instanceof Error ? err.message : "Erreur inconnue";
                  toast({ title: "Erreur", description: message, variant: "destructive" });
                } finally {
                  setDeleting(false);
                  setEnrollmentToDelete(null);
                }
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Confirmer l'annulation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
    </TooltipProvider>
  );
};

export default Inscriptions;
