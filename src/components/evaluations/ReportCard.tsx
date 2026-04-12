import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import masjidLabLogo from "@/assets/masjidlab-logo.png";

interface SubjectScore {
  subject_name: string;
  score: number;
  max_score: number;
  normalized: number;
}

export interface ReportCardProps {
  student: { id: string; nom: string; prenom: string };
  className: string;
  evaluationTitle: string;
  evaluationDate: string;
  evaluationId: string;
  subjectScores: SubjectScore[];
  overallAverage: number | null;
  onBack: () => void;
}

function getAppreciation(avg: number | null): { text: string; color: string } {
  if (avg === null) return { text: "Non évalué", color: "text-muted-foreground" };
  if (avg >= 16) return { text: "Excellent trimestre. Continuez ainsi, qu'Allah vous bénisse dans votre apprentissage.", color: "text-emerald-600" };
  if (avg >= 14) return { text: "Très bon travail. Les efforts sont remarquables, poursuivez sur cette voie.", color: "text-emerald-600" };
  if (avg >= 12) return { text: "Bon travail dans l'ensemble. Quelques axes d'amélioration à considérer.", color: "text-primary" };
  if (avg >= 10) return { text: "Résultats satisfaisants. Un effort supplémentaire permettra de progresser davantage.", color: "text-amber-600" };
  return { text: "Des efforts importants sont attendus. Un accompagnement renforcé est recommandé.", color: "text-destructive" };
}

export function ReportCard({
  student,
  className: clsName,
  evaluationTitle,
  evaluationDate,
  evaluationId,
  subjectScores,
  overallAverage,
  onBack,
}: ReportCardProps) {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();
  const appreciation = getAppreciation(overallAverage);

  // Fetch existing teacher comment
  const { data: existingResult } = useQuery({
    queryKey: ["eval_result_comment", evaluationId, student.id],
    enabled: !!evaluationId && !!student.id && !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("madrasa_evaluation_results")
        .select("id, teacher_comment")
        .eq("evaluation_id", evaluationId)
        .eq("student_id", student.id)
        .eq("org_id", orgId!)
        .maybeSingle();
      return data;
    },
  });

  const [comment, setComment] = useState("");
  const [initialized, setInitialized] = useState(false);
  const autoText = appreciation.text;
  const initialValueRef = useRef("");

  // Initialize: use saved comment if exists, otherwise use auto-generated text
  useEffect(() => {
    if (initialized) return;
    if (existingResult === undefined) return; // still loading
    const saved = existingResult?.teacher_comment;
    const value = saved && saved.trim().length > 0 ? saved : autoText;
    setComment(value);
    initialValueRef.current = value;
    setInitialized(true);
  }, [existingResult, autoText, initialized]);

  const saveMutation = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase
        .from("madrasa_evaluation_results")
        .upsert(
          {
            evaluation_id: evaluationId,
            student_id: student.id,
            org_id: orgId!,
            teacher_comment: text || null,
          },
          { onConflict: "evaluation_id,student_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Appréciation sauvegardée");
      initialValueRef.current = comment.trim();
      queryClient.invalidateQueries({ queryKey: ["eval_result_comment", evaluationId, student.id] });
    },
    onError: () => {
      toast.error("Erreur lors de la sauvegarde");
    },
  });

  const handleBlur = () => {
    const trimmed = comment.trim();
    if (trimmed !== initialValueRef.current) {
      saveMutation.mutate(trimmed);
    }
  };

  const radarData = useMemo(
    () =>
      subjectScores.map((s) => ({
        subject: s.subject_name.length > 12 ? s.subject_name.slice(0, 12) + "…" : s.subject_name,
        note: s.normalized,
        fullMark: 20,
      })),
    [subjectScores]
  );

  const handlePrint = () => window.print();

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .report-card-printable, .report-card-printable * { visibility: visible; }
          .report-card-printable { position: absolute; left: 0; top: 0; width: 210mm; padding: 15mm; }
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 10mm; }
        }
      `}</style>

      <main className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
          <div className="flex items-center gap-3 no-print">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-bold">Bulletin de notes</h1>
              <p className="text-xs text-muted-foreground">
                {student.prenom} {student.nom}
              </p>
            </div>
            <Button onClick={handlePrint} size="sm" variant="outline">
              <Printer className="h-4 w-4 mr-1" /> Imprimer
            </Button>
          </div>

          <Card className="report-card-printable border shadow-sm">
            <CardContent className="p-6 md:p-8 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={masjidLabLogo} alt="MasjidLab" className="h-10 w-10 object-contain" />
                  <div>
                    <p className="text-sm font-bold tracking-tight">MASJIDLAB</p>
                    <p className="text-[10px] text-muted-foreground italic">
                      Gérez l'organisation, élevez les cœurs.
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">{evaluationTitle}</p>
                  <p>{evaluationDate}</p>
                </div>
              </div>

              <Separator />

              {/* Student info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Élève : </span>
                  <span className="font-semibold">
                    {student.prenom} {student.nom}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Classe : </span>
                  <span className="font-semibold">{clsName}</span>
                </div>
              </div>

              <Separator />

              {/* Results table */}
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs font-semibold">Matière</TableHead>
                    <TableHead className="text-xs font-semibold text-center w-24">Note /20</TableHead>
                    <TableHead className="text-xs font-semibold text-center w-24">Appréciation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjectScores.map((s) => (
                    <TableRow key={s.subject_name}>
                      <TableCell className="text-sm">{s.subject_name}</TableCell>
                      <TableCell className="text-center font-semibold text-sm">
                        <span className={cn(s.normalized < 10 && "text-destructive")}>
                          {s.normalized.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {s.normalized >= 16
                          ? "Excellent"
                          : s.normalized >= 14
                          ? "Très bien"
                          : s.normalized >= 12
                          ? "Bien"
                          : s.normalized >= 10
                          ? "Passable"
                          : "Insuffisant"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell className="text-sm">Moyenne Générale</TableCell>
                    <TableCell className="text-center text-sm">
                      <span className={cn(overallAverage !== null && overallAverage < 10 && "text-destructive")}>
                        {overallAverage !== null ? overallAverage.toFixed(2) : "—"}/20
                      </span>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>

              {/* Radar chart */}
              {subjectScores.length >= 3 && (
                <div className="flex justify-center">
                  <div className="w-72 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis
                          dataKey="subject"
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        />
                        <PolarRadiusAxis
                          angle={30}
                          domain={[0, 20]}
                          tick={{ fontSize: 9 }}
                          tickCount={5}
                        />
                        <Radar
                          name="Note"
                          dataKey="note"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary))"
                          fillOpacity={0.2}
                          strokeWidth={2}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <Separator />

              {/* Global appreciation — editable */}
              <div className="rounded-lg border p-4 bg-muted/10 group/appr relative">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Appréciation Générale
                  </p>
                  <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover/appr:text-muted-foreground/60 transition-opacity no-print" />
                </div>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onBlur={handleBlur}
                  rows={3}
                  className={cn(
                    "border-none shadow-none resize-none bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0",
                    appreciation.color
                  )}
                />
              </div>

              {/* Footer */}
              <div className="flex justify-between text-[10px] text-muted-foreground pt-2">
                <span>Document généré par MasjidLab</span>
                <span>Signature de l'enseignant : ____________________</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
