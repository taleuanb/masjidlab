import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useTeacherScope } from "@/hooks/useTeacherScope";
import { useTeacherFilter } from "@/contexts/TeacherFilterContext";
import { useRole } from "@/contexts/RoleContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";

export function TeacherClassFilter() {
  const { orgId } = useOrganization();
  const { isTeacher, teacherClassIds } = useTeacherScope();
  const { isSuperAdmin } = useRole();
  const { selectedClassId, setSelectedClassId } = useTeacherFilter();

  const canShow = isTeacher || isSuperAdmin;

  const { data: classes } = useQuery({
    queryKey: ["teacher-classes-filter", orgId, isTeacher, teacherClassIds],
    enabled: canShow && !!orgId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      let query = supabase
        .from("madrasa_classes")
        .select("id, nom")
        .eq("org_id", orgId!)
        .order("nom");

      if (isTeacher) {
        query = query.in("id", teacherClassIds);
      }

      const { data } = await query;
      return data ?? [];
    },
  });

  if (!canShow || !classes || classes.length === 0) return null;

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
          <SelectItem value="all">{isTeacher ? "Toutes mes classes" : "Toutes les classes"}</SelectItem>
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
