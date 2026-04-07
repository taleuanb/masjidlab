import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Wallet, TrendingUp, AlertCircle, Mail, Search,
  Banknote, MessageSquare, Download, Check, Eye, Bell,
} from "lucide-react";
import { useStudentFeesSummary, type StudentFeeSummary } from "@/hooks/useStudentFeesSummary";
import { useMadrasaFees } from "@/hooks/useMadrasaFees";
import { useCurrentAcademicYear } from "@/hooks/useCurrentAcademicYear";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { StatCards, type StatCardItem } from "@/components/shared/StatCards";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/hooks/use-toast";

/* ── Status helpers ── */
function getGlobalStatus(row: StudentFeeSummary): "solde" | "retard" | "en_attente" {
  if (row.solde_restant <= 0) return "solde";
  if (row.nb_retards > 0) return "retard";
  return "en_attente";
}

const GLOBAL_STATUS_CONFIG = {
  solde: { label: "Soldé", cls: "bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30 text-[10px] px-2 py-0.5" },
  en_attente: { label: "En attente", cls: "bg-amber-100 text-amber-700 border-amber-300 text-[10px] px-2 py-0.5" },
  retard: { label: "Retard", cls: "bg-destructive/15 text-destructive border-destructive/30 text-[10px] px-2 py-0.5" },
};

const FEE_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  paid: { label: "Payé", cls: "bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30 text-[10px] px-2 py-0.5" },
  pending: { label: "En attente", cls: "bg-amber-100 text-amber-700 border-amber-300 text-[10px] px-2 py-0.5" },
  overdue: { label: "Retard", cls: "bg-destructive/15 text-destructive border-destructive/30 text-[10px] px-2 py-0.5" },
};

/* ── Detail Sheet ── */
function StudentFeeDetailSheet({
  student,
  open,
  onOpenChange,
}: {
  student: StudentFeeSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { orgId } = useOrganization();
  const { encaisser } = useMadrasaFees();
  const queryClient = useQueryClient();
  const [confirmFee, setConfirmFee] = useState<{ id: string; amount: number; due_date: string } | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const { data: fees, isLoading } = useQuery({
    queryKey: ["student-fees-detail", student?.student_id, orgId],
    enabled: !!student && !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_fees")
        .select("id, amount, due_date, status")
        .eq("org_id", orgId!)
        .eq("student_id", student!.student_id)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const pendingFees = useMemo(
    () => (fees ?? []).filter((f) => f.status === "pending" || f.status === "overdue"),
    [fees],
  );

  const handleEncaisser = () => {
    if (!confirmFee || !student) return;
    encaisser.mutate(
      {
        feeId: confirmFee.id,
        amount: confirmFee.amount,
        studentNom: student.nom,
        studentPrenom: student.prenom,
        dueDate: confirmFee.due_date,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["student-fees-detail", student.student_id] });
          queryClient.invalidateQueries({ queryKey: ["student-fees-summary"] });
        },
      },
    );
    setConfirmFee(null);
  };

  const handleBulkEncaisser = async () => {
    if (!student || pendingFees.length === 0) return;
    setBulkProcessing(true);
    try {
      for (const fee of pendingFees) {
        await new Promise<void>((resolve, reject) => {
          encaisser.mutate(
            {
              feeId: fee.id,
              amount: Number(fee.amount),
              studentNom: student.nom,
              studentPrenom: student.prenom,
              dueDate: fee.due_date,
            },
            { onSuccess: () => resolve(), onError: (e) => reject(e) },
          );
        });
      }
      queryClient.invalidateQueries({ queryKey: ["student-fees-detail", student.student_id] });
      queryClient.invalidateQueries({ queryKey: ["student-fees-summary"] });
      toast({ title: "Compte soldé ✓", description: `Toutes les échéances de ${student.prenom} ${student.nom} ont été encaissées.` });
    } catch {
      toast({ title: "Erreur", description: "Une erreur est survenue lors de l'encaissement groupé.", variant: "destructive" });
    } finally {
      setBulkProcessing(false);
      setConfirmBulk(false);
    }
  };

  if (!student) return null;

  const status = getGlobalStatus(student);
  const statusCfg = GLOBAL_STATUS_CONFIG[status];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="text-lg">
              {student.prenom} {student.nom}
            </SheetTitle>
            <SheetDescription>
              {student.classe_nom ?? "Aucune classe"} · <Badge className={statusCfg.cls}>{statusCfg.label}</Badge>
            </SheetDescription>
          </SheetHeader>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 py-4">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Total annuel</p>
              <p className="text-lg font-semibold">{student.total_annuel.toLocaleString("fr-FR")} €</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Déjà payé</p>
              <p className="text-lg font-semibold text-brand-emerald">{student.total_paye.toLocaleString("fr-FR")} €</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Solde</p>
              <p className="text-lg font-semibold">{student.solde_restant.toLocaleString("fr-FR")} €</p>
            </div>
          </div>

          {/* Fee history header */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Historique des échéances</h3>
            {pendingFees.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => setConfirmBulk(true)}
                disabled={bulkProcessing}
              >
                <Check className="h-3 w-3 mr-1" />
                Tout solder
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
          ) : !fees || fees.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune échéance trouvée.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs uppercase text-muted-foreground">Échéance</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground text-right">Montant</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Statut</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fees.map((fee) => {
                    const cfg = FEE_STATUS_CONFIG[fee.status] ?? FEE_STATUS_CONFIG.pending;
                    return (
                      <TableRow key={fee.id}>
                        <TableCell className="py-2 text-sm">
                          {format(new Date(fee.due_date), "dd MMM yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell className="py-2 text-sm text-right font-semibold">
                          {Number(fee.amount).toLocaleString("fr-FR")} €
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge className={cfg.cls}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          {(fee.status === "pending" || fee.status === "overdue") && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-brand-emerald"
                                  onClick={() =>
                                    setConfirmFee({ id: fee.id, amount: Number(fee.amount), due_date: fee.due_date })
                                  }
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Encaisser</TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirm single encaissement */}
      <AlertDialog open={!!confirmFee} onOpenChange={(o) => !o && setConfirmFee(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'encaissement</AlertDialogTitle>
            <AlertDialogDescription>
              Valider le paiement de{" "}
              <strong>{confirmFee?.amount.toLocaleString("fr-FR")} €</strong> pour{" "}
              <strong>{student.prenom} {student.nom}</strong> ?
              <br />
              <span className="text-xs text-muted-foreground">
                Une transaction sera automatiquement créée dans le module Finance.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleEncaisser} disabled={encaisser.isPending}>
              {encaisser.isPending ? "Enregistrement…" : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm bulk encaissement */}
      <AlertDialog open={confirmBulk} onOpenChange={(o) => !o && setConfirmBulk(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Solder le compte</AlertDialogTitle>
            <AlertDialogDescription>
              Encaisser les <strong>{pendingFees.length} échéances</strong> restantes pour{" "}
              <strong>{student.prenom} {student.nom}</strong> ?
              <br />
              <span className="text-xs text-muted-foreground">
                Total : {pendingFees.reduce((s, f) => s + Number(f.amount), 0).toLocaleString("fr-FR")} € — {pendingFees.length} transactions seront créées.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkProcessing}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkEncaisser} disabled={bulkProcessing}>
              {bulkProcessing ? "Encaissement en cours…" : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ── Main Page ── */
export default function FraisScolaritePage() {
  const { data: students, isLoading } = useStudentFeesSummary();
  const { yearLabel } = useCurrentAcademicYear();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState<StudentFeeSummary | null>(null);

  /* Deduplicate by student_id (safety net if view returns duplicates) */
  const rows = useMemo(() => {
    const raw = students ?? [];
    const seen = new Map<string, StudentFeeSummary>();
    for (const r of raw) {
      if (!seen.has(r.student_id)) seen.set(r.student_id, r);
    }
    return Array.from(seen.values());
  }, [students]);

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.classe_nom) map.set(r.classe_nom, r.classe_nom);
    });
    return Array.from(map.values()).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (!`${r.prenom} ${r.nom}`.toLowerCase().includes(q)) return false;
      }
      if (classFilter !== "all" && r.classe_nom !== classFilter) return false;
      if (statusFilter !== "all") {
        const s = getGlobalStatus(r);
        if (s !== statusFilter) return false;
      }
      return true;
    });
  }, [rows, search, classFilter, statusFilter]);

  const kpis = useMemo(() => {
    const totalAnnuel = rows.reduce((s, r) => s + r.total_annuel, 0);
    const totalPaye = rows.reduce((s, r) => s + r.total_paye, 0);
    const soldeRestant = rows.reduce((s, r) => s + r.solde_restant, 0);
    const rate = totalAnnuel > 0 ? Math.round((totalPaye / totalAnnuel) * 100) : 0;
    const nbRetards = rows.filter((r) => r.nb_retards > 0).length;
    return { totalPaye, soldeRestant, rate, nbRetards };
  }, [rows]);

  const handleExport = () => {
    if (filtered.length === 0) return;
    const header = "Élève,Classe,Total Annuel,Payé,Solde,Statut";
    const csv = filtered.map((r) => {
      const status = getGlobalStatus(r);
      const label = GLOBAL_STATUS_CONFIG[status].label;
      return `"${r.prenom} ${r.nom}","${r.classe_nom ?? ""}",${r.total_annuel},${r.total_paye},${r.solde_restant},"${label}"`;
    });
    const blob = new Blob([header + "\n" + csv.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `frais-scolarite-${yearLabel ?? "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export CSV téléchargé ✓" });
  };

  const statItems: StatCardItem[] = [
    {
      label: "Total encaissé",
      value: isLoading ? "—" : `${kpis.totalPaye.toLocaleString("fr-FR")} €`,
      icon: Wallet,
      subValue: `${rows.filter((r) => r.solde_restant <= 0).length} comptes soldés`,
      color: "hsl(var(--brand-emerald))",
    },
    {
      label: "Reste à percevoir",
      value: isLoading ? "—" : `${kpis.soldeRestant.toLocaleString("fr-FR")} €`,
      icon: AlertCircle,
      subValue: `${rows.filter((r) => r.solde_restant > 0).length} comptes ouverts`,
      color: "hsl(var(--destructive))",
    },
    {
      label: "Taux de recouvrement",
      value: isLoading ? "—" : `${kpis.rate}%`,
      icon: TrendingUp,
      progress: kpis.rate,
      subValue: `sur ${rows.length} élèves`,
    },
    {
      label: "Relances à faire",
      value: isLoading ? "—" : kpis.nbRetards,
      icon: Mail,
      subValue: "élèves en retard",
      color: "hsl(var(--destructive))",
    },
  ];

  return (
    <TooltipProvider>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <Banknote className="h-5 w-5 text-brand-cyan" />
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-foreground">Frais de Scolarité</h1>
                <p className="text-sm text-muted-foreground">
                  Suivi des encaissements et relances{yearLabel ? ` — ${yearLabel}` : ""}
                </p>
              </div>
              <Badge variant="secondary" className="text-xs">{rows.length}</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-1.5" /> Exporter
            </Button>
          </div>

          {/* KPIs */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <StatCards items={statItems} />
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un élève…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Toutes les classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les classes</SelectItem>
                {classes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="solde">Soldé</SelectItem>
                <SelectItem value="en_attente">En attente</SelectItem>
                <SelectItem value="retard">Retard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title="Aucun compte élève trouvé"
              description="Aucun élève ne correspond à ces critères de recherche."
            />
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs uppercase text-muted-foreground min-w-[180px]">Élève</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Classe</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground text-right">Total annuel</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground text-right">Payé</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground text-right">Solde</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Statut</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const status = getGlobalStatus(row);
                    const cfg = GLOBAL_STATUS_CONFIG[status];
                    return (
                      <TableRow
                        key={row.student_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedStudent(row)}
                      >
                        <TableCell className="py-3">
                          <span className="text-sm font-semibold">{row.prenom} {row.nom}</span>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-muted-foreground">
                          {row.classe_nom ?? "—"}
                        </TableCell>
                        <TableCell className="py-3 text-right text-sm font-semibold">
                          {row.total_annuel.toLocaleString("fr-FR")} €
                        </TableCell>
                        <TableCell className="py-3 text-right text-sm">
                          <span className="text-brand-emerald font-semibold">
                            {row.total_paye.toLocaleString("fr-FR")} €
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-right text-sm font-bold">
                          {row.solde_restant.toLocaleString("fr-FR")} €
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge className={cfg.cls}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={(e) => { e.stopPropagation(); setSelectedStudent(row); }}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Voir le détail</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-brand-emerald"
                                  onClick={(e) => { e.stopPropagation(); setSelectedStudent(row); }}
                                >
                                  <Banknote className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Encaisser</TooltipContent>
                            </Tooltip>
                            {row.nb_retards > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toast({
                                        title: "Relance préparée",
                                        description: `Relance pour ${row.prenom} ${row.nom}.`,
                                      });
                                    }}
                                  >
                                    <Bell className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Relancer</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Detail Sheet */}
          <StudentFeeDetailSheet
            student={selectedStudent}
            open={!!selectedStudent}
            onOpenChange={(open) => { if (!open) setSelectedStudent(null); }}
          />
        </div>
      </main>
    </TooltipProvider>
  );
}