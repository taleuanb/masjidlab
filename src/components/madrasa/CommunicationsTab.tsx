import { useState, useEffect, useRef, useMemo } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const VARIABLES = [
  { tag: "[PRENOM]", label: "Prénom", preview: "Samy" },
  { tag: "[MATIERE]", label: "Matière", preview: "Arabe" },
  { tag: "[POSITION]", label: "Position", preview: "18 Versets" },
  { tag: "[NOTES]", label: "Notes", preview: "⭐ Mémorisation : 5/5" },
  { tag: "[REMARQUE]", label: "Remarque", preview: "Excellent travail !" },
] as const;

function buildPreview(tpl: string): string {
  let msg = tpl;
  for (const v of VARIABLES) {
    msg = msg.replace(new RegExp(v.tag.replace(/[[\]]/g, "\\$&"), "g"), v.preview);
  }
  return msg;
}

export function CommunicationsTab() {
  const { orgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const preview = useMemo(() => buildPreview(template || DEFAULT_TEMPLATE), [template]);

  const insertTag = (tag: string) => {
    const el = textareaRef.current;
    if (!el) {
      setTemplate((prev) => prev + tag);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = template.slice(0, start);
    const after = template.slice(end);
    const next = before + tag + after;
    setTemplate(next);
    // Restore cursor position after the inserted tag
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + tag.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const upsert = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { org_id: orgId!, whatsapp_session_template: template };
      const { error } = await (supabase.from("madrasa_settings") as any).upsert(payload, { onConflict: "org_id" });
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
          Personnalisez le message envoyé aux parents. Cliquez sur une variable pour l'insérer à la position du curseur.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Click-to-insert badges */}
        <div className="flex flex-wrap gap-2">
          {VARIABLES.map((v) => (
            <Badge
              key={v.tag}
              variant="outline"
              className="cursor-pointer hover:bg-accent transition-colors font-mono text-xs"
              onClick={() => insertTag(v.tag)}
            >
              {v.tag}
            </Badge>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Textarea editor */}
          <div className="space-y-2">
            <Label>Template du message</Label>
            <Textarea
              ref={textareaRef}
              className="min-h-[220px] font-mono text-sm"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder={DEFAULT_TEMPLATE}
            />
          </div>

          {/* Live preview as WhatsApp bubble */}
          <div className="space-y-2">
            <Label>Aperçu live</Label>
            <div className="rounded-r-xl rounded-bl-xl bg-[#DCF8C6] p-4 text-sm whitespace-pre-wrap shadow-sm border border-[#b5e2a0] min-h-[220px]">
              {preview}
            </div>
          </div>
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
