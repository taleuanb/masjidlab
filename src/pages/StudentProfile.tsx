import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

import StudentIdentityCard from "@/components/student/StudentIdentityCard";
import StudentKpiCards from "@/components/student/StudentKpiCards";
import StudentOverviewTab from "@/components/student/StudentOverviewTab";
import StudentTimelineTab from "@/components/student/StudentTimelineTab";
import StudentResultsTab from "@/components/student/StudentResultsTab";

const StudentProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orgId } = useOrganization();

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

  // Parent info
  const { data: parentInfo } = useQuery({
    queryKey: ["student_parent", student?.parent_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, email, phone")
        .eq("id", student!.parent_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!student?.parent_id,
  });

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

  const className = (enrollment?.madrasa_classes as any)?.nom || "—";
  const levelName = (enrollment?.madrasa_classes as any)?.niveau || student.niveau || "—";

  return (
    <main className="flex-1 p-4 md:p-6 space-y-5 max-w-6xl">
      <div className="flex items-center gap-3 flex-wrap">
        <SidebarTrigger />
        <Button variant="ghost" size="sm" onClick={() => navigate("/eleves")} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Élèves
        </Button>
      </div>

      <StudentIdentityCard
        student={student}
        levelName={levelName}
        className={className}
        enrollmentActive={enrollment?.statut === "Actif"}
        parentName={parentInfo?.display_name}
      />

      <StudentKpiCards
        attendanceRate={attendanceRate}
        presentCount={presentCount}
        totalAttendance={totalAttendance}
        gradeAvg={gradeAvg}
        gradesCount={grades.length}
        progressCount={progressEntries.length}
      />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="timeline">Suivi Pédagogique</TabsTrigger>
          <TabsTrigger value="results">Résultats</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <StudentOverviewTab
            grades={grades}
            progressEntries={progressEntries}
            studentPrenom={student.prenom}
            parentInfo={parentInfo}
          />
        </TabsContent>

        <TabsContent value="timeline">
          <StudentTimelineTab progressEntries={progressEntries} studentPrenom={student.prenom} />
        </TabsContent>

        <TabsContent value="results">
          <StudentResultsTab grades={grades} />
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default StudentProfile;
