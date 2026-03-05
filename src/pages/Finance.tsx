import React, { useState } from "react";
import { SidebarInset } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, TrendingUp, TrendingDown, Plus, CreditCard, Heart, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FinancePage() {
  const { orgId } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ titre: "", montant: "", type: "recette", categorie: "" });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["finance_transactions", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_transactions")
        .select("id, titre, montant, type, categorie, date_transaction, created_at")
        .eq("org_id", orgId!)
        .order("date_transaction", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: donorsCount = 0 } = useQuery({
    queryKey: ["donors_count", orgId],
    queryFn: async () => {
      const { count, error } = await supabase.from("donors").select("id", { count: "exact", head: true }).eq("org_id", orgId!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!orgId,
  });

  const { data: totalDons = 0 } = useQuery({
    queryKey: ["donations_total", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("donations").select("montant").eq("org_id", orgId!);
      if (error) throw error;
      return (data ?? []).reduce((s, d) => s + Number(d.montant), 0);
    },
    enabled: !!orgId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("finance_transactions").insert({
        titre: form.titre, montant: parseFloat(form.montant), type: form.type,
        categorie: form.categorie || null, org_id: orgId, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance_transactions", orgId] });
      toast.success("Transaction ajoutée");
      setDialogOpen(false);
      setForm({ titre: "", montant: "", type: "recette", categorie: "" });
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const totalRecettes = transactions.filter((t) => t.type === "recette").reduce((s, t) => s + t.montant, 0);
  const totalDepenses = transactions.filter((t) => t.type === "depense").reduce((s, t) => s + t.montant, 0);
  const solde = totalRecettes - totalDepenses;

  return (
    <SidebarInset className="flex-1 p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finance & Récoltes</h1>
          <p className="text-sm text-muted-foreground">Suivi des recettes, dépenses et dons</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-positive border-0"><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle transaction</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Titre</Label>
                <Input value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))} placeholder="Ex: Don Ramadan" />
              </div>
              <div className="space-y-1.5">
                <Label>Montant (€)</Label>
                <Input type="number" value={form.montant} onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recette">Recette / Don</SelectItem>
                    <SelectItem value="depense">Dépense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie (optionnel)</Label>
                <Input value={form.categorie} onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))} placeholder="Ex: Fournitures" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-muted-foreground">Annuler</Button>
              <Button className="gradient-positive border-0" onClick={() => addMutation.mutate()} disabled={!form.titre || !form.montant || addMutation.isPending}>
                {addMutation.isPending ? "Ajout…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dashboard Stats — Navy-Emerald gradient cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="overflow-hidden">
          <div className="h-1 gradient-finance" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Heart className="h-3.5 w-3.5 text-secondary" /> Total Dons
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-xl font-bold text-secondary">{fmt(totalDons)} €</p></CardContent>
        </Card>
        <Card className="overflow-hidden">
          <div className="h-1 gradient-finance" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-primary" /> Donateurs
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-xl font-bold text-primary">{donorsCount}</p></CardContent>
        </Card>
        <Card className="overflow-hidden">
          <div className="h-1 gradient-finance" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-secondary" /> Recettes
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-xl font-bold text-secondary">{fmt(totalRecettes)} €</p></CardContent>
        </Card>
        <Card className="overflow-hidden">
          <div className="h-1 bg-destructive/50" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-3.5 w-3.5 text-destructive" /> Dépenses
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-xl font-bold text-destructive">{fmt(totalDepenses)} €</p></CardContent>
        </Card>
        <Card className="overflow-hidden">
          <div className="h-1 gradient-finance" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5 text-primary" /> Solde
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${solde >= 0 ? "text-secondary" : "text-destructive"}`}>{fmt(solde)} €</p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Historique des transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune transaction enregistrée.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{t.titre}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.date_transaction ? format(new Date(t.date_transaction), "dd MMM yyyy", { locale: fr }) : "—"}
                      {t.categorie && ` · ${t.categorie}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={t.type === "recette" ? "default" : "destructive"} className={t.type === "recette" ? "badge-actif" : ""}>
                      {t.type === "recette" ? "Recette" : "Dépense"}
                    </Badge>
                    <span className={`text-sm font-semibold tabular-nums ${t.type === "recette" ? "text-secondary" : "text-destructive"}`}>
                      {t.type === "recette" ? "+" : "-"}{fmt(t.montant)} €
                    </span>
                  </div>
                </div>
              ))
            </div>
          )}
        </CardContent>
      </Card>
    </SidebarInset>
  );
}
