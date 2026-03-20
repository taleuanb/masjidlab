import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

// Deterministic color per subject name for visual differentiation
const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  default: { bg: "bg-muted/50", text: "text-foreground", border: "border-border" },
};

function getSubjectStyle(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("coran") || lower.includes("quran") || lower.includes("tajwid") || lower.includes("tajweed"))
    return { bg: "bg-brand-emerald/8", text: "text-brand-emerald", border: "border-brand-emerald/20", badge: "bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30" };
  if (lower.includes("arabe") || lower.includes("arabic") || lower.includes("langue"))
    return { bg: "bg-brand-cyan/8", text: "text-brand-cyan", border: "border-brand-cyan/20", badge: "bg-brand-cyan/15 text-brand-cyan border-brand-cyan/30" };
  if (lower.includes("fiqh") || lower.includes("jurisprudence"))
    return { bg: "bg-amber-500/8", text: "text-amber-700", border: "border-amber-500/20", badge: "bg-amber-100 text-amber-700 border-amber-300" };
  return { bg: "bg-muted/30", text: "text-brand-navy", border: "border-border", badge: "" };
}

interface Props {
  progressEntries: any[];
  studentPrenom: string;
}

const StudentTimelineTab = ({ progressEntries, studentPrenom }: Props) => {
  if (progressEntries.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          Le voyage éducatif de {studentPrenom} commence. Ses suivis de séance apparaîtront ici.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {progressEntries.map(entry => {
        const data = entry.data_json as Record<string, any>;
        const subjectName = (entry.madrasa_session_configs as any)?.madrasa_subjects?.name || "Matière";
        const style = getSubjectStyle(subjectName);
        const todo = data?.todo_prochaine_seance || data?.todo;
        const otherFields = Object.entries(data).filter(
          ([k]) => !["todo_prochaine_seance", "todo"].includes(k)
        );

        return (
          <Card key={entry.id} className={`overflow-hidden ${style.border}`}>
            <CardHeader className={`pb-2 ${style.bg}`}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className={`h-3.5 w-3.5 ${style.text}`} />
                  {format(parseISO(entry.lesson_date), "EEEE dd MMMM yyyy", { locale: fr })}
                </CardTitle>
                <Badge className={style.badge || undefined} variant={style.badge ? undefined : "secondary"}>
                  {subjectName}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-3 space-y-2">
              {otherFields.map(([key, value]) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground capitalize min-w-[120px]">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="text-sm font-medium">{String(value)}</span>
                </div>
              ))}
              {todo && (
                <div className="mt-2 p-2.5 rounded-md bg-brand-cyan/8 border border-brand-cyan/20">
                  <p className="text-xs font-semibold text-brand-cyan mb-0.5 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> À faire
                  </p>
                  <p className="text-sm">{String(todo)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default StudentTimelineTab;
