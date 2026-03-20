import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft, GraduationCap, CalendarCheck, TrendingUp,
  BookOpen, ClipboardList, CheckCircle2, Clock, AlertCircle
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart
} from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

const StudentProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orgId } = useOrganization();

  // Student info
  const { data: student, isLoading: loadingStudent } = useQuery({
    queryKey: ["student_profile", id, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_students")
        .select("*")
        .eq("id", id!)
        .eq("org_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!orgId,
  });

  // Enrollment info (class)
  const { data: enrollment } = useQuery({
    queryKey: ["student_enrollment", id, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_enrollments")
        .select("*, madrasa_classes(nom, niveau)")
        .eq("student_id", id!)
        .eq("org_id", orgId!)
        .eq("statut", "Actif")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!orgId,
  });

  // Attendance stats
  const { data: attendanceData = [] } = useQuery({
    queryKey: ["student_attendance", id, orgId],
    queryFn: async () => {
      if (!enrollment?.id) return [];
      const { data, error } = await supabase
        .from("madrasa_attendance")
        .select("status, date")
        .eq("enrollment_id", enrollment.id)
        .eq("org_id", orgId!);
      if (error) throw error;
      return data;
    },
    enabled: !!enrollment?.id && !!orgId,
  });

  // Grades
  const { data: grades = [] } = useQuery({
    queryKey: ["student_grades", id, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_grades")
        .select("*, madrasa_evaluations(title, date, max_points, madrasa_subjects(name))")
        .eq("student_id", id!)
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!orgId,
  });

  // Session progress (carnet de suivi)
  const { data: progressEntries = [] } = useQuery({
    queryKey: ["student_progress", id, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_student_progress")
        .select("*, madrasa_session_configs(madrasa_subjects(name))")
        .eq("student_id", id!)
        .eq("org_id", orgId!)
        .order("lesson_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!orgId,
  });

  // Computed stats
  const totalAttendance = attendanceData.length;
  const presentCount = attendanceData.filter(a => a.status === "present").length;
  const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

  const gradeAvg = grades.length > 0
    ? (grades.reduce((sum, g) => {
        const max = (g.madrasa_evaluations as any)?.max_points || 20;
        return sum + ((g.score || 0) / max) * 20;
      }, 0) / grades.length).toFixed(1)
    : "—";

  // Chart data for grades over time
  const chartData = [...grades]
    .sort((a, b) => {
      const dateA = (a.madrasa_evaluations as any)?.date || "";
      const dateB = (b.madrasa_evaluations as any)?.date || "";
      return dateA.localeCompare(dateB);
    })
    .map(g => {
      const eval_ = g.madrasa_evaluations as any;
      const max = eval_?.max_points || 20;
      return {
        date: eval_?.date ? format(parseISO(eval_.date), "dd MMM", { locale: fr }) : "",
        note: g.score ? Number(((g.score / max) * 20).toFixed(1)) : 0,
        matiere: eval_?.madrasa_subjects?.name || "—",
        title: eval_?.title || "",
      };
    });

  if (loadingStudent) {
    return (
      <main className="flex-1 p-6 space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" />
        </div>
        <Skeleton className="h-96" />
      </main>
    );
  }

  if (!student) {
    return (
      <main className="flex-1 p-6">
        <Button variant="ghost" onClick={() => navigate("/eleves")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
        <div className="mt-12 text-center text-muted-foreground">Élève introuvable.</div>
      </main>
    );
  }

  const initials = `${student.prenom?.[0] || ""}${student.nom?.[0] || ""}`.toUpperCase();
  const className = (enrollment?.madrasa_classes as any)?.nom || "—";
  const levelName = (enrollment?.madrasa_classes as any)?.niveau || student.niveau || "—";

  return (
    <main className="flex-1 p-4 md:p-6 space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <SidebarTrigger />
        <Button variant="ghost" size="sm" onClick={() => navigate("/eleves")} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Élèves
        </Button>
      </div>

      {/* Identity card */}
      <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card">
        <Avatar className="h-14 w-14 bg-brand-navy text-white">
          <AvatarFallback className="bg-brand-navy text-white font-bold text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground">{student.prenom} {student.nom}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline">{levelName}</Badge>
            <Badge variant="secondary">{className}</Badge>
            {enrollment?.statut === "Actif" && (
              <Badge className="bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30">Actif</Badge>
            )}
          </div>
        </div>
        {student.date_naissance && (
          <p className="text-xs text-muted-foreground hidden sm:block">
            Né(e) le {format(parseISO(student.date_naissance), "dd MMMM yyyy", { locale: fr })}
          </p>
        )}
      </div>

      {/* KPI Cards */}
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
            <p className="text-xs text-muted-foreground mt-1">{grades.length} évaluation(s)</p>
          </CardContent>
        </Card>
        <Card className="border-brand-navy/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
              <BookOpen className="h-3.5 w-3.5" /> Suivis de séance
            </div>
            <p className="text-2xl font-bold text-brand-navy">{progressEntries.length}</p>
            <p className="text-xs text-muted-foreground mt-1">rapports enregistrés</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="timeline">Carnet de Suivi</TabsTrigger>
          <TabsTrigger value="charts">Graphiques</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
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

          {/* Latest to-do */}
          {progressEntries.length > 0 && (
            <Card className="border-brand-cyan/20 bg-brand-cyan/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-brand-cyan">
                  <CheckCircle2 className="h-4 w-4" /> À faire — Prochaine séance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const latest = progressEntries[0];
                  const data = latest.data_json as Record<string, any>;
                  const todo = data?.todo_prochaine_seance || data?.todo || null;
                  const subjectName = (latest.madrasa_session_configs as any)?.madrasa_subjects?.name || "—";
                  return (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {subjectName} · {format(parseISO(latest.lesson_date), "dd MMM yyyy", { locale: fr })}
                      </p>
                      <p className="text-sm font-medium">
                        {todo || "Aucun devoir défini pour la prochaine séance."}
                      </p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="space-y-3">
          {progressEntries.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Le voyage éducatif de {student.prenom} commence. Ses suivis de séance apparaîtront ici.
              </p>
            </div>
          ) : (
            progressEntries.map(entry => {
              const data = entry.data_json as Record<string, any>;
              const subjectName = (entry.madrasa_session_configs as any)?.madrasa_subjects?.name || "Matière";
              const todo = data?.todo_prochaine_seance || data?.todo;
              const otherFields = Object.entries(data).filter(
                ([k]) => !["todo_prochaine_seance", "todo"].includes(k)
              );

              return (
                <Card key={entry.id} className="overflow-hidden">
                  <CardHeader className="pb-2 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-brand-navy" />
                        {format(parseISO(entry.lesson_date), "EEEE dd MMMM yyyy", { locale: fr })}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs">{subjectName}</Badge>
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
            })
          )}
        </TabsContent>

        {/* Charts */}
        <TabsContent value="charts">
          {chartData.length < 2 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Au moins 2 évaluations sont nécessaires pour générer un graphique de progression.
              </p>
            </div>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Évolution des notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="noteGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(161 84% 39%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(161 84% 39%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 20]} tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid hsl(var(--border))",
                          backgroundColor: "hsl(var(--card))",
                        }}
                        formatter={(value: number, _: any, props: any) => [
                          `${value}/20`,
                          props.payload.title || props.payload.matiere,
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="note"
                        stroke="hsl(161 84% 39%)"
                        strokeWidth={2}
                        fill="url(#noteGrad)"
                        dot={{ r: 4, fill: "hsl(161 84% 39%)" }}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default StudentProfile;
