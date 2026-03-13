import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Banknote, TrendingUp, Clock, AlertTriangle, Check, Mail, Search,
} from "lucide-react";
import { useMadrasaFees, type FeeRow } from "@/hooks/useMadrasaFees";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  paid: { label: "Payé", cls: "bg-secondary text-secondary-foreground" },
  pending: { label: "En attente", cls: "bg-primary text-primary-foreground" },
  overdue: { label: "Retard", cls: "bg-destructive text-destructive-foreground" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return <Badge className={cfg.cls}>{cfg.label}</Badge>;
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 rounded-lg" />
      ))}
    </div>
  );
}

export default function FraisScolaritePage() {
  const { fees, isLoading, encaisser } = useMadrasaFees();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [confirmFee, setConfirmFee] = useState<FeeRow | null>(null);

  // Unique classes for filter
  const classes = useMemo(() => {
    const map = new Map<string, string>();
    fees.forEach((f) => {
      if (f.class_id && f.class_nom) map.set(f.class_id, f.class_nom);
    });
    return Array.from(map, ([id, nom]) => ({ id, nom }));
  }, [fees]);

  // Filtered rows
  const filtered = useMemo(() => {
    return fees.filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (classFilter !== "all" && f.class_id !== classFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const fullName = `${f.student_prenom} ${f.student_nom}`.toLowerCase();
        if (!fullName.includes(q)) return false;
      }
      return true;
    });
  }, [fees, statusFilter, classFilter, search]);

  // KPIs
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

    return { paidThisMonth, pending, rate };
  }, [fees, currentMonth, currentYear]);

  const handleEncaisser = () => {
    if (!confirmFee) return;
    encaisser.mutate({ feeId: confirmFee.id, amount: confirmFee.amount });
    setConfirmFee(null);
  };

  const handleRelance = (fee: FeeRow) => {
    toast({
      title: "Relance préparée",
      description: `Un email de relance sera envoyé pour ${fee.student_prenom} ${fee.student_nom}.`,
    });
  };

  return (
    <main className="flex-1 overflow-auto">
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Frais de Scolarité</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suivi des encaissements et relances
          </p>
        </div>

        {/* KPIs */}
        {isLoading ? (
          <KpiSkeleton />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-0 shadow-sm bg-gradient-to-br from-secondary/10 to-secondary/5">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Encaissé ce mois
                    </span>
                    <Banknote className="h-4 w-4 text-secondary" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {kpis.paidThisMonth.toLocaleString("fr-FR")} €
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card className="border-0 shadow-sm bg-gradient-to-br from-destructive/10 to-destructive/5">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Reste à percevoir
                    </span>
                    <Clock className="h-4 w-4 text-destructive" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {kpis.pending.toLocaleString("fr-FR")} €
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="border-0 shadow-sm bg-gradient-to-br from-accent/10 to-secondary/5">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Taux de recouvrement
                    </span>
                    <TrendingUp className="h-4 w-4 text-accent" />
                  </div>
                  <p className="text-2xl font-bold text-foreground mb-2">{kpis.rate}%</p>
                  <Progress value={kpis.rate} className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-accent [&>div]:to-secondary" />
                </CardContent>
              </Card>
            </motion.div>
          </div>
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="paid">Payé</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="overdue">Retard</SelectItem>
            </SelectContent>
          </Select>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Classe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <Card className="border border-dashed">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucun frais trouvé pour ces critères.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px] sticky left-0 bg-card z-10">Élève</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead className="sticky right-0 bg-card z-10">Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell className="font-medium sticky left-0 bg-card z-10">
                      {fee.student_prenom} {fee.student_nom}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fee.class_nom ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {fee.amount.toLocaleString("fr-FR")} €
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(fee.due_date), "dd MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell className="sticky right-0 bg-card z-10">
                      <StatusBadge status={fee.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(fee.status === "pending" || fee.status === "overdue") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => setConfirmFee(fee)}
                          >
                            <Check className="h-3 w-3" />
                            Encaisser
                          </Button>
                        )}
                        {fee.status === "overdue" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive"
                            onClick={() => handleRelance(fee)}
                            title="Relancer"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                        )}
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
  );
}
