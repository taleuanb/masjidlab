import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  FileSpreadsheet, Download, Upload, Loader2, HelpCircle,
  AlertTriangle, RefreshCw, CheckCircle2, Table2, X, Rocket,
  PartyPopper, RotateCcw, ArrowRight, ArrowLeft,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";

// ── Types ──
interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  onSuccess?: () => void;
}

export interface ParsedRow {
  student: { nom: string; prenom: string; age: number | null; genre: string };
  parent: { nom: string; prenom: string; phone: string; email: string };
  pedagogy: { cycle_name: string; level_name: string };
}

interface ValidatedRow extends ParsedRow {
  rowIndex: number;
  status: "valid" | "error";
  errors: string[];
}

interface CycleRef { id: string; nom: string }
interface LevelRef { id: string; label: string; cycle_id: string | null }

interface BatchRowResult {
  rowIndex: number;
  success: boolean;
  student_id?: string;
  error?: string;
}

interface ImportReport {
  totalSent: number;
  successCount: number;
  failures: BatchRowResult[];
}

type Phase = "idle" | "importing" | "paused" | "done";
type Step = 1 | 2 | 3;

// ── System fields ──
interface SystemField {
  key: string; label: string; group: string; required: boolean; aliases: string[];
}

const SYSTEM_FIELDS: SystemField[] = [
  { key: "student_nom", label: "Nom", group: "Élève", required: true, aliases: ["nom", "last name", "family name", "nom eleve", "nom élève", "nom *"] },
  { key: "student_prenom", label: "Prénom", group: "Élève", required: true, aliases: ["prenom", "prénom", "first name", "prenom eleve", "prénom élève", "prénom *"] },
  { key: "student_genre", label: "Genre (M/F)", group: "Élève", required: true, aliases: ["genre", "sexe", "sex", "gender", "m/f", "genre *", "genre * (m/f)"] },
  { key: "student_age", label: "Âge", group: "Élève", required: true, aliases: ["age", "âge", "âge *"] },
  { key: "cycle_name", label: "Nom du Cycle", group: "Pédagogie", required: true, aliases: ["cycle", "filiere", "filière", "parcours", "cycle *"] },
  { key: "level_name", label: "Nom du Niveau", group: "Pédagogie", required: true, aliases: ["niveau", "level", "classe", "class", "niveau *"] },
  { key: "parent_nom", label: "Nom Parent", group: "Parent", required: true, aliases: ["nom parent", "nom du parent", "parent nom", "nom responsable", "nom parent *"] },
  { key: "parent_prenom", label: "Prénom Parent", group: "Parent", required: true, aliases: ["prenom parent", "prénom parent", "parent prenom", "prénom responsable", "prénom parent *"] },
  { key: "parent_phone", label: "Téléphone Parent", group: "Parent", required: true, aliases: ["telephone", "téléphone", "tel", "phone", "gsm", "mobile", "portable", "num tel", "numéro", "telephone parent", "téléphone parent", "téléphone parent *"] },
  { key: "parent_email", label: "Email Parent", group: "Parent", required: false, aliases: ["email", "e-mail", "mail", "courriel", "email parent"] },
];

const GROUPS = [
  { key: "Élève", icon: "👤", description: "Informations de l'élève" },
  { key: "Pédagogie", icon: "📚", description: "Cycle et niveau" },
  { key: "Parent", icon: "👨‍👩‍👦", description: "Responsable légal" },
];

const BATCH_SIZE = 20;

// ── Helpers ──
function normalizeStr(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
}

function fuzzyMatch(colName: string, aliases: string[]): boolean {
  const n = normalizeStr(colName);
  return aliases.some((a) => {
    const na = normalizeStr(a);
    return n === na || n.includes(na) || na.includes(n);
  });
}

function autoMap(fileColumns: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const field of SYSTEM_FIELDS) {
    const match = fileColumns.find((col) => fuzzyMatch(col, field.aliases));
    if (match) mapping[field.key] = match;
  }
  return mapping;
}

function getCurrentSchoolYear(): string {
  const now = new Date();
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}/${year + 1}`;
}

/**
 * Finds the real header row in raw 2D array data.
 * Apple Numbers (and some other tools) add metadata rows before the actual headers.
 * We scan for a row containing "Nom" AND ("Prénom" or "Genre") to detect the header.
 */
function findHeaderRow(rawRows: unknown[][]): number {
  for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
    const row = rawRows[i];
    if (!row || !Array.isArray(row)) continue;
    const cells = row.map((c) => normalizeStr(String(c ?? "")));
    const hasNom = cells.some((c) => c === "nom" || c.includes("nom"));
    const hasPrenom = cells.some((c) => c === "prenom" || c.includes("prenom"));
    const hasGenre = cells.some((c) => c === "genre" || c.includes("genre"));
    if (hasNom && (hasPrenom || hasGenre)) return i;
  }
  return 0; // fallback: first row
}

function validateRow(
  row: ParsedRow, rowIndex: number,
  cycleNames: Set<string>, levelNames: Set<string>,
  cycleLevelMap: Map<string, Set<string>>,
): ValidatedRow {
  const errors: string[] = [];
  if (!row.student.nom) errors.push("Nom élève manquant");
  if (!row.student.prenom) errors.push("Prénom élève manquant");
  if (!row.parent.nom) errors.push("Nom parent manquant");
  if (!row.parent.prenom) errors.push("Prénom parent manquant");
  if (!row.parent.phone) errors.push("Téléphone parent manquant");
  if (!row.pedagogy.level_name) errors.push("Nom du niveau manquant");
  if (row.student.genre !== "M" && row.student.genre !== "F") errors.push(`Genre invalide "${row.student.genre}" — doit être M ou F`);
  if (row.student.age === null || isNaN(row.student.age)) errors.push("Âge manquant ou invalide");
  else if (!Number.isInteger(row.student.age) || row.student.age < 3 || row.student.age > 99) errors.push(`Âge "${row.student.age}" hors limites (3-99)`);
  if (row.pedagogy.cycle_name && cycleNames.size > 0 && !cycleNames.has(row.pedagogy.cycle_name)) errors.push(`Cycle "${row.pedagogy.cycle_name}" inconnu`);
  if (row.pedagogy.level_name && levelNames.size > 0 && !levelNames.has(row.pedagogy.level_name)) errors.push(`Niveau "${row.pedagogy.level_name}" inconnu`);
  if (row.pedagogy.cycle_name && row.pedagogy.level_name && cycleLevelMap.has(row.pedagogy.cycle_name) && !cycleLevelMap.get(row.pedagogy.cycle_name)!.has(row.pedagogy.level_name))
    errors.push(`Le niveau "${row.pedagogy.level_name}" n'appartient pas au cycle "${row.pedagogy.cycle_name}"`);
  if (row.parent.phone && row.parent.phone.replace(/\D/g, "").length < 10) errors.push("Téléphone parent : minimum 10 chiffres");
  return { ...row, rowIndex, status: errors.length > 0 ? "error" : "valid", errors };
}

// ── Stepper indicator ──
function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-4">
      {Array.from({ length: total }, (_, i) => {
        const stepNum = (i + 1) as Step;
        const labels = ["Fichier", "Mapping", "Validation"];
        const isActive = stepNum === current;
        const isDone = stepNum < current;
        return (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <div className={`w-8 h-0.5 rounded ${isDone ? "bg-primary" : "bg-border"}`} />}
            <div className="flex flex-col items-center gap-0.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isActive ? "bg-primary text-primary-foreground" : isDone ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : stepNum}
              </div>
              <span className={`text-[10px] font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>{labels[i]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Component ──
export function BulkImportDialog({ open, onOpenChange, orgId, onSuccess }: BulkImportDialogProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState<Step>(1);

  // Reference data
  const [refCycles, setRefCycles] = useState<CycleRef[]>([]);
  const [refLevels, setRefLevels] = useState<LevelRef[]>([]);
  const [refLoaded, setRefLoaded] = useState(false);
  const [academicYearId, setAcademicYearId] = useState<string | null>(null);

  // File state
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [skipErrors, setSkipErrors] = useState(false);

  // Import state
  const [phase, setPhase] = useState<Phase>("idle");
  const [batchesSent, setBatchesSent] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [pausedBatches, setPausedBatches] = useState<ValidatedRow[][]>([]);
  const cancelledRef = useRef(false);

  // ── Load reference data ──
  useEffect(() => {
    if (!open || refLoaded) return;
    (async () => {
      const [cRes, lRes, ayRes] = await Promise.all([
        supabase.from("madrasa_cycles").select("id, nom").eq("org_id", orgId),
        supabase.from("madrasa_levels").select("id, label, cycle_id").eq("org_id", orgId),
        supabase.from("madrasa_academic_years").select("id").eq("org_id", orgId).eq("is_current", true).maybeSingle(),
      ]);
      setRefCycles(cRes.data ?? []);
      setRefLevels(lRes.data ?? []);
      setAcademicYearId(ayRes.data?.id ?? null);
      setRefLoaded(true);
    })();
  }, [open, orgId, refLoaded]);

  const cycleNames = useMemo(() => new Set(refCycles.map((c) => c.nom)), [refCycles]);
  const levelNames = useMemo(() => new Set(refLevels.map((l) => l.label)), [refLevels]);
  const cycleLevelMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const level of refLevels) {
      const cycle = refCycles.find((c) => c.id === level.cycle_id);
      if (cycle) { if (!map.has(cycle.nom)) map.set(cycle.nom, new Set()); map.get(cycle.nom)!.add(level.label); }
    }
    return map;
  }, [refCycles, refLevels]);

  const stats = useMemo(() => {
    if (!validatedRows) return null;
    const valid = validatedRows.filter((r) => r.status === "valid").length;
    return { total: validatedRows.length, valid, errors: validatedRows.length - valid };
  }, [validatedRows]);

  // ── Reset ──
  const resetAll = useCallback(() => {
    setFileColumns([]); setFileRows([]); setFileName(null); setFileError(null);
    setMapping({}); setValidatedRows(null); setSkipErrors(false);
    setPhase("idle"); setBatchesSent(0); setTotalBatches(0);
    setImportReport(null); setPausedBatches([]);
    cancelledRef.current = false;
    setStep(1);
  }, []);

  // ── File drop (with Apple Numbers fix) ──
  const handleFileDrop = useCallback((acceptedFiles: File[]) => {
    setFileError(null); setValidatedRows(null); setPhase("idle"); setImportReport(null);
    const file = acceptedFiles[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onerror = () => setFileError("Impossible de lire le fichier.");
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) { setFileError("Aucune feuille trouvée dans le fichier."); return; }

        // Use header:1 to get raw 2D array (fixes Apple Numbers metadata rows)
        const rawRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: "" });
        if (!rawRows.length) { setFileError("Fichier vide."); return; }

        // Find the real header row (skip Numbers metadata)
        const headerIdx = findHeaderRow(rawRows as unknown[][]);
        const headerRow = (rawRows[headerIdx] as unknown[]).map((c) => String(c ?? "").trim()).filter(Boolean);
        if (headerRow.length < 2) { setFileError("Pas assez de colonnes détectées."); return; }

        // Build clean JSON from header + data rows
        const dataRows = rawRows.slice(headerIdx + 1);
        const cleanJson: Record<string, unknown>[] = [];
        for (const raw of dataRows) {
          const arr = raw as unknown[];
          // Skip completely empty rows
          const hasData = arr.some((cell) => String(cell ?? "").trim() !== "");
          if (!hasData) continue;
          const obj: Record<string, unknown> = {};
          headerRow.forEach((col, i) => { obj[col] = arr[i] ?? ""; });
          cleanJson.push(obj);
        }

        if (!cleanJson.length) { setFileError("Aucune donnée trouvée après l'en-tête."); return; }

        setFileColumns(headerRow);
        setFileRows(cleanJson);
        setMapping(autoMap(headerRow));
        setStep(2);
      } catch { setFileError("Fichier invalide ou corrompu."); }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"], "text/csv": [".csv"] },
    maxFiles: 1, multiple: false, disabled: phase === "importing",
  });

  const updateMapping = useCallback((fieldKey: string, colName: string) => {
    setMapping((prev) => ({ ...prev, [fieldKey]: colName === "__none__" ? "" : colName }));
  }, []);

  const requiredMapped = useMemo(() => SYSTEM_FIELDS.filter((f) => f.required).every((f) => !!mapping[f.key]), [mapping]);
  const previewRows = useMemo(() => fileRows.slice(0, 3), [fileRows]);

  // ── Analyze ──
  const handleAnalyze = useCallback(() => {
    setAnalyzing(true);
    try {
      const rows: ValidatedRow[] = fileRows.map((row, i) => {
        const parsed: ParsedRow = {
          student: { nom: String(row[mapping.student_nom] ?? "").trim(), prenom: String(row[mapping.student_prenom] ?? "").trim(), age: mapping.student_age ? parseInt(String(row[mapping.student_age]), 10) || null : null, genre: String(row[mapping.student_genre] ?? "").trim().toUpperCase() },
          parent: { nom: String(row[mapping.parent_nom] ?? "").trim(), prenom: String(row[mapping.parent_prenom] ?? "").trim(), phone: String(row[mapping.parent_phone] ?? "").replace(/[\s.\-()]/g, "").trim(), email: String(row[mapping.parent_email] ?? "").trim() },
          pedagogy: { cycle_name: String(row[mapping.cycle_name] ?? "").trim(), level_name: String(row[mapping.level_name] ?? "").trim() },
        };
        return validateRow(parsed, i + 1, cycleNames, levelNames, cycleLevelMap);
      });
      setValidatedRows(rows);
      setStep(3);
      const vc = rows.filter((r) => r.status === "valid").length;
      const ec = rows.length - vc;
      toast({ title: ec > 0 ? "Analyse terminée ⚠️" : "Analyse terminée ✅", description: ec > 0 ? `${vc} valide(s), ${ec} erreur(s).` : `${vc} ligne(s) prête(s).`, variant: ec > 0 ? "destructive" : "default" });
    } catch { toast({ title: "Erreur", description: "Erreur d'analyse.", variant: "destructive" }); }
    finally { setAnalyzing(false); }
  }, [fileRows, mapping, cycleNames, levelNames, cycleLevelMap, toast]);

  // ── Batch import ──
  const sendBatches = useCallback(async (batches: ValidatedRow[][]) => {
    setPhase("importing");
    cancelledRef.current = false;
    const report: ImportReport = importReport ?? { totalSent: 0, successCount: 0, failures: [] };
    let sentSoFar = batchesSent;

    for (let i = 0; i < batches.length; i++) {
      if (cancelledRef.current) { setPausedBatches(batches.slice(i)); setPhase("paused"); return; }
      const batch = batches[i];
      try {
        const { data, error } = await supabase.functions.invoke("bulk-enroll-students", {
          body: {
            rows: batch.map((r) => ({ student: r.student, parent: r.parent, pedagogy: r.pedagogy, rowIndex: r.rowIndex })),
            org_id: orgId,
            academic_year_id: academicYearId,
            annee_scolaire_label: getCurrentSchoolYear(),
          },
        });
        if (error) throw error;
        const batchResults: BatchRowResult[] = data?.results ?? [];
        report.totalSent += batch.length;
        report.successCount += batchResults.filter((r: BatchRowResult) => r.success).length;
        report.failures.push(...batchResults.filter((r: BatchRowResult) => !r.success));
      } catch (err: unknown) {
        report.failures.push(...batch.map((r) => ({
          rowIndex: r.rowIndex, success: false,
          error: err instanceof Error ? err.message : "Erreur réseau",
        })));
        setPausedBatches(batches.slice(i));
        setImportReport({ ...report });
        setPhase("paused");
        toast({ title: "Lot échoué", description: `Erreur sur le lot ${sentSoFar + i + 1}. Vous pouvez réessayer.`, variant: "destructive" });
        return;
      }
      sentSoFar++;
      setBatchesSent(sentSoFar);
      setImportReport({ ...report });
    }
    setImportReport({ ...report });
    setPhase("done");
    setPausedBatches([]);
  }, [orgId, academicYearId, importReport, batchesSent, toast]);

  const handleStartImport = useCallback(() => {
    if (!validatedRows) return;
    const rowsToSend = validatedRows.filter((r) => r.status === "valid");
    const batches: ValidatedRow[][] = [];
    for (let i = 0; i < rowsToSend.length; i += BATCH_SIZE) {
      batches.push(rowsToSend.slice(i, i + BATCH_SIZE));
    }
    setTotalBatches(batches.length);
    setBatchesSent(0);
    setImportReport({ totalSent: 0, successCount: 0, failures: [] });
    sendBatches(batches);
  }, [validatedRows, sendBatches]);

  const handleRetryRemaining = useCallback(() => {
    if (pausedBatches.length === 0) return;
    sendBatches(pausedBatches);
  }, [pausedBatches, sendBatches]);

  const handleFinish = useCallback(() => {
    onSuccess?.();
    resetAll();
    onOpenChange(false);
  }, [onSuccess, resetAll, onOpenChange]);

  // ── Template download ──
  const handleDownloadTemplate = useCallback(async () => {
    setGenerating(true);
    try {
      const cycles = refLoaded ? refCycles : (await supabase.from("madrasa_cycles").select("id, nom").eq("org_id", orgId)).data ?? [];
      const levels = refLoaded ? refLevels : (await supabase.from("madrasa_levels").select("id, label, cycle_id").eq("org_id", orgId)).data ?? [];
      const cNames = cycles.map((c) => c.nom);
      const lNames = levels.map((l) => l.label);
      const wb = XLSX.utils.book_new();
      const headers = ["Nom *", "Prénom *", "Genre * (M/F)", "Âge *", "Cycle *", "Niveau *", "Nom Parent *", "Prénom Parent *", "Téléphone Parent *", "Email Parent"];
      const exampleRow = ["Dupont", "Amine", "M", 8, cNames[0] ?? "Primaire", lNames[0] ?? "Niveau 1", "Dupont", "Fatima", "0612345678", "fatima@email.com"];
      const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
      ws["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 8 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 24 }];
      headers.forEach((_, i) => { const cell = XLSX.utils.encode_cell({ r: 0, c: i }); if (ws[cell]) ws[cell].s = { font: { bold: true }, fill: { fgColor: { rgb: "F3F4F6" } }, alignment: { horizontal: "center" } }; });
      if (cNames.length > 0 || lNames.length > 0) {
        const refData: string[][] = []; const maxLen = Math.max(cNames.length, lNames.length, 2);
        for (let i = 0; i < maxLen; i++) refData.push([i < 2 ? ["M", "F"][i] : "", cNames[i] ?? "", lNames[i] ?? ""]);
        const refWs = XLSX.utils.aoa_to_sheet([["Genre", "Cycles", "Niveaux"], ...refData]);
        refWs["!cols"] = [{ wch: 10 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, refWs, "Référentiels");
      }
      XLSX.utils.book_append_sheet(wb, ws, "Inscriptions");
      const maxRows = 500;
      const dvs: Array<Record<string, unknown>> = [];
      dvs.push({ type: "list", sqref: `C2:C${maxRows}`, formula1: `"M,F"`, showErrorMessage: true, errorTitle: "Valeur invalide", error: "M ou F." });
      if (cNames.length) dvs.push({ type: "list", sqref: `E2:E${maxRows}`, formula1: `"${cNames.join(",")}"`, showErrorMessage: true, errorTitle: "Cycle invalide", error: "Sélectionnez un cycle." });
      if (lNames.length) dvs.push({ type: "list", sqref: `F2:F${maxRows}`, formula1: `"${lNames.join(",")}"`, showErrorMessage: true, errorTitle: "Niveau invalide", error: "Sélectionnez un niveau." });
      dvs.push({ type: "whole", operator: "between", sqref: `D2:D${maxRows}`, formula1: "3", showErrorMessage: true, errorTitle: "Âge invalide", error: "Entier entre 3 et 99." });
      (ws as Record<string, unknown>)["!dataValidation"] = dvs;
      const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbOut], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url;
      a.download = `template_inscriptions_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      toast({ title: "Template généré ✅", description: `${cNames.length} cycles et ${lNames.length} niveaux inclus.` });
    } catch (err: unknown) { toast({ title: "Erreur", description: err instanceof Error ? err.message : "Erreur", variant: "destructive" }); }
    finally { setGenerating(false); }
  }, [orgId, toast, refLoaded, refCycles, refLevels]);

  // ── Computed ──
  const hasFile = fileColumns.length > 0;
  const importableCount = stats ? stats.valid : 0;
  const canImport = importableCount > 0;
  const progressPercent = totalBatches > 0 ? Math.round((batchesSent / totalBatches) * 100) : 0;
  const isLocked = phase === "importing";

  const mappedCount = useMemo(() => SYSTEM_FIELDS.filter((f) => !!mapping[f.key]).length, [mapping]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (isLocked) return; if (!v) resetAll(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => { if (isLocked) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importation massive d'élèves
          </DialogTitle>
          <DialogDescription>
            Importez plusieurs élèves en une seule opération à partir d'un fichier Excel.
          </DialogDescription>
        </DialogHeader>

        {/* ── RESULT SCREEN ── */}
        {phase === "done" && importReport && (
          <div className="space-y-5 mt-2">
            <div className="text-center space-y-3 py-4">
              <PartyPopper className="h-12 w-12 text-primary mx-auto" />
              <h3 className="text-lg font-bold text-foreground">Importation terminée !</h3>
              <p className="text-sm text-muted-foreground">
                <span className="text-primary font-semibold">{importReport.successCount}</span> élève{importReport.successCount > 1 ? "s" : ""} importé{importReport.successCount > 1 ? "s" : ""} avec succès.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge variant="outline" className="text-xs"><CheckCircle2 className="h-3 w-3 mr-1" /> Succès : {importReport.successCount}</Badge>
              {importReport.failures.length > 0 && (
                <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Échecs : {importReport.failures.length}</Badge>
              )}
            </div>
            {importReport.failures.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-destructive">Détail des erreurs serveur :</p>
                <ScrollArea className="rounded-lg border border-destructive/20 max-h-[160px]">
                  <div className="p-2 space-y-1">
                    {importReport.failures.map((f, i) => (
                      <div key={i} className="text-xs flex items-start gap-1.5">
                        <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                        <span><span className="font-medium">Ligne {f.rowIndex}</span> : {f.error ?? "Erreur inconnue"}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            <div className="flex justify-center pt-2">
              <Button onClick={handleFinish}><CheckCircle2 className="h-4 w-4 mr-1.5" />Terminer</Button>
            </div>
          </div>
        )}

        {/* ── IMPORTING / PAUSED SCREEN ── */}
        {(phase === "importing" || phase === "paused") && (
          <div className="space-y-5 mt-2 py-4">
            <div className="text-center space-y-2">
              {phase === "importing" ? (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                  <p className="text-sm font-medium text-foreground">Importation du lot {batchesSent + 1}/{totalBatches} en cours…</p>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
                  <p className="text-sm font-medium text-foreground">Importation en pause — un lot a échoué</p>
                </>
              )}
            </div>
            <div className="space-y-1.5 px-4">
              <Progress value={progressPercent} className="h-2.5" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{batchesSent}/{totalBatches} lot{totalBatches > 1 ? "s" : ""}</span>
                <span>{progressPercent}%</span>
              </div>
            </div>
            {importReport && (
              <div className="flex justify-center gap-2">
                <Badge variant="outline" className="text-xs">✅ {importReport.successCount} réussi{importReport.successCount > 1 ? "s" : ""}</Badge>
                {importReport.failures.length > 0 && (
                  <Badge variant="destructive" className="text-xs">❌ {importReport.failures.length} échec{importReport.failures.length > 1 ? "s" : ""}</Badge>
                )}
              </div>
            )}
            {phase === "paused" && (
              <div className="flex justify-center gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setPhase("done")}>Abandonner</Button>
                <Button size="sm" onClick={handleRetryRemaining}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Réessayer ({pausedBatches.length} lot{pausedBatches.length > 1 ? "s" : ""})
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── IDLE: 3-STEP FLOW ── */}
        {phase === "idle" && (
          <div className="space-y-4 mt-1">
            <StepIndicator current={step} total={3} />

            {/* Reset button when file loaded */}
            {hasFile && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground truncate flex-1">{fileName}</span>
                <Badge variant="outline" className="text-[10px]">{fileRows.length} lignes</Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetAll} title="Changer de fichier">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* ─── STEP 1: FILE ─── */}
            {step === 1 && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Download className="h-4 w-4 text-primary" />
                      Template d'importation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2">
                      <HelpCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Téléchargez ce template pré-rempli avec vos cycles et niveaux. Les colonnes marquées <span className="text-destructive font-bold">*</span> sont obligatoires.
                      </p>
                    </div>
                    <Button onClick={handleDownloadTemplate} disabled={generating} variant="outline" className="w-full">
                      {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                      Télécharger le template .xlsx
                    </Button>
                  </CardContent>
                </Card>

                <div
                  {...getRootProps()}
                  className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${isDragActive ? "border-primary bg-primary/5 scale-[1.01]" : "border-border bg-muted/10 hover:border-primary/50 hover:bg-muted/20"}`}
                >
                  <input {...getInputProps()} />
                  <Upload className={`h-10 w-10 mx-auto mb-3 ${isDragActive ? "text-primary" : "text-muted-foreground/30"}`} />
                  {isDragActive ? (
                    <p className="text-sm text-primary font-medium">Déposez ici…</p>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground font-medium">
                        Glissez votre fichier ici ou <span className="text-primary underline cursor-pointer">parcourez</span>
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Formats acceptés : .xlsx, .csv</p>
                    </>
                  )}
                </div>

                {fileError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Erreur de lecture</AlertTitle>
                    <AlertDescription className="text-xs">{fileError}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* ─── STEP 2: MAPPING ─── */}
            {step === 2 && hasFile && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{mappedCount}/{SYSTEM_FIELDS.length} champs mappés</p>
                  {!requiredMapped && (
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50">
                      Champs obligatoires manquants
                    </Badge>
                  )}
                </div>

                {GROUPS.map((group) => (
                  <Card key={group.key}>
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <span>{group.icon}</span>
                        {group.key}
                        <span className="text-xs text-muted-foreground font-normal ml-1">— {group.description}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {SYSTEM_FIELDS.filter((f) => f.group === group.key).map((field) => (
                          <div key={field.key} className="flex items-center gap-2">
                            <div className="flex items-center gap-1 w-32 shrink-0">
                              <span className="text-xs text-foreground">{field.label}</span>
                              {field.required && <span className="text-destructive text-xs">*</span>}
                            </div>
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            <Select value={mapping[field.key] || "__none__"} onValueChange={(v) => updateMapping(field.key, v)}>
                              <SelectTrigger className="h-8 text-xs flex-1">
                                <SelectValue placeholder="— Non mappé —" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— Non mappé —</SelectItem>
                                {fileColumns.map((col) => <SelectItem key={col} value={col}>{col}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {mapping[field.key] && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Raw preview */}
                {previewRows.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">Aperçu brut (3 premières lignes)</p>
                    </div>
                    <ScrollArea className="rounded-lg border border-border">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {fileColumns.slice(0, 8).map((col) => <TableHead key={col} className="text-[10px] whitespace-nowrap px-2 py-1.5">{col}</TableHead>)}
                              {fileColumns.length > 8 && <TableHead className="text-[10px] px-2 py-1.5">…</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewRows.map((row, i) => (
                              <TableRow key={i}>
                                {fileColumns.slice(0, 8).map((col) => <TableCell key={col} className="text-[11px] px-2 py-1 whitespace-nowrap max-w-[120px] truncate">{String(row[col] ?? "")}</TableCell>)}
                                {fileColumns.length > 8 && <TableCell className="text-[11px] px-2 py-1 text-muted-foreground">…</TableCell>}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Nav buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => { setStep(1); }}>
                    <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Retour
                  </Button>
                  <div className="flex-1" />
                  <Button size="sm" onClick={handleAnalyze} disabled={!requiredMapped || analyzing}>
                    {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                    Analyser les données
                  </Button>
                </div>
              </div>
            )}

            {/* ─── STEP 3: VALIDATION ─── */}
            {step === 3 && validatedRows && stats && (
              <div className="space-y-4">
                {/* Summary badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs">Total : {stats.total}</Badge>
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />Prêts : {stats.valid}
                  </Badge>
                  {stats.errors > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />Erreurs : {stats.errors}
                    </Badge>
                  )}
                </div>

                {/* Validated table */}
                <ScrollArea className="rounded-lg border border-border max-h-[300px]">
                  <TooltipProvider delayDuration={200}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px] px-2 py-1.5 w-8">#</TableHead>
                          <TableHead className="text-[10px] px-2 py-1.5">Élève</TableHead>
                          <TableHead className="text-[10px] px-2 py-1.5">Genre</TableHead>
                          <TableHead className="text-[10px] px-2 py-1.5">Âge</TableHead>
                          <TableHead className="text-[10px] px-2 py-1.5">Niveau</TableHead>
                          <TableHead className="text-[10px] px-2 py-1.5">Parent</TableHead>
                          <TableHead className="text-[10px] px-2 py-1.5">Tél.</TableHead>
                          <TableHead className="text-[10px] px-2 py-1.5 w-10 text-center">Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validatedRows.map((row) => (
                          <TableRow key={row.rowIndex} className={row.status === "error" ? "bg-destructive/5" : ""}>
                            <TableCell className="text-[11px] px-2 py-1 text-muted-foreground">{row.rowIndex}</TableCell>
                            <TableCell className="text-[11px] px-2 py-1 font-medium">{row.student.prenom} {row.student.nom}</TableCell>
                            <TableCell className="text-[11px] px-2 py-1">{row.student.genre || "—"}</TableCell>
                            <TableCell className="text-[11px] px-2 py-1">{row.student.age ?? "—"}</TableCell>
                            <TableCell className="text-[11px] px-2 py-1">{row.pedagogy.level_name || "—"}</TableCell>
                            <TableCell className="text-[11px] px-2 py-1">{row.parent.prenom} {row.parent.nom}</TableCell>
                            <TableCell className="text-[11px] px-2 py-1 font-mono">{row.parent.phone || "—"}</TableCell>
                            <TableCell className="text-center px-2 py-1">
                              {row.status === "valid" ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-primary mx-auto" />
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="h-3.5 w-3.5 text-destructive mx-auto cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs">
                                    <ul className="text-xs space-y-0.5">{row.errors.map((err, i) => <li key={i}>• {err}</li>)}</ul>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TooltipProvider>
                </ScrollArea>

                {/* Skip errors toggle */}
                {stats.errors > 0 && stats.valid > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <Switch checked={skipErrors} onCheckedChange={setSkipErrors} id="skip-errors" />
                    <label htmlFor="skip-errors" className="text-xs text-foreground cursor-pointer">
                      Ignorer les {stats.errors} erreur{stats.errors > 1 ? "s" : ""} et importer les {stats.valid} valide{stats.valid > 1 ? "s" : ""}
                    </label>
                  </div>
                )}

                {/* Nav buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => { setValidatedRows(null); setStep(2); }}>
                    <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Modifier le mapping
                  </Button>
                  <div className="flex-1" />
                  <Button
                    size="sm"
                    disabled={!canImport && !skipErrors}
                    onClick={handleStartImport}
                  >
                    <Rocket className="h-3.5 w-3.5 mr-1.5" />
                    Lancer l'importation ({importableCount} élève{importableCount > 1 ? "s" : ""})
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
