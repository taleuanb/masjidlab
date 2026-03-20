import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { GraduationCap, Trash2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Eleves = () => {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterLevel, setFilterLevel] = useState<string>("all");

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["madrasa_students", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("madrasa_students")
        .select("*")
        .eq("org_id", orgId)
        .order("nom");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["madrasa_enrollments_stats", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("madrasa_enrollments")
        .select("student_id, statut, class_id, madrasa_classes(id, nom, niveau)")
        .eq("org_id", orgId);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["madrasa_classes_filter", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("madrasa_classes")
        .select("id, nom, niveau")
        .eq("org_id", orgId)
        .order("nom");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("madrasa_students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["madrasa_students", orgId] });
      toast.success("Élève supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  // Derive unique levels from classes
  const levels = useMemo(() => {
    const set = new Set(classes.map(c => c.niveau).filter(Boolean));
    return Array.from(set) as string[];
  }, [classes]);

  // Filtered students
  const filtered = useMemo(() => {
    return students.filter(s => {
      // Search
      const q = search.toLowerCase();
      if (q && !`${s.nom} ${s.prenom}`.toLowerCase().includes(q)) return false;

      // Class filter
      if (filterClass !== "all") {
        const enr = enrollments.find(e => e.student_id === s.id);
        if (!enr || enr.class_id !== filterClass) return false;
      }

      // Level filter
      if (filterLevel !== "all") {
        if (s.niveau !== filterLevel) {
          const enr = enrollments.find(e => e.student_id === s.id);
          const cls = enr?.madrasa_classes as any;
          if (!cls || cls.niveau !== filterLevel) return false;
        }
      }

      return true;
    });
  }, [students, search, filterClass, filterLevel, enrollments]);

  const activeEnrollments = enrollments.filter(e => e.statut === "Actif").length;
  const enrollmentRate = students.length > 0 ? Math.round((activeEnrollments / students.length) * 100) : 0;

  return (
    <main className="flex-1 p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <GraduationCap className="h-5 w-5 text-accent" />
        <h1 className="text-xl font-bold text-foreground">Élèves</h1>
        <Badge variant="secondary" className="ml-auto">{filtered.length} élève(s)</Badge>
      </div>

      {/* Mini stats */}
      {students.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Total élèves</p>
            <p className="text-2xl font-bold mt-1">{students.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Inscriptions actives</p>
            <p className="text-2xl font-bold mt-1 text-brand-emerald">{activeEnrollments}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Taux d'inscription</p>
            <p className="text-2xl font-bold mt-1">{enrollmentRate}%</p>
            <Progress value={enrollmentRate} className="mt-2 h-1.5 [&>div]:bg-brand-emerald" />
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un élève..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Classe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {classes.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Niveau" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les niveaux</SelectItem>
            {levels.map(l => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          {students.length === 0
            ? "Aucun élève enregistré. Les inscriptions apparaîtront ici."
            : "Aucun élève ne correspond à votre recherche."}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Prénom</TableHead>
                <TableHead className="hidden sm:table-cell">Classe</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden md:table-cell">Date de naissance</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const enrollment = enrollments.find(e => e.student_id === s.id);
                const isActive = enrollment?.statut === "Actif";
                const cls = enrollment?.madrasa_classes as any;
                return (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/eleves/${s.id}`)}
                  >
                    <TableCell className="font-medium">{s.nom}</TableCell>
                    <TableCell>{s.prenom}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline">{cls?.nom ?? "—"}</Badge>
                    </TableCell>
                    <TableCell><Badge variant="outline">{cls?.niveau ?? s.niveau ?? "—"}</Badge></TableCell>
                    <TableCell>
                      <Badge className={isActive ? "bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30" : "bg-muted text-muted-foreground"}>
                        {isActive ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">{s.date_naissance ?? "—"}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer cet élève ?</AlertDialogTitle>
                            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="text-muted-foreground">Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
};

export default Eleves;
