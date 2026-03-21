import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, CheckCircle2, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  grades: any[];
  progressEntries: any[];
  studentPrenom: string;
  parentInfo?: { display_name: string; email?: string | null; phone?: string | null } | null;
}

const StudentOverviewTab = ({ grades, progressEntries, studentPrenom, parentInfo }: Props) => (
  <div className="space-y-4">
    {/* Parent info */}
    {parentInfo && (
      <Card className="border-brand-navy/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-brand-navy" /> Responsable légal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium">{parentInfo.display_name}</p>
          <div className="flex gap-4 mt-1 flex-wrap">
            {parentInfo.email && <p className="text-xs text-muted-foreground">{parentInfo.email}</p>}
            {parentInfo.phone && <p className="text-xs text-muted-foreground">{parentInfo.phone}</p>}
          </div>
        </CardContent>
      </Card>
    )}

    {/* Latest grades */}
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-brand-cyan" /> Dernières évaluations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {grades.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Aucune évaluation enregistrée. Les résultats apparaîtront ici après les premiers examens.
          </p>
        ) : (
          <div className="space-y-2">
            {grades.slice(0, 5).map(g => {
              const eval_ = g.madrasa_evaluations as any;
              const max = eval_?.max_points || 20;
              return (
                <div key={g.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{eval_?.title || "Examen"}</p>
                    <p className="text-xs text-muted-foreground">
                      {eval_?.madrasa_subjects?.name || "—"} · {eval_?.date ? format(parseISO(eval_.date), "dd MMM yyyy", { locale: fr }) : "—"}
                    </p>
                  </div>
                  <Badge variant="outline" className="font-mono tabular-nums">
                    {g.score ?? "—"}/{max}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>

    {/* Next to-do */}
    {progressEntries.length > 0 && (() => {
      const latest = progressEntries[0];
      const data = latest.data_json as Record<string, any>;
      const todo = data?.todo_next || data?.todo_prochaine_seance || data?.todo || null;
      const subjectName = (latest.madrasa_session_configs as any)?.madrasa_subjects?.name || "—";
      return (
        <Card className="border-brand-cyan/20 bg-brand-cyan/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-brand-cyan">
              <CheckCircle2 className="h-4 w-4" /> À faire — Prochaine séance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-1">
              {subjectName} · {format(parseISO(latest.lesson_date), "dd MMM yyyy", { locale: fr })}
            </p>
            <p className="text-sm font-medium">
              {todo || "Aucun devoir défini pour la prochaine séance."}
            </p>
          </CardContent>
        </Card>
      );
    })()}
  </div>
);

export default StudentOverviewTab;
