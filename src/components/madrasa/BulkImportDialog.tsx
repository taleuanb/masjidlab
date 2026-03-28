import { useState, useCallback, useMemo, useEffect } from "react";
import {
  FileSpreadsheet, Download, Upload, Loader2, HelpCircle,
  AlertTriangle, RefreshCw, CheckCircle2, Table2, X, Rocket,
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

// ── Types ──
interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
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

// ── Required fields definition ──
interface SystemField {
  key: string;
  label: string;
  group: string;
  required: boolean;
  aliases: string[];
}

const SYSTEM_FIELDS: SystemField[] = [
  { key: "student_nom", label: "Nom", group: "Élève", required: true, aliases: ["nom", "last name", "family name", "nom eleve", "nom élève"] },
  { key: "student_prenom", label: "Prénom", group: "Élève", required: true, aliases: ["prenom", "prénom", "first name", "prenom eleve", "prénom élève"] },
  { key: "student_genre", label: "Genre (M/F)", group: "Élève", required: true, aliases: ["genre", "sexe", "sex", "gender", "m/f"] },
  { key: "student_age", label: "Âge", group: "Élève", required: true, aliases: ["age", "âge"] },
  { key: "cycle_name", label: "Nom du Cycle", group: "Pédagogie", required: true, aliases: ["cycle", "filiere", "filière", "parcours"] },
  { key: "level_name", label: "Nom du Niveau", group: "Pédagogie", required: true, aliases: ["niveau", "level", "classe", "class"] },
  { key: "parent_nom", label: "Nom", group: "Parent", required: true, aliases: ["nom parent", "nom du parent", "parent nom", "nom responsable"] },
  { key: "parent_prenom", label: "Prénom", group: "Parent", required: true, aliases: ["prenom parent", "prénom parent", "parent prenom", "prénom responsable"] },
  { key: "parent_phone", label: "Téléphone", group: "Parent", required: true, aliases: ["telephone", "téléphone", "tel", "phone", "gsm", "mobile", "portable", "num tel", "numéro"] },
  { key: "parent_email", label: "Email", group: "Parent", required: false, aliases: ["email", "e-mail", "mail", "courriel", "email parent"] },
];

const GROUPS = ["Élève", "Pédagogie", "Parent"];

// ── Fuzzy matching ──
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

// ── Validation engine ──
function validateRow(
  row: ParsedRow,
  rowIndex: number,
  cycleNames: Set<string>,
  levelNames: Set<string>,
  cycleLevelMap: Map<string, Set<string>>,
): ValidatedRow {
  const errors: string[] = [];

  // Required text fields
  if (!row.student.nom) errors.push("Nom élève manquant");
  if (!row.student.prenom) errors.push("Prénom élève manquant");
  if (!row.parent.nom) errors.push("Nom parent manquant");
  if (!row.parent.prenom) errors.push("Prénom parent manquant");
  if (!row.parent.phone) errors.push("Téléphone parent manquant");
  if (!row.pedagogy.level_name) errors.push("Nom du niveau manquant");

  // Genre
  if (row.student.genre !== "M" && row.student.genre !== "F") {
    errors.push(`Genre invalide "${row.student.genre}" — doit être M ou F`);
  }

  // Age
  if (row.student.age === null || isNaN(row.student.age)) {
    errors.push("Âge manquant ou invalide");
  } else if (!Number.isInteger(row.student.age) || row.student.age < 3 || row.student.age > 99) {
    errors.push(`Âge "${row.student.age}" hors limites (3-99)`);
  }

  // Cycle / Level validation against reference data
  if (row.pedagogy.cycle_name && cycleNames.size > 0 && !cycleNames.has(row.pedagogy.cycle_name)) {
    errors.push(`Cycle "${row.pedagogy.cycle_name}" inconnu`);
  }
  if (row.pedagogy.level_name && levelNames.size > 0 && !levelNames.has(row.pedagogy.level_name)) {
    errors.push(`Niveau "${row.pedagogy.level_name}" inconnu`);
  }

  // Cross-check: level belongs to cycle
  if (
    row.pedagogy.cycle_name &&
    row.pedagogy.level_name &&
    cycleLevelMap.has(row.pedagogy.cycle_name) &&
    !cycleLevelMap.get(row.pedagogy.cycle_name)!.has(row.pedagogy.level_name)
  ) {
    errors.push(`Le niveau "${row.pedagogy.level_name}" n'appartient pas au cycle "${row.pedagogy.cycle_name}"`);
  }

  // Phone format (min 10 digits)
  if (row.parent.phone && row.parent.phone.replace(/\D/g, "").length < 10) {
    errors.push("Téléphone parent : minimum 10 chiffres");
  }

  return { ...row, rowIndex, status: errors.length > 0 ? "error" : "valid", errors };
}

// ── Component ──
export function BulkImportDialog({ open, onOpenChange, orgId }: BulkImportDialogProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  // Reference data (loaded once)
  const [refCycles, setRefCycles] = useState<CycleRef[]>([]);
  const [refLevels, setRefLevels] = useState<LevelRef[]>([]);
  const [refLoaded, setRefLoaded] = useState(false);

  // File reading state
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [skipErrors, setSkipErrors] = useState(false);

  // ── Load reference data on open ──
  useEffect(() => {
    if (!open || refLoaded) return;
    (async () => {
      const [cRes, lRes] = await Promise.all([
        supabase.from("madrasa_cycles").select("id, nom").eq("org_id", orgId),
        supabase.from("madrasa_levels").select("id, label, cycle_id").eq("org_id", orgId),
      ]);
      setRefCycles(cRes.data ?? []);
      setRefLevels(lRes.data ?? []);
      setRefLoaded(true);
    })();
  }, [open, orgId, refLoaded]);

  // Precomputed lookup sets
  const cycleNames = useMemo(() => new Set(refCycles.map((c) => c.nom)), [refCycles]);
  const levelNames = useMemo(() => new Set(refLevels.map((l) => l.label)), [refLevels]);
  const cycleLevelMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const level of refLevels) {
      const cycle = refCycles.find((c) => c.id === level.cycle_id);
      if (cycle) {
        if (!map.has(cycle.nom)) map.set(cycle.nom, new Set());
        map.get(cycle.nom)!.add(level.label);
      }
    }
    return map;
  }, [refCycles, refLevels]);

  // Stats
  const stats = useMemo(() => {
    if (!validatedRows) return null;
    const valid = validatedRows.filter((r) => r.status === "valid").length;
    return { total: validatedRows.length, valid, errors: validatedRows.length - valid };
  }, [validatedRows]);

  // ── Reset state ──
  const resetFileState = useCallback(() => {
    setFileColumns([]);
    setFileRows([]);
    setFileName(null);
    setFileError(null);
    setMapping({});
    setValidatedRows(null);
    setSkipErrors(false);
  }, []);

  // ── File reading ──
  const handleFileDrop = useCallback((acceptedFiles: File[]) => {
    setFileError(null);
    setValidatedRows(null);
    const file = acceptedFiles[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onerror = () => {
      setFileError("Impossible de lire le fichier. Vérifiez qu'il n'est pas corrompu.");
    };

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) { setFileError("Le fichier ne contient aucune feuille de calcul."); return; }
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        if (!json.length) { setFileError("Le fichier est vide ou ne contient aucune ligne de données."); return; }
        const cols = Object.keys(json[0]);
        if (cols.length < 2) { setFileError("Le fichier ne contient pas assez de colonnes."); return; }

        setFileColumns(cols);
        setFileRows(json);
        setMapping(autoMap(cols));
      } catch {
        setFileError("Erreur lors de la lecture du fichier. Assurez-vous qu'il s'agit d'un fichier Excel (.xlsx) ou CSV valide.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    multiple: false,
  });

  // ── Mapping helpers ──
  const updateMapping = useCallback((fieldKey: string, colName: string) => {
    setMapping((prev) => ({ ...prev, [fieldKey]: colName === "__none__" ? "" : colName }));
    setValidatedRows(null);
  }, []);

  const requiredMapped = useMemo(() => {
    return SYSTEM_FIELDS.filter((f) => f.required).every((f) => !!mapping[f.key]);
  }, [mapping]);

  // ── Preview data ──
  const previewRows = useMemo(() => fileRows.slice(0, 3), [fileRows]);

  // ── Analyze + Validate ──
  const handleAnalyze = useCallback(() => {
    setAnalyzing(true);
    try {
      const rows: ValidatedRow[] = fileRows.map((row, i) => {
        const parsed: ParsedRow = {
          student: {
            nom: String(row[mapping.student_nom] ?? "").trim(),
            prenom: String(row[mapping.student_prenom] ?? "").trim(),
            age: mapping.student_age ? parseInt(String(row[mapping.student_age]), 10) || null : null,
            genre: String(row[mapping.student_genre] ?? "").trim().toUpperCase(),
          },
          parent: {
            nom: String(row[mapping.parent_nom] ?? "").trim(),
            prenom: String(row[mapping.parent_prenom] ?? "").trim(),
            phone: String(row[mapping.parent_phone] ?? "").replace(/[\s.\-()]/g, "").trim(),
            email: String(row[mapping.parent_email] ?? "").trim(),
          },
          pedagogy: {
            cycle_name: String(row[mapping.cycle_name] ?? "").trim(),
            level_name: String(row[mapping.level_name] ?? "").trim(),
          },
        };
        return validateRow(parsed, i + 1, cycleNames, levelNames, cycleLevelMap);
      });

      setValidatedRows(rows);

      const validCount = rows.filter((r) => r.status === "valid").length;
      const errorCount = rows.length - validCount;

      toast({
        title: errorCount > 0 ? "Analyse terminée ⚠️" : "Analyse terminée ✅",
        description: errorCount > 0
          ? `${validCount} ligne(s) valide(s), ${errorCount} erreur(s) détectée(s).`
          : `${validCount} ligne(s) prête(s) pour l'import.`,
        variant: errorCount > 0 ? "destructive" : "default",
      });
    } catch {
      toast({ title: "Erreur", description: "Erreur lors de l'analyse des données.", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }, [fileRows, mapping, cycleNames, levelNames, cycleLevelMap, toast]);

  // ── Template download ──
  const handleDownloadTemplate = useCallback(async () => {
    setGenerating(true);
    try {
      const cycles = refLoaded ? refCycles : (await supabase.from("madrasa_cycles").select("id, nom").eq("org_id", orgId)).data ?? [];
      const levels = refLoaded ? refLevels : (await supabase.from("madrasa_levels").select("id, label, cycle_id").eq("org_id", orgId)).data ?? [];
      const cNames = cycles.map((c) => c.nom);
      const lNames = levels.map((l) => l.label);

      const wb = XLSX.utils.book_new();
      const headers = [
        "Nom *", "Prénom *", "Genre * (M/F)", "Âge *",
        "Cycle *", "Niveau *",
        "Nom Parent *", "Prénom Parent *", "Téléphone Parent *", "Email Parent",
      ];
      const exampleRow = [
        "Dupont", "Amine", "M", 8,
        cNames[0] ?? "Primaire", lNames[0] ?? "Niveau 1",
        "Dupont", "Fatima", "0612345678", "fatima@email.com",
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
      ws["!cols"] = [
        { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 8 },
        { wch: 18 }, { wch: 20 },
        { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 24 },
      ];
      headers.forEach((_, i) => {
        const cell = XLSX.utils.encode_cell({ r: 0, c: i });
        if (ws[cell]) {
          ws[cell].s = { font: { bold: true }, fill: { fgColor: { rgb: "F3F4F6" } }, alignment: { horizontal: "center" } };
        }
      });

      if (cNames.length > 0 || lNames.length > 0) {
        const refData: string[][] = [];
        const maxLen = Math.max(cNames.length, lNames.length, 2);
        for (let i = 0; i < maxLen; i++) {
          refData.push([i < 2 ? ["M", "F"][i] : "", cNames[i] ?? "", lNames[i] ?? ""]);
        }
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `template_inscriptions_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Template généré ✅", description: `${cNames.length} cycles et ${lNames.length} niveaux inclus.` });
    } catch (err: unknown) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Erreur", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [orgId, toast, refLoaded, refCycles, refLevels]);

  // ── Computed ──
  const hasFile = fileColumns.length > 0;
  const importableCount = stats ? (skipErrors ? stats.valid : (stats.errors === 0 ? stats.valid : 0)) : 0;
  const canImport = importableCount > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetFileState(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-brand-emerald" />
            Importation massive d'élèves
          </DialogTitle>
          <DialogDescription>
            Importez plusieurs élèves en une seule opération à partir d'un fichier Excel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* ── Step 1: Template ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs font-semibold">Étape 1</Badge>
              <span className="text-sm font-medium text-foreground">Préparation</span>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Utilisez ce template pour garantir la compatibilité. Les colonnes marquées d'un <span className="text-destructive font-bold">*</span> sont obligatoires.
                </p>
              </div>
              <Button onClick={handleDownloadTemplate} disabled={generating} className="w-full bg-brand-emerald hover:bg-brand-emerald/90">
                {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Télécharger le template .xlsx
              </Button>
            </div>
          </div>

          <Separator />

          {/* ── Step 2: Upload & Map ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={hasFile ? "bg-primary/10 text-primary border-primary/30 text-xs font-semibold" : "bg-muted text-muted-foreground border-border text-xs font-semibold"}>
                Étape 2
              </Badge>
              <span className={`text-sm font-medium ${hasFile ? "text-foreground" : "text-muted-foreground"}`}>
                Envoi & Mapping
              </span>
            </div>

            {fileError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erreur de lecture</AlertTitle>
                <AlertDescription className="text-xs">{fileError}</AlertDescription>
              </Alert>
            )}

            {!hasFile ? (
              <div
                {...getRootProps()}
                className={`rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className={`h-8 w-8 mx-auto mb-3 ${isDragActive ? "text-primary" : "text-muted-foreground/40"}`} />
                {isDragActive ? (
                  <p className="text-sm text-primary font-medium">Déposez le fichier ici…</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground font-medium">
                      Glissez votre fichier Excel ici ou <span className="text-primary underline">parcourez</span>
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Formats acceptés : .xlsx, .csv</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* File info */}
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <FileSpreadsheet className="h-4 w-4 text-brand-emerald shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate flex-1">{fileName}</span>
                  <Badge variant="outline" className="text-[10px]">{fileRows.length} lignes</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetFileState}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Mapping columns (hide when validated) */}
                {!validatedRows && (
                  <>
                    <div className="space-y-3">
                      {GROUPS.map((group) => (
                        <div key={group} className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {SYSTEM_FIELDS.filter((f) => f.group === group).map((field) => (
                              <div key={field.key} className="flex items-center gap-2">
                                <span className="text-xs text-foreground w-28 shrink-0">
                                  {field.label}
                                  {field.required && <span className="text-destructive ml-0.5">*</span>}
                                </span>
                                <Select value={mapping[field.key] || "__none__"} onValueChange={(v) => updateMapping(field.key, v)}>
                                  <SelectTrigger className="h-8 text-xs flex-1">
                                    <SelectValue placeholder="— Non mappé —" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">— Non mappé —</SelectItem>
                                    {fileColumns.map((col) => (
                                      <SelectItem key={col} value={col}>{col}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {mapping[field.key] && <CheckCircle2 className="h-3.5 w-3.5 text-brand-emerald shrink-0" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

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
                                  {fileColumns.slice(0, 8).map((col) => (
                                    <TableHead key={col} className="text-[10px] whitespace-nowrap px-2 py-1.5">{col}</TableHead>
                                  ))}
                                  {fileColumns.length > 8 && <TableHead className="text-[10px] px-2 py-1.5">…</TableHead>}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {previewRows.map((row, i) => (
                                  <TableRow key={i}>
                                    {fileColumns.slice(0, 8).map((col) => (
                                      <TableCell key={col} className="text-[11px] px-2 py-1 whitespace-nowrap max-w-[120px] truncate">
                                        {String(row[col] ?? "")}
                                      </TableCell>
                                    ))}
                                    {fileColumns.length > 8 && <TableCell className="text-[11px] px-2 py-1 text-muted-foreground">…</TableCell>}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </>
                )}

                {/* ── Validated results ── */}
                {validatedRows && stats && (
                  <div className="space-y-3">
                    {/* Summary badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Total : {stats.total}
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-brand-emerald/10 text-brand-emerald border-brand-emerald/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Prêts : {stats.valid}
                      </Badge>
                      {stats.errors > 0 && (
                        <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Erreurs : {stats.errors}
                        </Badge>
                      )}
                    </div>

                    {/* Validated table */}
                    <ScrollArea className="rounded-lg border border-border max-h-[280px]">
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
                              <TableRow
                                key={row.rowIndex}
                                className={row.status === "error" ? "bg-destructive/5" : ""}
                              >
                                <TableCell className="text-[11px] px-2 py-1 text-muted-foreground">{row.rowIndex}</TableCell>
                                <TableCell className="text-[11px] px-2 py-1 font-medium">
                                  {row.student.prenom} {row.student.nom}
                                </TableCell>
                                <TableCell className="text-[11px] px-2 py-1">{row.student.genre || "—"}</TableCell>
                                <TableCell className="text-[11px] px-2 py-1">{row.student.age ?? "—"}</TableCell>
                                <TableCell className="text-[11px] px-2 py-1">{row.pedagogy.level_name || "—"}</TableCell>
                                <TableCell className="text-[11px] px-2 py-1">
                                  {row.parent.prenom} {row.parent.nom}
                                </TableCell>
                                <TableCell className="text-[11px] px-2 py-1 font-mono">{row.parent.phone || "—"}</TableCell>
                                <TableCell className="text-center px-2 py-1">
                                  {row.status === "valid" ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-brand-emerald mx-auto" />
                                  ) : (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <AlertTriangle className="h-3.5 w-3.5 text-destructive mx-auto cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="max-w-xs">
                                        <ul className="text-xs space-y-0.5">
                                          {row.errors.map((err, i) => (
                                            <li key={i}>• {err}</li>
                                          ))}
                                        </ul>
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
                          Ignorer les {stats.errors} ligne(s) en erreur et importer uniquement les {stats.valid} valide(s)
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => { resetFileState(); }}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    {validatedRows ? "Recommencer" : "Changer de fichier"}
                  </Button>

                  {validatedRows && (
                    <Button variant="outline" size="sm" onClick={() => setValidatedRows(null)}>
                      Modifier le mapping
                    </Button>
                  )}

                  <div className="flex-1" />

                  {!validatedRows ? (
                    <Button
                      size="sm"
                      onClick={handleAnalyze}
                      disabled={!requiredMapped || analyzing}
                      className="bg-brand-navy hover:bg-brand-navy/90"
                    >
                      {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                      Analyser les données
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!canImport}
                      className="bg-brand-emerald hover:bg-brand-emerald/90"
                    >
                      <Rocket className="h-3.5 w-3.5 mr-1.5" />
                      Lancer l'importation ({importableCount} élève{importableCount > 1 ? "s" : ""})
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
