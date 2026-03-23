import { useState, useEffect } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const DEFAULT_TEMPLATE = `🕌 *Point Madrasa*
Voici le résumé de [PRENOM] en [MATIERE].
📈 *Avancée :* [POSITION]
[NOTES]

🗣️ *Mot du prof :* [REMARQUE]`;

export function CommunicationsTab() {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["madrasa_settings", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("madrasa_settings")
        .select("*")
        .eq("org_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [template, setTemplate] = useState("");

  useEffect(() => {
    if (settings) {
      setTemplate((settings as Record<string, unknown>)["whatsapp_session_template"] as string ?? DEFAULT_TEMPLATE);
    }
  }, [settings]);

  const upsert = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("madrasa_settings")
        .upsert(
          { org_id: orgId!, whatsapp_session_template: template } as Record<string, unknown>,
          { onConflict: "org_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["madrasa_settings", orgId] });
      toast({ title: "Modèle enregistré" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin mx-auto mt-8 text-muted-foreground" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5" /> Modèle de compte-rendu WhatsApp
        </CardTitle>
        <CardDescription>
          Personnalisez le message envoyé aux parents après chaque séance de suivi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Template du message</Label>
          <Textarea
            className="min-h-[180px] font-mono text-sm"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder={DEFAULT_TEMPLATE}
          />
        </div>
        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Variables disponibles :</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li><code className="bg-muted px-1 rounded">[PRENOM]</code> — Prénom de l'élève</li>
            <li><code className="bg-muted px-1 rounded">[MATIERE]</code> — Nom de la matière</li>
            <li><code className="bg-muted px-1 rounded">[POSITION]</code> — Position actuelle (avec unité)</li>
            <li><code className="bg-muted px-1 rounded">[NOTES]</code> — Notes étoilées (auto-formatées)</li>
            <li><code className="bg-muted px-1 rounded">[REMARQUE]</code> — Commentaires du professeur</li>
          </ul>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export const WA_DEFAULT_TEMPLATE = DEFAULT_TEMPLATE;
