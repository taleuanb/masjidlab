import React from "react";
import { BookOpen, Calendar, GraduationCap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export interface EnrollmentCardData {
  id: string;
  statut: string | null;
  created_at: string | null;
  annee_scolaire: string;
  student_name: string;
  class_name: string | null;
  level_label: string | null;
  completeness?: number;
}

export interface EnrollmentCardProps {
  enrollment: EnrollmentCardData;
  onClick?: () => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  en_attente: { label: "Sandbox", className: "bg-amber-100 text-amber-700 border-amber-300" },
  place: { label: "Placé", className: "bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30" },
  annule: { label: "Annulé", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

export function EnrollmentCard({ enrollment, onClick }: EnrollmentCardProps) {
  const status = statusConfig[enrollment.statut ?? "en_attente"] ?? statusConfig.en_attente;

  return (
    <Card
      className="group relative cursor-pointer overflow-hidden transition-all hover:shadow-md hover:border-primary/30 w-full"
      onClick={onClick}
    >
      {/* HEADER */}
      <div className="flex items-start justify-between gap-2 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-foreground truncate">{enrollment.student_name}</h3>
          <Badge className={`mt-1 text-[10px] ${status.className}`}>{status.label}</Badge>
        </div>
      </div>

      {/* BODY */}
      <div className="px-4 pb-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{enrollment.class_name || "Pas de classe"}</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <GraduationCap className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{enrollment.level_label || "Niveau non défini"}</span>
        </div>

        {enrollment.completeness !== undefined && enrollment.completeness < 100 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Dossier</span>
              <span className="font-medium">{enrollment.completeness}%</span>
            </div>
            <Progress
              value={enrollment.completeness}
              className="h-1.5"
              style={{ "--progress-color": "hsl(var(--brand-cyan, 185 73% 57%))" } as React.CSSProperties}
            />
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="flex items-center gap-1.5 border-t px-4 py-2.5 bg-muted/30">
        <Calendar className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">
          {enrollment.created_at ? new Date(enrollment.created_at).toLocaleDateString("fr-FR") : "—"}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">{enrollment.annee_scolaire}</span>
      </div>
    </Card>
  );
}
