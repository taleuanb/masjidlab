import React from "react";
import { User, Calendar, CreditCard, GraduationCap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Tables } from "@/integrations/supabase/types";

export interface StudentCardProps {
  student: Tables<"madrasa_students">;
  levelLabel?: string | null;
  feeStatus?: "ok" | "pending" | "overdue" | null;
  onClick?: () => void;
}

const genderBadge = (gender: string | null) => {
  if (gender === "M") return <Badge className="bg-sky-100 text-sky-700 border-sky-300 text-[10px] px-1.5">M</Badge>;
  if (gender === "F") return <Badge className="bg-pink-100 text-pink-700 border-pink-300 text-[10px] px-1.5">F</Badge>;
  return null;
};

const feeBadge = (status: StudentCardProps["feeStatus"]) => {
  if (status === "ok") return <Badge className="bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30 text-[10px]">À jour</Badge>;
  if (status === "pending") return <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px]">En attente</Badge>;
  if (status === "overdue") return <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">Retard</Badge>;
  return <span className="text-[10px] text-muted-foreground">—</span>;
};

export function StudentCard({ student, levelLabel, feeStatus, onClick }: StudentCardProps) {
  const initials = `${student.prenom.charAt(0)}${student.nom.charAt(0)}`.toUpperCase();

  return (
    <Card
      className="group relative cursor-pointer overflow-hidden transition-all hover:shadow-md hover:border-primary/30"
      onClick={onClick}
    >
      {/* HEADER */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="text-xs bg-muted font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-foreground truncate">
            {student.prenom} {student.nom}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            {genderBadge(student.gender)}
            {student.statut === "actif" && (
              <Badge className="bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30 text-[10px]">Actif</Badge>
            )}
            {student.statut === "ancien" && (
              <Badge variant="secondary" className="text-[10px]">Ancien</Badge>
            )}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="px-4 pb-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <User className="h-3.5 w-3.5 shrink-0" />
          <span>{student.age ? `${student.age} ans` : "Âge non renseigné"}</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <GraduationCap className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{levelLabel || student.niveau || "Non classé"}</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CreditCard className="h-3.5 w-3.5 shrink-0" />
          {feeBadge(feeStatus)}
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex items-center gap-1.5 border-t px-4 py-2.5 bg-muted/30">
        <Calendar className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">
          Inscrit le {student.created_at ? new Date(student.created_at).toLocaleDateString("fr-FR") : "—"}
        </span>
      </div>
    </Card>
  );
}
