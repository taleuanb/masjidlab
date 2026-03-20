import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarCheck, TrendingUp, BookOpen } from "lucide-react";

interface Props {
  attendanceRate: number;
  presentCount: number;
  totalAttendance: number;
  gradeAvg: string;
  gradesCount: number;
  progressCount: number;
}

const StudentKpiCards = ({ attendanceRate, presentCount, totalAttendance, gradeAvg, gradesCount, progressCount }: Props) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <Card className="border-brand-navy/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
          <CalendarCheck className="h-3.5 w-3.5" /> Assiduité
        </div>
        <p className="text-2xl font-bold text-brand-navy">{attendanceRate}%</p>
        <Progress value={attendanceRate} className="mt-2 h-1.5 [&>div]:bg-brand-emerald" />
        <p className="text-xs text-muted-foreground mt-1">{presentCount}/{totalAttendance} séances</p>
      </CardContent>
    </Card>
    <Card className="border-brand-navy/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
          <TrendingUp className="h-3.5 w-3.5" /> Moyenne générale
        </div>
        <p className="text-2xl font-bold text-brand-navy">{gradeAvg}<span className="text-sm font-normal text-muted-foreground">/20</span></p>
        <p className="text-xs text-muted-foreground mt-1">{gradesCount} évaluation(s)</p>
      </CardContent>
    </Card>
    <Card className="border-brand-navy/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
          <BookOpen className="h-3.5 w-3.5" /> Suivis de séance
        </div>
        <p className="text-2xl font-bold text-brand-navy">{progressCount}</p>
        <p className="text-xs text-muted-foreground mt-1">rapports enregistrés</p>
      </CardContent>
    </Card>
  </div>
);

export default StudentKpiCards;
