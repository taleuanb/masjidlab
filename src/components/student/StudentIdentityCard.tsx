import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  student: { prenom: string; nom: string; date_naissance?: string | null };
  levelName: string;
  className: string;
  enrollmentActive: boolean;
  parentName?: string | null;
}

const StudentIdentityCard = ({ student, levelName, className, enrollmentActive, parentName }: Props) => {
  const initials = `${student.prenom?.[0] || ""}${student.nom?.[0] || ""}`.toUpperCase();

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card">
      <Avatar className="h-14 w-14 bg-brand-navy text-white">
        <AvatarFallback className="bg-brand-navy text-white font-bold text-lg">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-foreground">{student.prenom} {student.nom}</h1>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant="outline">{levelName}</Badge>
          <Badge variant="secondary">{className}</Badge>
          {enrollmentActive && (
            <Badge className="bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30">Actif</Badge>
          )}
        </div>
        {parentName && (
          <p className="text-xs text-muted-foreground mt-1.5">Parent : {parentName}</p>
        )}
      </div>
      {student.date_naissance && (
        <p className="text-xs text-muted-foreground hidden sm:block">
          Né(e) le {format(parseISO(student.date_naissance), "dd MMMM yyyy", { locale: fr })}
        </p>
      )}
    </div>
  );
};

export default StudentIdentityCard;
