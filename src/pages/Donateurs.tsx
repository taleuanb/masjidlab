import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Heart, Trash2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Donateurs = () => {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();

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
      return data;
    },
    enabled: !!orgId,
  });

  // Get donation totals per donor
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("donors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["donors", orgId] });
      toast.success("Donateur supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <Heart className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Donateurs</h1>
        <Badge variant="secondary" className="ml-auto">{donors.length} donateur(s)</Badge>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : donors.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">Aucun donateur enregistré</div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Prénom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Total dons</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {donors.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.nom}</TableCell>
                  <TableCell>{d.prenom ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.email ? (
                      <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{d.email}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-emerald-600">
                    {fmt(donationTotals[d.id] ?? 0)} €
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
                          <AlertDialogTitle>Supprimer ce donateur ?</AlertDialogTitle>
                          <AlertDialogDescription>Cette action supprimera le donateur mais pas ses dons existants.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(d.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

export default Donateurs;
