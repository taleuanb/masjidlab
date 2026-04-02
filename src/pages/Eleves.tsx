import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useTeacherScope } from "@/hooks/useTeacherScope";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  GraduationCap, Trash2, Search, Users, UserCheck, BarChart3,
  UserPlus, Building2, MoreHorizontal, MessageCircle, ArrowRightLeft,
  FileText, Pencil, BookOpen, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { ViewSwitcher, type ViewMode } from "@/components/ui/ViewSwitcher";
import { StatCards, type StatCardItem } from "@/components/shared/StatCards";
import { StudentCard } from "@/components/madrasa/StudentCard";

interface EnrollmentRow {
  student_id: string;
  statut: string | null;
  class_id: string;
  madrasa_classes: {
    id: string;
    nom: string;
    niveau: string | null;
    capacity_max: number | null;
    level_id: string | null;
  } | null;
}

interface FeeRow {
  student_id: string;
  status: string;
}

interface ParentProfile {
  id: string;
  display_name: string;
  phone: string | null;
}

const Eleves = () => {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isTeacher, teacherClassIds } = useTeacherScope();
  const canSeeFinance = !isTeacher;
  const canManage = !isTeacher;

  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filterCycle, setFilterCycle] = useState<string>("all");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterGender, setFilterGender] = useState<string>("all");

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
      return data as unknown as EnrollmentRow[];
    },
    enabled: !!orgId,
  });

  const { data: fees = [] } = useQuery({
    queryKey: ["madrasa_fees_status", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("madrasa_fees")
        .select("student_id, status")
        .eq("org_id", orgId);
      if (error) throw error;
      return data as FeeRow[];
    },
    enabled: !!orgId && canSeeFinance,
  });

  const { data: parentProfiles = [] } = useQuery({
    queryKey: ["parent_profiles_phone", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const parentIds = students.map(s => s.parent_id).filter(Boolean) as string[];
      if (parentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, phone")
        .in("id", parentIds);
      if (error) throw error;
      return data as ParentProfile[];
    },
    enabled: !!orgId && students.length > 0,
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

  // Teacher scope
  const teacherClassIdSet = useMemo(
    () => (isTeacher ? new Set(teacherClassIds) : null),
    [isTeacher, teacherClassIds]
  );

  const scopedEnrollments = useMemo(() => {
    if (!teacherClassIdSet) return enrollments;
    return enrollments.filter(e => teacherClassIdSet.has(e.class_id));
  }, [enrollments, teacherClassIdSet]);

  const scopedStudentIds = useMemo(() => {
    if (!teacherClassIdSet) return null;
    return new Set(scopedEnrollments.map(e => e.student_id));
  }, [scopedEnrollments, teacherClassIdSet]);

  const scopedStudents = useMemo(() => {
    if (!scopedStudentIds) return students;
    return students.filter(s => scopedStudentIds.has(s.id));
  }, [students, scopedStudentIds]);

  // Lookup maps
  const feeStatusMap = useMemo(() => {
    if (!canSeeFinance) return {};
    const map: Record<string, "ok" | "overdue" | "pending"> = {};
    for (const f of fees) {
      const current = map[f.student_id];
      if (f.status === "overdue") map[f.student_id] = "overdue";
      else if (f.status === "pending" && current !== "overdue") map[f.student_id] = "pending";
      else if (!current) map[f.student_id] = "ok";
    }
    return map;
  }, [fees, canSeeFinance]);

  const parentMap = useMemo(() => {
    const map: Record<string, ParentProfile> = {};
    for (const p of parentProfiles) {
      map[p.id] = p;
    }
    return map;
  }, [parentProfiles]);

  const cycleFilteredLevelIds = useMemo(() => {
    if (filterCycle === "all") return null;
    return new Set(levels.filter(l => l.cycle_id === filterCycle).map(l => l.id));
  }, [filterCycle, levels]);

  // Build level lookup for cycle name resolution
  const levelMap = useMemo(() => {
    const map: Record<string, { label: string; cycle_id: string | null }> = {};
    for (const l of levels) map[l.id] = { label: l.label, cycle_id: l.cycle_id };
    return map;
  }, [levels]);

  const cycleMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of cycles) map[c.id] = c.nom;
    return map;
  }, [cycles]);

  const scopedClasses = useMemo(() => {
    if (!teacherClassIdSet) return classes;
    return classes.filter(c => teacherClassIdSet.has(c.id));
  }, [classes, teacherClassIdSet]);

  const classesForFilter = useMemo(() => {
    if (!cycleFilteredLevelIds) return scopedClasses;
    return scopedClasses.filter(c => c.level_id && cycleFilteredLevelIds.has(c.level_id));
  }, [scopedClasses, cycleFilteredLevelIds]);

  const filtered = useMemo(() => {
    return scopedStudents.filter(s => {
      // Quick filter
      if (quickFilter === "actif" && s.statut !== "actif") return false;
      if (quickFilter === "en_attente") {
        const enr = scopedEnrollments.find(e => e.student_id === s.id);
        if (!enr || enr.statut !== "en_attente") return false;
      }
      if (quickFilter === "ancien" && s.statut !== "ancien") return false;

      const q = search.toLowerCase();
      if (q) {
        const parentName = s.parent_id ? (parentMap[s.parent_id]?.display_name ?? "") : "";
        if (
          !`${s.nom} ${s.prenom}`.toLowerCase().includes(q) &&
          !parentName.toLowerCase().includes(q)
        ) return false;
      }

      if (filterGender !== "all" && s.gender !== filterGender) return false;

      const enr = scopedEnrollments.find(e => e.student_id === s.id);
      const cls = enr?.madrasa_classes;

      if (filterCycle !== "all" && cycleFilteredLevelIds) {
        const levelId = cls?.level_id;
        if (!levelId || !cycleFilteredLevelIds.has(levelId)) return false;
      }

      if (filterClass !== "all") {
        if (!enr || enr.class_id !== filterClass) return false;
      }

      if (filterStatus !== "all") {
        if (filterStatus === "actif" && s.statut !== "actif") return false;
        if (filterStatus === "ancien" && s.statut !== "ancien") return false;
      }

      return true;
    });
  }, [scopedStudents, search, quickFilter, filterCycle, filterClass, filterStatus, filterGender, scopedEnrollments, cycleFilteredLevelIds, parentMap]);

  const activeEnrollments = scopedEnrollments.filter(e => e.statut === "place").length;
  const totalCapacity = useMemo(() => scopedClasses.reduce((sum, c) => sum + (c.capacity_max ?? 15), 0), [scopedClasses]);
  const occupancyRate = totalCapacity > 0 ? Math.round((activeEnrollments / totalCapacity) * 100) : 0;

  const getInitials = (nom: string, prenom: string) =>
    `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();

  const openWhatsApp = (parentId: string | null) => {
    if (!parentId) { toast.error("Aucun parent rattaché"); return; }
    const parent = parentMap[parentId];
    if (!parent?.phone) { toast.error("Numéro du parent non disponible"); return; }
    const cleaned = parent.phone.replace(/\s+/g, "").replace(/^0/, "33");
    window.open(`https://wa.me/${cleaned}`, "_blank");
  };

  const getFeeStatusBadge = (studentId: string) => {
    const status = feeStatusMap[studentId];
    if (status === "overdue") return <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">Retard</Badge>;
    if (status === "pending") return <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px]">En attente</Badge>;
    if (status === "ok") return <Badge className="bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30 text-[10px]">À jour</Badge>;
    return <span className="text-xs text-muted-foreground">—</span>;
  };

  const getGenderBadge = (gender: string | null) => {
    if (gender === "M") return <Badge className="bg-sky-100 text-sky-700 border-sky-300 text-[10px] px-1.5">M</Badge>;
    if (gender === "F") return <Badge className="bg-pink-100 text-pink-700 border-pink-300 text-[10px] px-1.5">F</Badge>;
    return null;
  };

  const getCycleName = (levelId: string | null | undefined): string | null => {
    if (!levelId) return null;
    const level = levelMap[levelId];
    if (!level?.cycle_id) return null;
    return cycleMap[level.cycle_id] ?? null;
  };

  const getLevelLabel = (levelId: string | null | undefined): string | null => {
    if (!levelId) return null;
    return levelMap[levelId]?.label ?? null;
  };

  return (
    <TooltipProvider>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <GraduationCap className="h-5 w-5 text-brand-cyan" />
          <h1 className="text-xl font-bold text-foreground">
            {isTeacher ? "Mes Élèves" : "Élèves"}
          </h1>
          {isTeacher && (
            <Badge variant="outline" className="text-xs text-brand-cyan border-brand-cyan/30">
              Périmètre enseignant
            </Badge>
          )}
          {canManage && (
            <div className="ml-auto">
              <Button
                className="bg-brand-navy text-white hover:bg-brand-navy/90"
                onClick={() => navigate("/inscriptions")}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Nouvelle Inscription
              </Button>
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <StatCards items={[
          { label: isTeacher ? "Mes Élèves" : "Total Élèves", value: isLoading ? "—" : scopedStudents.length, icon: Users, subValue: `${filtered.length} affiché(s)` },
          { label: "Inscriptions Actives", value: isLoading ? "—" : activeEnrollments, icon: UserCheck, subValue: `sur ${scopedStudents.length} élève(s)` },
          { label: isTeacher ? "Capacité Mes classes" : "Capacité Globale", value: `${occupancyRate}%`, icon: Building2, subValue: `${activeEnrollments} / ${totalCapacity} places`, progress: occupancyRate },
          ...(canSeeFinance ? [{ label: "Classes Actives", value: isLoading ? "—" : classes.length, icon: BarChart3, subValue: `${cycles.length} cycle(s) configuré(s)` } as StatCardItem] : []),
        ]} className={`grid grid-cols-1 sm:grid-cols-2 ${canSeeFinance ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-4`} />

        {/* Quick Filter Tabs */}
        <Tabs value={quickFilter} onValueChange={setQuickFilter}>
          <TabsList>
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="actif">🟢 Actifs</TabsTrigger>
            <TabsTrigger value="en_attente">🟡 En attente</TabsTrigger>
            <TabsTrigger value="ancien">⚫ Anciens</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher par élève ou parent..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <Select value={filterGender} onValueChange={setFilterGender}>
            <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm"><SelectValue placeholder="Sexe" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="M">Homme</SelectItem>
              <SelectItem value="F">Femme</SelectItem>
            </SelectContent>
          </Select>
          {!isTeacher && (
            <Select value={filterCycle} onValueChange={v => { setFilterCycle(v); setFilterClass("all"); }}>
              <SelectTrigger className="w-full sm:w-[170px] h-9 text-sm"><SelectValue placeholder="Cycle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les cycles</SelectItem>
                {cycles.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={filterClass} onValueChange={setFilterClass}>
            <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm"><SelectValue placeholder="Classe" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isTeacher ? "Toutes mes classes" : "Toutes les classes"}</SelectItem>
              {classesForFilter.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="actif">Actif</SelectItem>
              <SelectItem value="ancien">Ancien élève</SelectItem>
            </SelectContent>
          </Select>
          <ViewSwitcher viewMode={viewMode} onViewChange={setViewMode} className="shrink-0 ml-auto" />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border bg-card p-10 text-center space-y-2">
            <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">
              {scopedStudents.length === 0
                ? isTeacher
                  ? "Aucun élève dans vos classes."
                  : "Aucun élève enregistré."
                : "Aucun élève ne correspond à vos filtres."}
            </p>
            <p className="text-xs text-muted-foreground">
              {scopedStudents.length === 0
                ? isTeacher
                  ? "Contactez l'administration pour être assigné à une classe."
                  : "Cliquez sur « Nouvelle Inscription » pour commencer."
                : "Essayez d'élargir vos critères de recherche."}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Élève</TableHead>
                  <TableHead className="hidden sm:table-cell">Âge</TableHead>
                  <TableHead className="hidden md:table-cell">Parcours</TableHead>
                  <TableHead className="hidden lg:table-cell">Responsable Légal</TableHead>
                  <TableHead>Statut</TableHead>
                  {canSeeFinance && <TableHead className="hidden xl:table-cell">Finance</TableHead>}
                  <TableHead className="text-right w-[130px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const enrollment = scopedEnrollments.find(e => e.student_id === s.id);
                  const statut = enrollment?.statut ?? "Inactif";
                  const cls = enrollment?.madrasa_classes;
                  const parent = s.parent_id ? parentMap[s.parent_id] : null;
                  const cycleName = getCycleName(cls?.level_id);
                  const levelLabel = getLevelLabel(cls?.level_id);

                  return (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer hover:bg-muted/40 border-b"
                      onClick={() => navigate(`/eleves/${s.id}`)}
                    >
                      {/* Élève: Avatar + Nom + Genre badge */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 bg-brand-navy/10 text-brand-navy shrink-0">
                            <AvatarFallback className="text-xs font-semibold bg-brand-navy/10 text-brand-navy">
                              {getInitials(s.nom, s.prenom)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm leading-tight">{s.prenom} {s.nom}</span>
                            {getGenderBadge(s.gender)}
                          </div>
                        </div>
                      </TableCell>

                      {/* Âge */}
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {s.age ? `${s.age} ans` : "—"}
                      </TableCell>

                      {/* Parcours: Cycle badge > Niveau > Classe */}
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {cycleName && (
                            <Badge className="bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30 text-[10px]">
                              {cycleName}
                            </Badge>
                          )}
                          {enrollment?.statut === "en_attente" || !cls ? (
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-400/30 font-semibold">
                              🟡 Sandbox
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {levelLabel ?? cls?.niveau ?? "—"} &gt; {cls?.nom ?? "—"}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Responsable Légal */}
                      <TableCell className="hidden lg:table-cell">
                        {parent ? (
                          <div>
                            <p className="text-sm font-medium leading-tight">{parent.display_name}</p>
                            <p className="text-xs text-muted-foreground">{parent.phone ?? "—"}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Statut élève */}
                      <TableCell>
                        <Badge className={
                          s.statut === "actif"
                            ? "bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30"
                            : s.statut === "ancien"
                              ? "bg-muted text-muted-foreground border-border"
                              : "bg-muted text-muted-foreground"
                        }>
                          {s.statut === "actif" ? "Actif" : s.statut === "ancien" ? "Ancien élève" : (s.statut ?? "—")}
                        </Badge>
                      </TableCell>

                      {/* Finance (admin only) */}
                      {canSeeFinance && (
                        <TableCell className="hidden xl:table-cell">
                          {getFeeStatusBadge(s.id)}
                        </TableCell>
                      )}

                      {/* Actions */}
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {/* Voir profil */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => navigate(`/eleves/${s.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Voir la fiche</TooltipContent>
                          </Tooltip>

                          {/* WhatsApp */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-brand-emerald hover:text-brand-emerald/80"
                                onClick={() => openWhatsApp(s.parent_id)}
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Contacter le parent via WhatsApp</TooltipContent>
                          </Tooltip>

                          {/* Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {isTeacher ? (
                                <DropdownMenuItem onClick={() => navigate(`/eleves/${s.id}`)}>
                                  <BookOpen className="h-3.5 w-3.5 mr-2" /> Voir suivi pédagogique
                                </DropdownMenuItem>
                              ) : (
                                <>
                                  <DropdownMenuItem onClick={() => navigate(`/eleves/${s.id}`)}>
                                    <Pencil className="h-3.5 w-3.5 mr-2" /> Modifier l'inscription
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => toast.info("Fonctionnalité à venir")}>
                                    <ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Changer de classe
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onSelect={e => e.preventDefault()}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Supprimer cet élève ?</AlertDialogTitle>
                                        <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteMutation.mutate(s.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Supprimer
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        </div>
      </main>
    </TooltipProvider>
  );
};

export default Eleves;
