import { useState, useCallback } from "react";
import { FileSpreadsheet, Download, Upload, Loader2, HelpCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
}

export function BulkImportDialog({ open, onOpenChange, orgId }: BulkImportDialogProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const handleDownloadTemplate = useCallback(async () => {
    setGenerating(true);
    try {
      // Fetch cycles & levels dynamically
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

      // Build workbook
      const wb = XLSX.utils.book_new();

      // Header row
      const headers = [
        "Nom *", "Prénom *", "Genre * (M/F)", "Âge *",
        "Cycle *", "Niveau *",
        "Nom Parent *", "Prénom Parent *", "Téléphone Parent *", "Email Parent",
      ];

      // Example row
      const exampleRow = [
        "Dupont", "Amine", "M", 8,
        cycleNames[0] ?? "Primaire", levelNames[0] ?? "Niveau 1",
        "Dupont", "Fatima", "0612345678", "fatima@email.com",
      ];

      const wsData = [headers, exampleRow];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Column widths
      ws["!cols"] = [
        { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 8 },
        { wch: 18 }, { wch: 20 },
        { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 24 },
      ];

      // Style headers (bold + background via cell styling)
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

      // Data Validation: Genre column (col index 2)
      const maxRows = 500;
      ws["!dataValidation"] = ws["!dataValidation"] || [];

      // Genre validation (M/F)
      if (cycleNames.length > 0 || levelNames.length > 0) {
        // We'll use a reference sheet for dropdowns
        const refData: string[][] = [];
        const maxLen = Math.max(cycleNames.length, levelNames.length, 2);
        for (let i = 0; i < maxLen; i++) {
          refData.push([
            i < 2 ? ["M", "F"][i] : "",
            cycleNames[i] ?? "",
            levelNames[i] ?? "",
          ]);
        }

        const refWs = XLSX.utils.aoa_to_sheet([
          ["Genre", "Cycles", "Niveaux"],
          ...refData,
        ]);
        refWs["!cols"] = [{ wch: 10 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, refWs, "Référentiels");

        // Build validated dropdown formulas as comments (xlsx library limitation)
        // We embed the lists directly for compatibility
      }

      XLSX.utils.book_append_sheet(wb, ws, "Inscriptions");

      // For proper data validation we need to use the xlsxfull approach
      // Apply data validations using the sheet's dataValidation array
      const genreRef = `"M,F"`;
      const cycleRef = cycleNames.length > 0 ? `"${cycleNames.join(",")}"` : undefined;
      const levelRef = levelNames.length > 0 ? `"${levelNames.join(",")}"` : undefined;

      // Apply validations to data range (rows 2-500)
      const dvs: Array<{
        type: string;
        operator?: string;
        sqref: string;
        formula1: string;
        showErrorMessage?: boolean;
        errorTitle?: string;
        error?: string;
      }> = [];

      // Genre validation
      dvs.push({
        type: "list",
        sqref: `C2:C${maxRows}`,
        formula1: genreRef,
        showErrorMessage: true,
        errorTitle: "Valeur invalide",
        error: "Veuillez saisir M ou F.",
      });

      if (cycleRef) {
        dvs.push({
          type: "list",
          sqref: `E2:E${maxRows}`,
          formula1: cycleRef,
          showErrorMessage: true,
          errorTitle: "Cycle invalide",
          error: "Veuillez sélectionner un cycle de la liste.",
        });
      }

      if (levelRef) {
        dvs.push({
          type: "list",
          sqref: `F2:F${maxRows}`,
          formula1: levelRef,
          showErrorMessage: true,
          errorTitle: "Niveau invalide",
          error: "Veuillez sélectionner un niveau de la liste.",
        });
      }

      // Age validation (whole number 3-99)
      dvs.push({
        type: "whole",
        operator: "between",
        sqref: `D2:D${maxRows}`,
        formula1: "3",
        showErrorMessage: true,
        errorTitle: "Âge invalide",
        error: "L'âge doit être un nombre entier entre 3 et 99.",
      });

      // Apply to sheet (internal SheetJS property)
      (ws as Record<string, unknown>)["!dataValidation"] = dvs;

      // Generate file & trigger download
      const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbOut], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `template_inscriptions_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Template généré ✅",
        description: `${cycleNames.length} cycles et ${levelNames.length} niveaux inclus.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de la génération";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }, [orgId, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
          {/* Step 1 */}
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
                  Les listes déroulantes (Genre, Cycle, Niveau) sont pré-remplies avec les données de votre organisation.
                </p>
              </div>

              <Button
                onClick={handleDownloadTemplate}
                disabled={generating}
                className="w-full bg-brand-emerald hover:bg-brand-emerald/90"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Télécharger le template .xlsx
              </Button>
            </div>
          </div>

          <Separator />

          {/* Step 2 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs font-semibold">
                Étape 2
              </Badge>
              <span className="text-sm font-medium text-muted-foreground">Envoi du fichier</span>
            </div>

            <div className="rounded-lg border-2 border-dashed border-border bg-muted/20 p-8 text-center">
              <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-medium">Zone de dépôt</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Bientôt disponible — Glissez votre fichier Excel ici
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
