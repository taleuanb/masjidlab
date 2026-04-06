import { useState, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Wallet, TrendingUp, AlertCircle, Mail, Search, Check,
  Eye, Banknote, MessageSquare, MoreVertical,
} from "lucide-react";
import { useMadrasaFees, type FeeRow } from "@/hooks/useMadrasaFees";
import { useCurrentAcademicYear } from "@/hooks/useCurrentAcademicYear";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCards, type StatCardItem } from "@/components/shared/StatCards";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  paid: { label: "Payé", cls: "bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30 text-[10px] px-2 py-0.5" },
  pending: { label: "En attente", cls: "bg-amber-100 text-amber-700 border-amber-300 text-[10px] px-2 py-0.5" },
  overdue: { label: "Retard", cls: "bg-destructive/15 text-destructive border-destructive/30 text-[10px] px-2 py-0.5" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return <Badge className={cfg.cls}>{cfg.label}</Badge>;
}

export default function FraisScolaritePage() {
  const { fees, isLoading, encaisser } = useMadrasaFees();
  const { yearLabel } = useCurrentAcademicYear();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [confirmFee, setConfirmFee] = useState<FeeRow | null>(null);
  const [quickFilter, setQuickFilter] = useState("all");

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    fees.forEach((f) => {
      if (f.class_id && f.class_nom) map.set(f.class_id, f.class_nom);
    });
    return Array.from(map, ([id, nom]) => ({ id, nom }));
  }, [fees]);

  const filtered = useMemo(() => {
    return fees.filter((f) => {
      if (quickFilter !== "all" && f.status !== quickFilter) return false;
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (classFilter !== "all" && f.class_id !== classFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const fullName = `${f.student_prenom} ${f.student_nom}`.toLowerCase();
        if (!fullName.includes(q)) return false;
      }
      return true;
    });
  }, [fees, quickFilter, statusFilter, classFilter, search]);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const kpis = useMemo(() => {
    const paidThisMonth = fees
      .filter((f) => f.status === "paid")
      .filter((f) => {
        const d = new Date(f.due_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((s, f) => s + f.amount, 0);

    const pending = fees
      .filter((f) => f.status === "pending" || f.status === "overdue")
      .reduce((s, f) => s + f.amount, 0);

    const total = fees.reduce((s, f) => s + f.amount, 0);
    const rate = total > 0 ? Math.round(((total - pending) / total) * 100) : 0;

    const overdueCount = fees.filter((f) => f.status === "overdue").length;

    return { paidThisMonth, pending, rate, overdueCount };
  }, [fees, currentMonth, currentYear]);

  const handleEncaisser = () => {
    if (!confirmFee) return;
    encaisser.mutate({
      feeId: confirmFee.id,
      amount: confirmFee.amount,
      studentNom: confirmFee.student_nom,
      studentPrenom: confirmFee.student_prenom,
      dueDate: confirmFee.due_date,
    });
    setConfirmFee(null);
  };

  const handleRelance = (fee: FeeRow) => {
    toast({
      title: "Relance préparée",
      description: `Un email de relance sera envoyé pour ${fee.student_prenom} ${fee.student_nom}.`,
    });
  };

  const statItems: StatCardItem[] = [
    {
      label: "Encaissement mensuel",
      value: isLoading ? "—" : `${kpis.paidThisMonth.toLocaleString("fr-FR")} €`,
      icon: Wallet,
      subValue: format(now, "MMMM yyyy", { locale: fr }),
      color: "hsl(var(--brand-emerald))",
    },
    {
      label: "Reste à percevoir",
      value: isLoading ? "—" : `${kpis.pending.toLocaleString("fr-FR")} €`,
      icon: AlertCircle,
      subValue: `${fees.filter((f) => f.status === "pending" || f.status === "overdue").length} frais en attente`,
      color: "hsl(var(--destructive))",
    },
    {
      label: "Taux de recouvrement",
      value: isLoading ? "—" : `${kpis.rate}%`,
      icon: TrendingUp,
      progress: kpis.rate,
      subValue: `${fees.filter((f) => f.status === "paid").length} / ${fees.length} payés`,
    },
    {
      label: "Relances à faire",
      value: isLoading ? "—" : kpis.overdueCount,
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
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <Banknote className="h-5 w-5 text-brand-cyan" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground">Frais de Scolarité</h1>
              <p className="text-sm text-muted-foreground">
                Suivi des encaissements et relances{yearLabel ? ` — ${yearLabel}` : ""}
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">{fees.length}</Badge>
          </div>

          {/* KPIs */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : (
            <StatCards items={statItems} />
          )}

          {/* Quick Filter Tabs */}
          <Tabs value={quickFilter} onValueChange={setQuickFilter}>
            <TabsList>
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="paid">🟢 Payés</TabsTrigger>
              <TabsTrigger value="pending">🟡 En attente</TabsTrigger>
              <TabsTrigger value="overdue">🔴 Retard</TabsTrigger>
            </TabsList>
          </Tabs>

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
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="paid">Payé</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="overdue">Retard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title="Aucun frais trouvé"
              description="Aucun frais ne correspond à ces critères de recherche."
            />
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs uppercase text-muted-foreground min-w-[180px]">Élève</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Classe</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground text-right">Montant</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Échéance</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground">Statut</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((fee) => (
                    <TableRow key={fee.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="py-3">
                        <span className="text-sm font-semibold">
                          {fee.student_prenom} {fee.student_nom}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        {fee.class_nom ?? "—"}
                      </TableCell>
                      <TableCell className="py-3 text-right text-sm font-semibold">
                        {fee.amount.toLocaleString("fr-FR")} €
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        {format(new Date(fee.due_date), "dd MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell className="py-3">
                        <StatusBadge status={fee.status} />
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Détail famille</TooltipContent>
                          </Tooltip>

                          {(fee.status === "pending" || fee.status === "overdue") && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-brand-emerald"
                                  onClick={(e) => { e.stopPropagation(); setConfirmFee(fee); }}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Encaisser</TooltipContent>
                            </Tooltip>
                          )}

                          {fee.status === "overdue" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive"
                                  onClick={(e) => { e.stopPropagation(); handleRelance(fee); }}
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Relancer</TooltipContent>
                            </Tooltip>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleRelance(fee)}>
                                <Mail className="h-4 w-4 mr-2" /> Envoyer relance email
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Confirm encaissement dialog */}
          <AlertDialog open={!!confirmFee} onOpenChange={(open) => !open && setConfirmFee(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer l'encaissement</AlertDialogTitle>
                <AlertDialogDescription>
                  Valider le paiement de{" "}
                  <strong>{confirmFee?.amount.toLocaleString("fr-FR")} €</strong> pour{" "}
                  <strong>{confirmFee?.student_prenom} {confirmFee?.student_nom}</strong> ?
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
        </div>
      </main>
    </TooltipProvider>
  );
}
