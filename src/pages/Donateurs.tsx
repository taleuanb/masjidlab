import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Heart, Trash2, Search, Users, Mail, Eye, Pencil, MoreVertical,
  Plus, Download, DollarSign, TrendingUp, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { ViewSwitcher, type ViewMode } from "@/components/ui/ViewSwitcher";
import { StatCards, type StatCardItem } from "@/components/shared/StatCards";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";

interface Donor {
  id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  adresse_postale: string | null;
  created_at: string | null;
}

const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Donateurs = () => {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Donor | null>(null);
  const [form, setForm] = useState({ nom: "", prenom: "", email: "", adresse_postale: "" });

  const { data: donors = [], isLoading } = useQuery({
    queryKey: ["donors", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("donors")
        .select("*")
        .eq("org_id", orgId)
        .order("nom");
      if (error) throw error;
      return data as Donor[];
    },
    enabled: !!orgId,
  });

  const { data: donationTotals = {} } = useQuery({
    queryKey: ["donation_totals", orgId],
    queryFn: async () => {
      if (!orgId) return {};
      const { data, error } = await supabase
        .from("donations")
        .select("donor_id, montant")
        .eq("org_id", orgId);
      if (error) throw error;
      const totals: Record<string, number> = {};
      (data ?? []).forEach((d) => {
        if (d.donor_id) totals[d.donor_id] = (totals[d.donor_id] ?? 0) + Number(d.montant);
      });
      return totals;
    },
    enabled: !!orgId,
  });

  const { data: donationCount = 0 } = useQuery({
    queryKey: ["donation_count", orgId],
    queryFn: async () => {
      if (!orgId) return 0;
      const { count, error } = await supabase
        .from("donations")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!orgId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("donors").insert({
        nom: form.nom.trim(),
        prenom: form.prenom.trim() || null,
        email: form.email.trim() || null,
        adresse_postale: form.adresse_postale.trim() || null,
        org_id: orgId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["donors", orgId] });
      toast.success("Donateur ajouté");
      setAddOpen(false);
      setForm({ nom: "", prenom: "", email: "", adresse_postale: "" });
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("donors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["donors", orgId] });
      queryClient.invalidateQueries({ queryKey: ["donation_totals", orgId] });
      toast.success("Donateur supprimé");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const totalDons = useMemo(() => Object.values(donationTotals).reduce((s, v) => s + v, 0), [donationTotals]);
  const avgDon = donors.length > 0 ? totalDons / donors.length : 0;
  const topDonor = useMemo(() => {
    let max = 0;
    let name = "—";
    donors.forEach(d => {
      const t = donationTotals[d.id] ?? 0;
      if (t > max) { max = t; name = `${d.prenom ?? ""} ${d.nom}`.trim(); }
    });
    return { name, amount: max };
  }, [donors, donationTotals]);

  const filtered = useMemo(() => {
    return donors.filter(d => {
      const q = search.toLowerCase();
      if (q && !`${d.nom} ${d.prenom ?? ""} ${d.email ?? ""}`.toLowerCase().includes(q)) return false;
      if (quickFilter === "avec_dons" && !(donationTotals[d.id] > 0)) return false;
      if (quickFilter === "sans_dons" && (donationTotals[d.id] ?? 0) > 0) return false;
      return true;
    });
  }, [donors, search, quickFilter, donationTotals]);

  const getInitials = (nom: string, prenom: string | null) =>
    `${(prenom ?? "D").charAt(0)}${nom.charAt(0)}`.toUpperCase();

  const handleExport = () => {
    const header = "Nom,Prénom,Email,Total Dons (€)";
    const rows = filtered.map(d =>
      `"${d.nom}","${d.prenom ?? ""}","${d.email ?? ""}","${fmt(donationTotals[d.id] ?? 0)}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "donateurs.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  return (
    <TooltipProvider>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <Heart className="h-5 w-5 text-brand-emerald" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground">Donateurs</h1>
              <p className="text-sm text-muted-foreground">Annuaire des donateurs et suivi des contributions</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" /> Exporter
              </Button>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-1" /> Nouveau Donateur
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Ajouter un donateur</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Nom *</Label>
                        <Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Nom" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Prénom</Label>
                        <Input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} placeholder="Prénom" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemple.com" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Adresse postale</Label>
                      <Input value={form.adresse_postale} onChange={e => setForm(f => ({ ...f, adresse_postale: e.target.value }))} placeholder="Adresse" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setAddOpen(false)}>Annuler</Button>
                    <Button className="bg-primary text-primary-foreground" onClick={() => addMutation.mutate()} disabled={!form.nom.trim() || addMutation.isPending}>
                      {addMutation.isPending ? "Ajout…" : "Enregistrer"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* KPI Cards */}
          <StatCards items={[
            { label: "Total Donateurs", value: isLoading ? "—" : donors.length, icon: Users, subValue: `${filtered.length} affiché(s)` },
            { label: "Total Dons", value: isLoading ? "—" : `${fmt(totalDons)} €`, icon: Heart, subValue: `${donationCount} don(s) enregistré(s)` },
            { label: "Don Moyen / Donateur", value: isLoading ? "—" : `${fmt(avgDon)} €`, icon: TrendingUp, subValue: "moyenne par donateur" },
            { label: "Meilleur Donateur", value: isLoading ? "—" : topDonor.name, icon: DollarSign, subValue: topDonor.amount > 0 ? `${fmt(topDonor.amount)} €` : "—" },
          ]} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" />

          {/* Quick Filter Tabs */}
          <Tabs value={quickFilter} onValueChange={setQuickFilter}>
            <TabsList>
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="avec_dons">💚 Avec dons</TabsTrigger>
              <TabsTrigger value="sans_dons">⚫ Sans dons</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search & View */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par nom, prénom ou email…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>
            <ViewSwitcher viewMode={viewMode} onViewChange={setViewMode} className="shrink-0 ml-auto" />
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Heart}
              title={donors.length === 0 ? "Aucun donateur enregistré" : "Aucun donateur ne correspond à vos filtres"}
              description={donors.length === 0 ? "Cliquez sur « Nouveau Donateur » pour commencer à enrichir votre base." : "Essayez d'élargir vos critères de recherche."}
              action={donors.length === 0 ? <Button onClick={() => setAddOpen(true)} className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> Nouveau Donateur</Button> : undefined}
            />
          ) : (
            <AnimatePresence mode="wait">
              {viewMode === "list" && (
                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <div className="rounded-lg border overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow className="bg-muted/40">
                          <TableHead className="text-xs uppercase text-muted-foreground">Donateur</TableHead>
                          <TableHead className="hidden md:table-cell text-xs uppercase text-muted-foreground">Email</TableHead>
                          <TableHead className="hidden lg:table-cell text-xs uppercase text-muted-foreground">Adresse</TableHead>
                          <TableHead className="text-right text-xs uppercase text-muted-foreground">Total Dons</TableHead>
                          <TableHead className="text-xs uppercase text-muted-foreground">Statut</TableHead>
                          <TableHead className="text-right w-[130px] text-xs uppercase text-muted-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((d) => {
                          const total = donationTotals[d.id] ?? 0;
                          return (
                            <TableRow key={d.id} className="cursor-pointer hover:bg-muted/40 border-b">
                              <TableCell className="py-3">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8 bg-brand-emerald/10 text-brand-emerald shrink-0">
                                    <AvatarFallback className="text-xs font-semibold bg-brand-emerald/10 text-brand-emerald">
                                      {getInitials(d.nom, d.prenom)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-semibold text-sm">{d.prenom ?? ""} {d.nom}</span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell py-3">
                                {d.email ? (
                                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Mail className="h-3 w-3" />{d.email}</span>
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell py-3 text-sm text-muted-foreground">{d.adresse_postale ?? "—"}</TableCell>
                              <TableCell className="text-right py-3">
                                <span className="font-semibold text-sm text-brand-emerald tabular-nums">{fmt(total)} €</span>
                              </TableCell>
                              <TableCell className="py-3">
                                <Badge className={total > 0
                                  ? "bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30 text-[10px]"
                                  : "bg-muted text-muted-foreground border-border text-[10px]"
                                }>
                                  {total > 0 ? "Actif" : "Aucun don"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right py-3" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                  <Tooltip><TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => toast.info("Fiche donateur à venir")}>
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger><TooltipContent>Consulter</TooltipContent></Tooltip>
                                  <Tooltip><TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => toast.info("Modification à venir")}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger><TooltipContent>Modifier</TooltipContent></Tooltip>
                                  <Tooltip><TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => {
                                      if (d.email) { window.open(`mailto:${d.email}`); } else { toast.error("Aucun email renseigné"); }
                                    }}>
                                      <MessageSquare className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger><TooltipContent>Contacter</TooltipContent></Tooltip>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"><MoreVertical className="h-3.5 w-3.5" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                      <DropdownMenuItem onClick={() => toast.info("Reçu fiscal à venir")}>
                                        <Download className="h-3.5 w-3.5 mr-2" /> Générer reçu fiscal
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(d)}>
                                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer
                                      </DropdownMenuItem>
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
                </motion.div>
              )}

              {viewMode === "grid" && (
                <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map((d) => {
                      const total = donationTotals[d.id] ?? 0;
                      return (
                        <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                          <Card className="hover:shadow-md transition-shadow cursor-pointer">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3 mb-3">
                                <Avatar className="h-10 w-10 bg-brand-emerald/10 text-brand-emerald">
                                  <AvatarFallback className="text-sm font-semibold bg-brand-emerald/10 text-brand-emerald">
                                    {getInitials(d.nom, d.prenom)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-sm truncate">{d.prenom ?? ""} {d.nom}</p>
                                  <p className="text-xs text-muted-foreground truncate">{d.email ?? "Aucun email"}</p>
                                </div>
                                <Badge className={total > 0
                                  ? "bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30 text-[10px]"
                                  : "bg-muted text-muted-foreground border-border text-[10px]"
                                }>
                                  {total > 0 ? "Actif" : "—"}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t">
                                <span className="text-xs text-muted-foreground">Total dons</span>
                                <span className="font-semibold text-brand-emerald tabular-nums">{fmt(total)} €</span>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {viewMode === "board" && (
                <motion.div key="board" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <div className="flex gap-4 overflow-x-auto pb-4">
                    {[
                      { key: "actif", label: "Avec dons", items: filtered.filter(d => (donationTotals[d.id] ?? 0) > 0) },
                      { key: "inactif", label: "Sans dons", items: filtered.filter(d => !(donationTotals[d.id] > 0)) },
                    ].map(col => (
                      <div key={col.key} className="w-[320px] shrink-0 rounded-lg bg-muted/40 p-3">
                        <div className="flex items-center justify-between mb-3 border-b pb-2">
                          <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                          <Badge variant="secondary" className="text-xs">{col.items.length}</Badge>
                        </div>
                        <div className="space-y-2.5">
                          {col.items.map(d => (
                            <Card key={d.id} className="hover:shadow-sm transition-shadow">
                              <CardContent className="p-3">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-7 w-7 bg-brand-emerald/10 text-brand-emerald">
                                    <AvatarFallback className="text-[10px] font-semibold bg-brand-emerald/10 text-brand-emerald">{getInitials(d.nom, d.prenom)}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold truncate">{d.prenom ?? ""} {d.nom}</p>
                                  </div>
                                  <span className="text-xs font-semibold text-brand-emerald tabular-nums">{fmt(donationTotals[d.id] ?? 0)} €</span>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                          {col.items.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-4">Aucun donateur</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Delete Confirmation */}
          <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer ce donateur ?</AlertDialogTitle>
                <AlertDialogDescription>Cette action supprimera le donateur mais pas ses dons existants.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
    </TooltipProvider>
  );
};

export default Donateurs;
