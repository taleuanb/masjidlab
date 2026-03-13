import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useParentData } from "@/hooks/useParentData";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function SchoolAgendaWidget() {
  const { orgId } = useOrganization();
  const { data: students } = useParentData();
  const classIds = [...new Set((students ?? []).map((s) => s.class_id).filter(Boolean))] as string[];

  const { data: items, isLoading } = useQuery({
    queryKey: ["school-agenda", orgId, classIds],
    enabled: !!orgId && classIds.length > 0,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);

      // Upcoming evaluations for the children's classes
      const { data: evals } = await supabase
        .from("madrasa_evaluations")
        .select("id, title, date, class_id, madrasa_classes(nom), madrasa_subjects(name)")
        .eq("org_id", orgId!)
        .in("class_id", classIds)
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(5);

      return (evals ?? []).map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        className: (e.madrasa_classes as any)?.nom ?? "",
        subjectName: (e.madrasa_subjects as any)?.name ?? null,
        type: "evaluation" as const,
      }));
    },
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bento-card"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Agenda Scolaire</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Prochains examens & événements</p>
        </div>
        <CalendarDays className="h-4 w-4 text-accent" />
      </div>

      {!items || items.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <CalendarDays className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground italic">
            Aucun événement prévu pour le moment.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg border bg-card/50 p-3">
              <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-accent/10 text-accent">
                <span className="text-[10px] font-medium uppercase leading-none">
                  {format(new Date(item.date), "MMM", { locale: fr })}
                </span>
                <span className="text-base font-bold leading-none mt-0.5">
                  {format(new Date(item.date), "dd")}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-muted-foreground">{item.className}</span>
                  {item.subjectName && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {item.subjectName}
                    </Badge>
                  )}
                </div>
              </div>
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
