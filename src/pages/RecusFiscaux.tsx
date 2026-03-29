import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Receipt, Trash2, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const RecusFiscaux = () => {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();
  const [genOpen, setGenOpen] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState("");
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["tax_receipts", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("tax_receipts")
        .select("*, donor:donors!tax_receipts_donor_id_fkey(nom, prenom)")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: donors = [] } = useQuery({
    queryKey: ["donors_list", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase.from("donors").select("id, nom, prenom").eq("org_id", orgId).order("nom");
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-tax-receipt", {
        body: { donor_id: selectedDonor, annee_fiscale: parseInt(selectedYear), org_id: orgId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tax_receipts", orgId] });
      const total = data?.total_dons ?? 0;
      toast.success(`Reçu fiscal généré — Total dons: ${total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`);
      setGenOpen(false);
      setSelectedDonor("");
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur lors de la génération"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tax_receipts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tax_receipts", orgId] }); toast.success("Reçu supprimé"); },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <Receipt className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Reçus Fiscaux</h1>
        <Badge variant="secondary" className="ml-2">{receipts.length}</Badge>

        <div className="ml-auto">
          <Dialog open={genOpen} onOpenChange={setGenOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gradient-positive border-0"><FileText className="h-4 w-4 mr-2" />Générer un reçu</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Générer un Reçu Fiscal</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Donateur</Label>
                  <Select value={selectedDonor} onValueChange={setSelectedDonor}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un donateur" /></SelectTrigger>
                    <SelectContent>
                      {donors.map((d) => (<SelectItem key={d.id} value={d.id}>{d.nom} {d.prenom ?? ""}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Année fiscale</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{years.map((y) => (<SelectItem key={y} value={y}>{y}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setGenOpen(false)} className="text-muted-foreground">Annuler</Button>
                <Button className="gradient-positive border-0" onClick={() => generateMutation.mutate()} disabled={!selectedDonor || generateMutation.isPending}>
                  {generateMutation.isPending ? "Génération…" : "Générer le reçu CERFA"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : receipts.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">Aucun reçu fiscal généré</div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° CERFA</TableHead>
                <TableHead>Donateur</TableHead>
                <TableHead>Année</TableHead>
                <TableHead>Date de création</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.numero_cerfa ?? "—"}</TableCell>
                  <TableCell className="font-medium">{r.donor?.nom ?? "—"} {r.donor?.prenom ?? ""}</TableCell>
                  <TableCell><Badge variant="outline">{r.annee_fiscale}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString("fr-FR") : "—"}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce reçu ?</AlertDialogTitle>
                          <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="text-muted-foreground">Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
};

export default RecusFiscaux;
