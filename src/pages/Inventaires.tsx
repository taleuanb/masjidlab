import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Package, Search, Plus, Eye, Pencil, MoreVertical, Trash2, Download,
  CheckCircle2, AlertTriangle, Wrench, MessageSquare, BoxIcon,
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
import { StatCards } from "@/components/shared/StatCards";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";

interface Asset {
  id: string;
  nom: string;
  type: string;
  statut: string;
  description: string | null;
  created_at: string;
}

const STATUT_CFG: Record<string, { label: string; cls: string }> = {
  Disponible: { label: "Disponible", cls: "bg-brand-emerald/15 text-brand-emerald border-brand-emerald/30" },
  "En maintenance": { label: "Maintenance", cls: "bg-amber-100 text-amber-700 border-amber-300" },
  "Hors service": { label: "Hors service", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  Réservé: { label: "Réservé", cls: "bg-brand-cyan/15 text-brand-cyan border-brand-cyan/30" },
};

const TYPE_ICONS: Record<string, string> = {
  "Sono": "🔊",
  "Mobilier": "🪑",
  "Électronique": "💻",
  "Nettoyage": "🧹",
  "Cuisine": "🍳",
  "Autre": "📦",
};

const Inventaires = () => {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [form, setForm] = useState({ nom: "", type: "Mobilier", description: "", statut: "Disponible" });

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["assets", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("assets")
        .select("id, nom, type, statut, description, created_at")
        .eq("org_id", orgId)
        .order("nom");
      if (error) throw error;
      return data as Asset[];
    },
    enabled: !!orgId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("assets").insert({
        nom: form.nom.trim(),
        type: form.type,
        description: form.description.trim() || null,
        statut: form.statut,
        org_id: orgId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets", orgId] });
      toast.success("Équipement ajouté");
      setAddOpen(false);
      setForm({ nom: "", type: "Mobilier", description: "", statut: "Disponible" });
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets", orgId] });
      toast.success("Équipement supprimé");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const types = useMemo(() => [...new Set(assets.map(a => a.type))].sort(), [assets]);
  const disponibles = assets.filter(a => a.statut === "Disponible").length;
  const enMaintenance = assets.filter(a => a.statut === "En maintenance").length;
  const horsService = assets.filter(a => a.statut === "Hors service").length;

  const filtered = useMemo(() => {
    return assets.filter(a => {
      const q = search.toLowerCase();
      if (q && !`${a.nom} ${a.type} ${a.description ?? ""}`.toLowerCase().includes(q)) return false;
      if (quickFilter === "disponible" && a.statut !== "Disponible") return false;
      if (quickFilter === "maintenance" && a.statut !== "En maintenance") return false;
      if (quickFilter === "hors_service" && a.statut !== "Hors service") return false;
      if (filterType !== "all" && a.type !== filterType) return false;
      return true;
    });
  }, [assets, search, quickFilter, filterType]);

  const handleExport = () => {
    const header = "Nom,Type,Statut,Description";
    const rows = filtered.map(a =>
      `"${a.nom}","${a.type}","${a.statut}","${a.description ?? ""}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "inventaire.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  const getStatusCfg = (statut: string) => STATUT_CFG[statut] ?? { label: statut, cls: "bg-muted text-muted-foreground border-border" };

  return (
    <TooltipProvider>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <Package className="h-5 w-5 text-brand-cyan" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground">Inventaire</h1>
              <p className="text-sm text-muted-foreground">Gestion du matériel et des équipements</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" /> Exporter
              </Button>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-1" /> Nouvel Équipement
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Ajouter un équipement</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <Label>Nom *</Label>
                      <Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: Sono portable" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Type</Label>
                        <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Mobilier", "Sono", "Électronique", "Nettoyage", "Cuisine", "Autre"].map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Statut</Label>
                        <Select value={form.statut} onValueChange={v => setForm(f => ({ ...f, statut: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUT_CFG).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Description</Label>
                      <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optionnel)" />
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
            { label: "Total Équipements", value: isLoading ? "—" : assets.length, icon: Package, subValue: `${filtered.length} affiché(s)` },
            { label: "Disponibles", value: isLoading ? "—" : disponibles, icon: CheckCircle2, subValue: `${assets.length > 0 ? Math.round((disponibles / assets.length) * 100) : 0}% du parc` },
            { label: "En Maintenance", value: isLoading ? "—" : enMaintenance, icon: Wrench, subValue: "en cours de réparation" },
            { label: "Hors Service", value: isLoading ? "—" : horsService, icon: AlertTriangle, subValue: "à remplacer" },
          ]} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" />

          {/* Quick Filter Tabs */}
          <Tabs value={quickFilter} onValueChange={setQuickFilter}>
            <TabsList>
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="disponible">🟢 Disponibles</TabsTrigger>
              <TabsTrigger value="maintenance">🟡 Maintenance</TabsTrigger>
              <TabsTrigger value="hors_service">🔴 Hors service</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par nom, type…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <ViewSwitcher viewMode={viewMode} onViewChange={setViewMode} className="shrink-0 ml-auto" />
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title={assets.length === 0 ? "Aucun équipement enregistré" : "Aucun équipement ne correspond à vos filtres"}
              description={assets.length === 0 ? "Cliquez sur « Nouvel Équipement » pour commencer à enrichir votre inventaire." : "Essayez d'élargir vos critères de recherche."}
              action={assets.length === 0 ? <Button onClick={() => setAddOpen(true)} className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" /> Nouvel Équipement</Button> : undefined}
            />
          ) : (
            <AnimatePresence mode="wait">
              {viewMode === "list" && (
                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <div className="rounded-lg border overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow className="bg-muted/40">
                          <TableHead className="text-xs uppercase text-muted-foreground">Équipement</TableHead>
                          <TableHead className="text-xs uppercase text-muted-foreground">Type</TableHead>
                          <TableHead className="hidden md:table-cell text-xs uppercase text-muted-foreground">Description</TableHead>
                          <TableHead className="text-xs uppercase text-muted-foreground">Statut</TableHead>
                          <TableHead className="text-right w-[130px] text-xs uppercase text-muted-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((a) => {
                          const cfg = getStatusCfg(a.statut);
                          const icon = TYPE_ICONS[a.type] ?? "📦";
                          return (
                            <TableRow key={a.id} className="cursor-pointer hover:bg-muted/40 border-b">
                              <TableCell className="py-3">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8 bg-brand-cyan/10 text-brand-cyan shrink-0">
                                    <AvatarFallback className="text-sm bg-brand-cyan/10">{icon}</AvatarFallback>
                                  </Avatar>
                                  <span className="font-semibold text-sm">{a.nom}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-3">
                                <Badge variant="outline" className="text-[10px] font-normal">{a.type}</Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell py-3 text-sm text-muted-foreground max-w-[250px] truncate">{a.description ?? "—"}</TableCell>
                              <TableCell className="py-3">
                                <Badge className={`${cfg.cls} text-[10px]`}>{cfg.label}</Badge>
                              </TableCell>
                              <TableCell className="text-right py-3" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                  <Tooltip><TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => toast.info("Fiche équipement à venir")}>
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger><TooltipContent>Consulter</TooltipContent></Tooltip>
                                  <Tooltip><TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => toast.info("Modification à venir")}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger><TooltipContent>Modifier</TooltipContent></Tooltip>
                                  <Tooltip><TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => toast.info("Signalement à venir")}>
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger><TooltipContent>Signaler un problème</TooltipContent></Tooltip>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"><MoreVertical className="h-3.5 w-3.5" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                      <DropdownMenuItem onClick={() => toast.info("Réservation à venir")}>
                                        <BoxIcon className="h-3.5 w-3.5 mr-2" /> Réserver
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(a)}>
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
                    {filtered.map((a) => {
                      const cfg = getStatusCfg(a.statut);
                      const icon = TYPE_ICONS[a.type] ?? "📦";
                      return (
                        <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                          <Card className="hover:shadow-md transition-shadow cursor-pointer">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3 mb-3">
                                <Avatar className="h-10 w-10 bg-brand-cyan/10">
                                  <AvatarFallback className="text-lg bg-brand-cyan/10">{icon}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-sm truncate">{a.nom}</p>
                                  <p className="text-xs text-muted-foreground">{a.type}</p>
                                </div>
                                <Badge className={`${cfg.cls} text-[10px]`}>{cfg.label}</Badge>
                              </div>
                              {a.description && <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>}
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
                      { key: "Disponible", label: "🟢 Disponibles" },
                      { key: "Réservé", label: "🔵 Réservés" },
                      { key: "En maintenance", label: "🟡 Maintenance" },
                      { key: "Hors service", label: "🔴 Hors service" },
                    ].map(col => {
                      const items = filtered.filter(a => a.statut === col.key);
                      return (
                        <div key={col.key} className="w-[280px] shrink-0 rounded-lg bg-muted/40 p-3">
                          <div className="flex items-center justify-between mb-3 border-b pb-2">
                            <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                            <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                          </div>
                          <div className="space-y-2">
                            {items.map(a => (
                              <Card key={a.id} className="hover:shadow-sm transition-shadow">
                                <CardContent className="p-3">
                                  <p className="text-xs font-semibold truncate">{a.nom}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{a.type}</p>
                                </CardContent>
                              </Card>
                            ))}
                            {items.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-4">Aucun équipement</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Delete Confirmation */}
          <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cet équipement ?</AlertDialogTitle>
                <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
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

export default Inventaires;
