import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ShieldCheck, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const contractBadgeVariant = (type: string) => {
  switch (type) {
    case "CDI": return "default" as const;
    case "CDD": return "secondary" as const;
    case "Vacataire": return "outline" as const;
    default: return "outline" as const;
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
    <main className="flex-1 p-6 space-y-4">
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
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Début</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Salaire</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.profile?.display_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.profile?.email ?? "—"}</TableCell>
                  <TableCell><Badge variant={contractBadgeVariant(c.type_contrat)}>{c.type_contrat}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{c.date_debut}</TableCell>
                  <TableCell className="text-muted-foreground">{c.date_fin ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.salaire_base ? `${c.salaire_base} €` : "—"}</TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce contrat ?</AlertDialogTitle>
                          <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

export default ContratsStaff;
