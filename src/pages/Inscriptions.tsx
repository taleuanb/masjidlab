import { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ClipboardList, PlusCircle, Loader2, Check, ChevronRight, ChevronLeft,
  User, Users, Receipt, Search, GraduationCap, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";

// ── Types ────────────────────────────────────────────────
interface Level {
  id: string;
  label: string;
  tarif_mensuel: number | null;
}

interface ClassRow {
  id: string;
  nom: string;
  niveau: string | null;
}

interface EnrollmentRow {
  id: string;
  annee_scolaire: string;
  statut: string | null;
  created_at: string | null;
  student: { nom: string; prenom: string; niveau: string | null } | null;
  classe: { nom: string } | null;
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
  const [dateNaissance, setDateNaissance] = useState<Date | undefined>();
  const [niveauId, setNiveauId] = useState("");
  const [classId, setClassId] = useState("");

  // Step 2: Parent
  const [parentMode, setParentMode] = useState<"search" | "new">("search");
  const [parentSearch, setParentSearch] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [parentName, setParentName] = useState("");
  const [newParentNom, setNewParentNom] = useState("");
  const [newParentPrenom, setNewParentPrenom] = useState("");
  const [newParentEmail, setNewParentEmail] = useState("");
  const [newParentPhone, setNewParentPhone] = useState("");

  // Data
  const [levels, setLevels] = useState<Level[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [parentResults, setParentResults] = useState<{ user_id: string; display_name: string; email: string | null }[]>([]);
  const [billingCycle, setBillingCycle] = useState<"mensuel" | "trimestriel">("mensuel");
  const [duplicateWarning, setDuplicateWarning] = useState("");

  const annee = getCurrentSchoolYear();

  // Fetch levels & classes
  useEffect(() => {
    if (!open || !orgId) return;
    Promise.all([
      supabase.from("madrasa_levels").select("id, label, tarif_mensuel").eq("org_id", orgId),
      supabase.from("madrasa_classes").select("id, nom, niveau").eq("org_id", orgId),
    ]).then(([levelsRes, classesRes]) => {
      setLevels((levelsRes.data ?? []) as Level[]);
      setClasses((classesRes.data ?? []) as ClassRow[]);
    });
  }, [open, orgId]);

  // Search parents
  useEffect(() => {
    if (parentSearch.length < 2 || !orgId) {
      setParentResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .eq("org_id", orgId)
        .or(`display_name.ilike.%${parentSearch}%,email.ilike.%${parentSearch}%`)
        .limit(5);
      setParentResults((data ?? []) as any[]);
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

  const selectedLevel = levels.find((l) => l.id === niveauId);
  const filteredClasses = niveauId
    ? classes.filter((c) => c.niveau === selectedLevel?.label || !c.niveau)
    : classes;

  const tarifMensuel = selectedLevel?.tarif_mensuel ?? 0;
  const nbFees = billingCycle === "mensuel" ? 10 : 4;
  const feeAmount = billingCycle === "mensuel" ? tarifMensuel : tarifMensuel * 3;
  const totalAnnuel = billingCycle === "mensuel" ? tarifMensuel * 10 : feeAmount * 4;

  const canGoStep2 = nom.trim() && prenom.trim() && classId;
  const canGoStep3 = parentMode === "search" ? true : (newParentEmail ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newParentEmail) : true);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("enroll-student", {
        body: {
          student_nom: nom.trim(),
          student_prenom: prenom.trim(),
          student_date_naissance: dateNaissance ? format(dateNaissance, "yyyy-MM-dd") : null,
          student_niveau: selectedLevel?.label ?? null,
          parent_id: parentId,
          parent_nom: parentMode === "new" ? newParentNom : null,
          parent_prenom: parentMode === "new" ? newParentPrenom : null,
          parent_email: parentMode === "new" ? newParentEmail : null,
          parent_phone: parentMode === "new" ? newParentPhone : null,
          class_id: classId,
          annee_scolaire: annee,
          tarif_mensuel: tarifMensuel,
          billing_cycle: billingCycle,
          org_id: orgId,
        },
      });

      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);

      toast({
        title: "✅ Inscription réussie !",
        description: `${prenom} ${nom} inscrit(e). Parent lié et ${result.fees_generated} échéances générées.`,
      });

      // Reset
      setStep(0);
      setNom(""); setPrenom(""); setDateNaissance(undefined); setNiveauId(""); setClassId("");
      setParentId(null); setParentName(""); setParentSearch("");
      setNewParentNom(""); setNewParentPrenom(""); setNewParentEmail(""); setNewParentPhone("");
      setBillingCycle("mensuel");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
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

            <div>
              <label className="text-sm font-medium mb-1 block">Date de naissance</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !dateNaissance && "text-muted-foreground")}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {dateNaissance ? format(dateNaissance, "dd MMMM yyyy", { locale: fr }) : "Sélectionner une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateNaissance}
                    onSelect={setDateNaissance}
                    disabled={(date) => date > new Date() || date < new Date("2000-01-01")}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Niveau</label>
                <Select value={niveauId} onValueChange={setNiveauId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un niveau" />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.label} {l.tarif_mensuel ? `— ${l.tarif_mensuel} €/mois` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Classe *</label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une classe" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nom} {c.niveau ? `(${c.niveau})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

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
                onClick={() => { setParentMode("new"); setParentId(null); setParentName(""); }}
              >
                <PlusCircle className="h-3.5 w-3.5 mr-1" />
                Nouveau parent
              </Button>
            </div>

            {parentMode === "search" ? (
              <div className="space-y-3">
                <Input
                  placeholder="Rechercher par nom ou email…"
                  value={parentSearch}
                  onChange={(e) => setParentSearch(e.target.value)}
                />
                {parentId && (
                  <div className="flex items-center gap-2 rounded-md bg-primary/10 border border-primary/30 p-3 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    Parent sélectionné : <strong>{parentName}</strong>
                  </div>
                )}
                {parentResults.length > 0 && (
                  <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                    {parentResults.map((p) => (
                      <button
                        key={p.user_id}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors",
                          parentId === p.user_id && "bg-primary/5"
                        )}
                        onClick={() => { setParentId(p.user_id); setParentName(p.display_name); }}
                      >
                        <span className="font-medium">{p.display_name}</span>
                        {p.email && <span className="text-muted-foreground ml-2">{p.email}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {parentSearch.length >= 2 && parentResults.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucun résultat. Essayez "Nouveau parent".</p>
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
                  <label className="text-sm font-medium mb-1 block">Téléphone</label>
                  <Input value={newParentPhone} onChange={(e) => setNewParentPhone(e.target.value)} placeholder="+33…" />
                </div>
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
                  <span className="font-medium">{prenom} {nom}</span>
                  <span className="text-muted-foreground">Date naiss.</span>
                  <span>{dateNaissance ? format(dateNaissance, "dd/MM/yyyy") : "—"}</span>
                  <span className="text-muted-foreground">Niveau</span>
                  <span>{selectedLevel?.label ?? "—"}</span>
                  <span className="text-muted-foreground">Classe</span>
                  <span>{classes.find((c) => c.id === classId)?.nom ?? "—"}</span>
                  <span className="text-muted-foreground">Parent</span>
                  <span>
                    {parentId ? parentName : parentMode === "new" && newParentPrenom
                      ? `${newParentPrenom} ${newParentNom}` : "Aucun"}
                  </span>
                  <span className="text-muted-foreground">Année</span>
                  <span>{annee}</span>
                </div>
              </CardContent>
            </Card>

            <Separator />

            <div>
              <label className="text-sm font-medium mb-1.5 block">Cycle de facturation</label>
              <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as any)}>
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

// ── Status badge colors ──
const STATUS_COLORS: Record<string, string> = {
  Actif: "bg-green-500/10 text-green-700 border-green-400/30",
  "En attente": "bg-amber-500/10 text-amber-600 border-amber-400/30",
  Suspendu: "bg-destructive/10 text-destructive border-destructive/30",
};

// ── Main Page ────────────────────────────────────────────
const Inscriptions = () => {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [search, setSearch] = useState("");

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
      setEnrollments((data ?? []).map((d: any) => ({
        ...d,
        student: d.student ?? null,
        classe: d.classe ?? null,
      })));
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [orgId, toast]);

  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

  const filtered = useMemo(() => {
    if (!search) return enrollments;
    const q = search.toLowerCase();
    return enrollments.filter((e) => {
      const name = `${e.student?.prenom ?? ""} ${e.student?.nom ?? ""}`.toLowerCase();
      return name.includes(q) || e.classe?.nom?.toLowerCase().includes(q);
    });
  }, [enrollments, search]);

  const stats = useMemo(() => {
    const total = enrollments.length;
    const actif = enrollments.filter((e) => e.statut === "Actif").length;
    const pending = enrollments.filter((e) => e.statut === "En attente").length;
    return { total, actif, pending };
  }, [enrollments]);

  return (
    <main className="flex-1 overflow-auto">
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <ClipboardList className="h-6 w-6 text-primary" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">Inscriptions</h1>
            <p className="text-sm text-muted-foreground">Gestion des inscriptions scolaires — {getCurrentSchoolYear()}</p>
          </div>
          <div className="flex-1" />
          <Button onClick={() => setWizardOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Nouvelle inscription</span>
            <span className="sm:hidden">Inscrire</span>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total inscriptions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.actif}</p>
              <p className="text-xs text-muted-foreground">Actives</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">En attente</p>
            </CardContent>
          </Card>
        </div>

        {/* Search + Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un élève ou une classe…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Aucune inscription trouvée</p>
                <p className="text-xs mt-1">Cliquez sur "Nouvelle inscription" pour commencer.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Élève</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Niveau</TableHead>
                    <TableHead>Année</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {e.student ? `${e.student.prenom} ${e.student.nom}` : "—"}
                      </TableCell>
                      <TableCell>{e.classe?.nom ?? "—"}</TableCell>
                      <TableCell>
                        {e.student?.niveau ? (
                          <Badge variant="outline" className="text-[10px]">{e.student.niveau}</Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{e.annee_scolaire}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", STATUS_COLORS[e.statut ?? ""] ?? "")}
                        >
                          {e.statut ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {e.created_at ? format(new Date(e.created_at), "dd/MM/yyyy") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {orgId && (
        <EnrollmentWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          orgId={orgId}
          onSuccess={fetchEnrollments}
        />
      )}
    </main>
  );
};

export default Inscriptions;
