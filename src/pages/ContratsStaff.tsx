import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ShieldCheck, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const contractBadgeClass = (type: string) => {
  switch (type) {
    case "CDI": return "badge-contrat-cdi";
    case "CDD": return "badge-contrat-cdd";
    case "Vacataire": return "badge-contrat-vacataire";
    default: return "badge-contrat-benevole";
  }
};

const ContratsStaff = () => {
  const { orgId } = useOrganization();
  const queryClient = useQueryClient();

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["staff_contracts", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("staff_contracts")
        .select("*, profile:profiles!staff_contracts_profile_id_fkey(display_name, email)")
        .eq("org_id", orgId)
        .order("date_debut", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff_contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff_contracts", orgId] });
      toast.success("Contrat supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  return (
    <main className="flex-1 p-6 space-y-5">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Contrats Staff</h1>
        <Badge variant="secondary" className="ml-auto">{contracts.length} contrat(s)</Badge>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : contracts.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">Aucun contrat enregistré</div>
      ) : (
        <div className="space-y-3">
          {contracts.map((c: any) => (
            <Card key={c.id} className="overflow-hidden">
              {/* Navy header — Prestige */}
              <CardHeader className="header-navy py-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{c.profile?.display_name ?? "—"}</p>
                    <p className="text-[11px] opacity-70">{c.profile?.email ?? "—"}</p>
                  </div>
                  <Badge className={contractBadgeClass(c.type_contrat)}>
                    {c.type_contrat}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Début</p>
                    <p className="font-medium">{c.date_debut}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Fin</p>
                    <p className="font-medium">{c.date_fin ?? "Indéterminé"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Rémunération</p>
                    <p className="font-medium">{c.salaire_base ? `${c.salaire_base} €` : "—"}</p>
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce contrat ?</AlertDialogTitle>
                        <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="text-muted-foreground">Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
};

export default ContratsStaff;
