import { useState, useCallback, useMemo } from "react";
import {
  FileSpreadsheet, Download, Upload, Loader2, HelpCircle,
  AlertTriangle, RefreshCw, CheckCircle2, Table2, X,
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

// ── Required fields definition ──
interface SystemField {
  key: string;
  label: string;
  group: string;
  required: boolean;
  aliases: string[]; // fuzzy match keywords
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
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
}

function fuzzyMatch(colName: string, aliases: string[]): boolean {
  const n = normalize(colName);
  return aliases.some((a) => {
    const na = normalize(a);
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

// ── Component ──
export function BulkImportDialog({ open, onOpenChange, orgId }: BulkImportDialogProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  // File reading state
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parsedData, setParsedData] = useState<ParsedRow[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // ── Reset state ──
  const resetFileState = useCallback(() => {
    setFileColumns([]);
    setFileRows([]);
    setFileName(null);
    setFileError(null);
    setMapping({});
    setParsedData(null);
  }, []);

  // ── File reading ──
  const handleFileDrop = useCallback((acceptedFiles: File[]) => {
    setFileError(null);
    setParsedData(null);
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
        if (!sheetName) {
          setFileError("Le fichier ne contient aucune feuille de calcul.");
          return;
        }
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

        if (!json.length) {
          setFileError("Le fichier est vide ou ne contient aucune ligne de données.");
          return;
        }

        const cols = Object.keys(json[0]);
        if (cols.length < 2) {
          setFileError("Le fichier ne contient pas assez de colonnes.");
          return;
        }

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
    setParsedData(null);
  }, []);

  const requiredMapped = useMemo(() => {
    return SYSTEM_FIELDS.filter((f) => f.required).every((f) => !!mapping[f.key]);
  }, [mapping]);

  // ── Preview data (first 3 rows) ──
  const previewRows = useMemo(() => fileRows.slice(0, 3), [fileRows]);

  // ── Analyze / Transform ──
  const handleAnalyze = useCallback(() => {
    setAnalyzing(true);
    try {
      const rows: ParsedRow[] = fileRows.map((row) => ({
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
      }));

      setParsedData(rows);
      toast({
        title: "Analyse terminée ✅",
        description: `${rows.length} ligne(s) prête(s) pour l'import.`,
      });
    } catch {
      toast({ title: "Erreur", description: "Erreur lors de l'analyse des données.", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }, [fileRows, mapping, toast]);

  // ── Template download (kept from original) ──
  const handleDownloadTemplate = useCallback(async () => {
    setGenerating(true);
    try {
      const [cyclesRes, levelsRes] = await Promise.all([
        supabase.from("madrasa_cycles").select("id, nom").eq("org_id", orgId),
        supabase.from("madrasa_levels").select("id, label, cycle_id").eq("org_id", orgId),
      ]);
      if (cyclesRes.error) throw cyclesRes.error;
      if (levelsRes.error) throw levelsRes.error;

      const cycles = cyclesRes.data ?? [];
      const levels = levelsRes.data ?? [];
      const cycleNames = cycles.map((c) => c.nom);
      const levelNames = levels.map((l) => l.label);

      const wb = XLSX.utils.book_new();
      const headers = [
        "Nom *", "Prénom *", "Genre * (M/F)", "Âge *",
        "Cycle *", "Niveau *",
        "Nom Parent *", "Prénom Parent *", "Téléphone Parent *", "Email Parent",
      ];
      const exampleRow = [
        "Dupont", "Amine", "M", 8,
        cycleNames[0] ?? "Primaire", levelNames[0] ?? "Niveau 1",
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
          ws[cell].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: "F3F4F6" } },
            alignment: { horizontal: "center" },
          };
        }
      });

      if (cycleNames.length > 0 || levelNames.length > 0) {
        const refData: string[][] = [];
        const maxLen = Math.max(cycleNames.length, levelNames.length, 2);
        for (let i = 0; i < maxLen; i++) {
          refData.push([
            i < 2 ? ["M", "F"][i] : "",
            cycleNames[i] ?? "",
            levelNames[i] ?? "",
          ]);
        }
        const refWs = XLSX.utils.aoa_to_sheet([["Genre", "Cycles", "Niveaux"], ...refData]);
        refWs["!cols"] = [{ wch: 10 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, refWs, "Référentiels");
      }

      XLSX.utils.book_append_sheet(wb, ws, "Inscriptions");

      const maxRows = 500;
      const genreRef = `"M,F"`;
      const cycleRef = cycleNames.length > 0 ? `"${cycleNames.join(",")}"` : undefined;
      const levelRef = levelNames.length > 0 ? `"${levelNames.join(",")}"` : undefined;
      const dvs: Array<Record<string, unknown>> = [];
      dvs.push({ type: "list", sqref: `C2:C${maxRows}`, formula1: genreRef, showErrorMessage: true, errorTitle: "Valeur invalide", error: "Veuillez saisir M ou F." });
      if (cycleRef) dvs.push({ type: "list", sqref: `E2:E${maxRows}`, formula1: cycleRef, showErrorMessage: true, errorTitle: "Cycle invalide", error: "Veuillez sélectionner un cycle de la liste." });
      if (levelRef) dvs.push({ type: "list", sqref: `F2:F${maxRows}`, formula1: levelRef, showErrorMessage: true, errorTitle: "Niveau invalide", error: "Veuillez sélectionner un niveau de la liste." });
      dvs.push({ type: "whole", operator: "between", sqref: `D2:D${maxRows}`, formula1: "3", showErrorMessage: true, errorTitle: "Âge invalide", error: "L'âge doit être un nombre entier entre 3 et 99." });
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

      toast({ title: "Template généré ✅", description: `${cycleNames.length} cycles et ${levelNames.length} niveaux inclus.` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de la génération";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [orgId, toast]);

  // ── Determine step 2 view ──
  const hasFile = fileColumns.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetFileState(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs font-semibold">
                Étape 1
              </Badge>
              <span className="text-sm font-medium text-foreground">Préparation</span>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Veuillez utiliser ce template pour garantir la compatibilité des données.
                  Les colonnes marquées d'un astérisque (<span className="text-destructive font-bold">*</span>) sont obligatoires.
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

            {/* Error alert */}
            {fileError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erreur de lecture</AlertTitle>
                <AlertDescription className="text-xs">{fileError}</AlertDescription>
              </Alert>
            )}

            {!hasFile ? (
              /* ── Dropzone ── */
              <div
                {...getRootProps()}
                className={`rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
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
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Formats acceptés : .xlsx, .csv
                    </p>
                  </>
                )}
              </div>
            ) : (
              /* ── Mapping UI ── */
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

                {/* Mapping columns */}
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
                            <Select
                              value={mapping[field.key] || "__none__"}
                              onValueChange={(v) => updateMapping(field.key, v)}
                            >
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
                            {mapping[field.key] && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-brand-emerald shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Preview table */}
                {previewRows.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">Aperçu des données (3 premières lignes)</p>
                    </div>
                    <ScrollArea className="rounded-lg border border-border">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {fileColumns.slice(0, 8).map((col) => (
                                <TableHead key={col} className="text-[10px] whitespace-nowrap px-2 py-1.5">{col}</TableHead>
                              ))}
                              {fileColumns.length > 8 && (
                                <TableHead className="text-[10px] px-2 py-1.5">…</TableHead>
                              )}
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
                                {fileColumns.length > 8 && (
                                  <TableCell className="text-[11px] px-2 py-1 text-muted-foreground">…</TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Parsed data summary */}
                {parsedData && (
                  <Alert className="border-brand-emerald/30 bg-brand-emerald/5">
                    <CheckCircle2 className="h-4 w-4 text-brand-emerald" />
                    <AlertTitle className="text-brand-emerald">Données prêtes</AlertTitle>
                    <AlertDescription className="text-xs">
                      {parsedData.length} élève(s) analysé(s) et prêt(s) pour l'importation.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={resetFileState}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Changer de fichier
                  </Button>
                  <div className="flex-1" />
                  <Button
                    size="sm"
                    onClick={handleAnalyze}
                    disabled={!requiredMapped || analyzing}
                    className="bg-brand-navy hover:bg-brand-navy/90"
                  >
                    {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                    Analyser les données
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
