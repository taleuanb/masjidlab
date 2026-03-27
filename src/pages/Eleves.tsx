import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { GraduationCap, Trash2, Search, Users, UserCheck, BarChart3, Rocket, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
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
  const [filterCycle, setFilterCycle] = useState<string>("all");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

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
        .select("student_id, statut, class_id, madrasa_classes(id, nom, niveau, capacity_max, level_id)")
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
        .select("id, nom, niveau, capacity_max, level_id")
        .eq("org_id", orgId)
        .order("nom");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ["madrasa_cycles", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("madrasa_cycles")
        .select("id, nom")
        .eq("org_id", orgId)
        .order("nom");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: levels = [] } = useQuery({
    queryKey: ["madrasa_levels_filter", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("madrasa_levels")
        .select("id, label, cycle_id")
        .eq("org_id", orgId);
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
      queryClient.invalidateQueries({ queryKey: ["madrasa_enrollments_stats", orgId] });
      toast.success("Élève supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  // Levels belonging to selected cycle
  const cycleFilteredLevelIds = useMemo(() => {
    if (filterCycle === "all") return null;
    return new Set(levels.filter(l => l.cycle_id === filterCycle).map(l => l.id));
  }, [filterCycle, levels]);

  // Classes filtered by cycle
  const classesForFilter = useMemo(() => {
    if (!cycleFilteredLevelIds) return classes;
    return classes.filter(c => c.level_id && cycleFilteredLevelIds.has(c.level_id));
  }, [classes, cycleFilteredLevelIds]);

  // Reset class filter when cycle changes and selected class is no longer valid
  useMemo(() => {
    if (filterClass !== "all" && classesForFilter.length > 0 && !classesForFilter.find(c => c.id === filterClass)) {
      // We can't call setState in useMemo, so we handle it in the filter logic
    }
  }, [filterClass, classesForFilter]);

  // Filtered students
  const filtered = useMemo(() => {
    return students.filter(s => {
      const q = search.toLowerCase();
      if (q && !`${s.nom} ${s.prenom}`.toLowerCase().includes(q)) return false;

      const enr = enrollments.find(e => e.student_id === s.id);
      const cls = enr?.madrasa_classes as Record<string, unknown> | null;

      // Cycle filter
      if (filterCycle !== "all" && cycleFilteredLevelIds) {
        const levelId = cls?.level_id as string | undefined;
        if (!levelId || !cycleFilteredLevelIds.has(levelId)) return false;
      }

      // Class filter
      if (filterClass !== "all") {
        if (!enr || enr.class_id !== filterClass) return false;
      }

      // Status filter
      if (filterStatus !== "all") {
        const statut = enr?.statut ?? "Inactif";
        if (filterStatus === "Actif" && statut !== "Actif") return false;
        if (filterStatus === "En attente" && statut !== "En attente") return false;
        if (filterStatus === "Retiré" && statut !== "Retiré" && statut !== "Inactif") return false;
      }

      return true;
    });
  }, [students, search, filterCycle, filterClass, filterStatus, enrollments, cycleFilteredLevelIds]);

  // KPI calculations
  const activeEnrollments = enrollments.filter(e => e.statut === "Actif").length;
  const totalCapacity = useMemo(() => classes.reduce((sum, c) => sum + (c.capacity_max ?? 15), 0), [classes]);
  const occupancyRate = totalCapacity > 0 ? Math.round((activeEnrollments / totalCapacity) * 100) : 0;

  return (
    <main className="flex-1 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <GraduationCap className="h-5 w-5 text-brand-cyan" />
        <h1 className="text-xl font-bold text-foreground">Élèves</h1>
        <div className="ml-auto">
          <Button
            className="bg-brand-navy text-white hover:bg-brand-navy/90"
            onClick={() => navigate("/inscriptions")}
          >
            <Rocket className="h-4 w-4 mr-1" />
            Nouvelle Inscription
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
              <Users className="h-3.5 w-3.5" /> Total Élèves
            </div>
            <p className="text-2xl font-bold">{isLoading ? "—" : students.length}</p>
            <Badge className="mt-2 bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30 text-[10px]">
              {filtered.length} affiché(s)
            </Badge>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
              <UserCheck className="h-3.5 w-3.5" /> Inscriptions Actives
            </div>
            <p className="text-2xl font-bold text-brand-emerald">{isLoading ? "—" : activeEnrollments}</p>
            <p className="text-xs text-muted-foreground mt-1">
              sur {students.length} élève(s)
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
              <Building2 className="h-3.5 w-3.5" /> Capacité Globale
            </div>
            <p className="text-2xl font-bold">{occupancyRate}%</p>
            <Progress value={occupancyRate} className="mt-2 h-1.5 [&>div]:bg-brand-cyan" />
            <p className="text-xs text-muted-foreground mt-1">
              {activeEnrollments} / {totalCapacity} places
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
              <BarChart3 className="h-3.5 w-3.5" /> Classes Actives
            </div>
            <p className="text-2xl font-bold">{isLoading ? "—" : classes.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {cycles.length} cycle(s) configuré(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un élève par nom ou prénom..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCycle} onValueChange={v => { setFilterCycle(v); setFilterClass("all"); }}>
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue placeholder="Cycle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les cycles</SelectItem>
            {cycles.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Classe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {classesForFilter.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="Actif">Actif</SelectItem>
            <SelectItem value="En attente">En attente</SelectItem>
            <SelectItem value="Retiré">Désinscrit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center space-y-2">
          <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground font-medium">
            {students.length === 0
              ? "Aucun élève enregistré."
              : "Aucun élève ne correspond à vos filtres."}
          </p>
          <p className="text-xs text-muted-foreground">
            {students.length === 0
              ? "Cliquez sur « Nouvelle Inscription » pour commencer."
              : "Essayez d'élargir vos critères de recherche."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
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
                const statut = enrollment?.statut ?? "Inactif";
                const cls = enrollment?.madrasa_classes as Record<string, unknown> | null;
                return (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => navigate(`/eleves/${s.id}`)}
                  >
                    <TableCell className="font-medium">{s.nom}</TableCell>
                    <TableCell>{s.prenom}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline">{(cls?.nom as string) ?? "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{(cls?.niveau as string) ?? s.niveau ?? "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        statut === "Actif"
                          ? "bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30"
                          : statut === "En attente"
                            ? "bg-amber-100 text-amber-700 border-amber-300"
                            : "bg-muted text-muted-foreground"
                      }>
                        {statut === "Retiré" ? "Désinscrit" : statut}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {s.date_naissance ?? "—"}
                    </TableCell>
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
