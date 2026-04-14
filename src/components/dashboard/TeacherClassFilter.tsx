import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useTeacherScope } from "@/hooks/useTeacherScope";
import { useTeacherFilter } from "@/contexts/TeacherFilterContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";

export function TeacherClassFilter() {
  const { orgId } = useOrganization();
  const { isTeacher, teacherClassIds } = useTeacherScope();
  const { selectedClassId, setSelectedClassId } = useTeacherFilter();

  const { data: classes } = useQuery({
    queryKey: ["teacher-classes-filter", orgId, teacherClassIds],
    enabled: isTeacher && teacherClassIds.length > 0 && !!orgId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("madrasa_classes")
        .select("id, nom")
        .eq("org_id", orgId!)
        .in("id", teacherClassIds)
        .order("nom");
      return data ?? [];
    },
  });

  if (!isTeacher || !classes || classes.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Filter className="h-4 w-4 text-muted-foreground" />
      <Select
        value={selectedClassId ?? "all"}
        onValueChange={(v) => setSelectedClassId(v === "all" ? null : v)}
      >
        <SelectTrigger className="h-8 w-[220px] text-xs">
          <SelectValue placeholder="Toutes mes classes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes mes classes</SelectItem>
          {classes.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.nom}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
