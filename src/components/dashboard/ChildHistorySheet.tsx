import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, Calendar, MessageSquare, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface HistoryEntry {
  lessonDate: string;
  subjectName: string;
  dataJson: Record<string, any>;
}

function ReadOnlyStars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${
            i < value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"
          }`}
        />
      ))}
    </div>
  );
}

interface ChildHistorySheetProps {
  childId: string | null;
  childName: string;
  onClose: () => void;
}

export function ChildHistorySheet({ childId, childName, onClose }: ChildHistorySheetProps) {
  const { orgId } = useOrganization();

  const { data: history, isLoading } = useQuery({
    queryKey: ["child_history", orgId, childId],
    enabled: !!orgId && !!childId,
    queryFn: async (): Promise<HistoryEntry[]> => {
      const { data, error } = await supabase
        .from("madrasa_student_progress")
        .select("lesson_date, data_json, madrasa_session_configs(madrasa_subjects(name))")
        .eq("org_id", orgId!)
        .eq("student_id", childId!)
        .order("lesson_date", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((row) => {
        const cfg = row.madrasa_session_configs as any;
        return {
          lessonDate: row.lesson_date,
          subjectName: cfg?.madrasa_subjects?.name ?? "Matière",
          dataJson: (row.data_json as Record<string, any>) ?? {},
        };
      });
    },
  });

  return (
    <Sheet open={!!childId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-brand-navy">
            <History className="h-5 w-5" />
            Historique — {childName}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : !history || history.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground italic">
                Aucune séance enregistrée pour le moment.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 border-l-2 border-border space-y-6">
              {history.map((entry, idx) => {
                const starFields: { label: string; value: number }[] = [];
                const todoNext = entry.dataJson?.todo_next as string | undefined;

                for (const [key, val] of Object.entries(entry.dataJson)) {
                  if (key === "todo_next" || key === "position_actuelle" || key === "mastery_validated") continue;
                  const num = Number(val);
                  if (!isNaN(num) && num >= 0 && num <= 5) {
                    starFields.push({
                      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                      value: num,
                    });
                  }
                }

                return (
                  <div key={idx} className="relative">
                    {/* Timeline dot */}
                    <div className="absolute -left-[25px] top-1 h-3 w-3 rounded-full bg-brand-emerald border-2 border-background" />

                    {/* Date & subject */}
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-navy">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(entry.lessonDate), "d MMMM yyyy", { locale: fr })}
                      <span className="text-muted-foreground font-normal">— {entry.subjectName}</span>
                    </div>

                    {/* Star ratings */}
                    {starFields.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {starFields.map((sf) => (
                          <div key={sf.label} className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">{sf.label}</span>
                            <ReadOnlyStars value={sf.value} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Position */}
                    {entry.dataJson.position_actuelle != null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Position : <span className="font-semibold text-foreground">{entry.dataJson.position_actuelle}</span>
                      </p>
                    )}

                    {/* Todo next */}
                    {todoNext && (
                      <div className="mt-2 rounded-r-md bg-brand-cyan/10 border-l-4 border-brand-cyan p-3">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-3.5 w-3.5 text-brand-cyan mt-0.5 shrink-0" />
                          <p className="text-xs text-brand-navy">
                            <span className="font-semibold">Remarque / À préparer :</span> {todoNext}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
