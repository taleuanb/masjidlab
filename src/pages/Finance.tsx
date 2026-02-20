import React, { useState } from "react";
import { SidebarInset } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, TrendingUp, TrendingDown, Plus, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Transaction = {
  id: string;
  titre: string;
  montant: number;
  type: string | null;
  categorie: string | null;
  date_transaction: string | null;
  created_at: string | null;
};

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
      return data as Transaction[];
    },
    enabled: !!orgId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("finance_transactions").insert({
        titre: form.titre,
        montant: parseFloat(form.montant),
        type: form.type,
        categorie: form.categorie || null,
        org_id: orgId,
        created_by: user?.id,
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
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle transaction</DialogTitle>
            </DialogHeader>
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
              <Button className="w-full" onClick={() => addMutation.mutate()} disabled={!form.titre || !form.montant || addMutation.isPending}>
                {addMutation.isPending ? "Ajout…" : "Enregistrer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> Recettes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{totalRecettes.toLocaleString("fr-FR")} €</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" /> Dépenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{totalDepenses.toLocaleString("fr-FR")} €</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" /> Solde
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${solde >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {solde.toLocaleString("fr-FR")} €
            </p>
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
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{t.titre}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.date_transaction ? format(new Date(t.date_transaction), "dd MMM yyyy", { locale: fr }) : "—"}
                      {t.categorie && ` · ${t.categorie}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={t.type === "recette" ? "default" : "destructive"} className="text-xs">
                      {t.type === "recette" ? "Recette" : "Dépense"}
                    </Badge>
                    <span className={`text-sm font-semibold ${t.type === "recette" ? "text-emerald-600" : "text-red-600"}`}>
                      {t.type === "recette" ? "+" : "-"}{t.montant.toLocaleString("fr-FR")} €
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </SidebarInset>
  );
}
