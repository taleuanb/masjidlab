import { useState, useEffect, useRef, useMemo } from "react";
import { Loader2, MessageCircle, AlertTriangle, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const DEFAULT_TEMPLATE = `🕌 *Point Madrasa*
Voici le résumé de [PRENOM] en [MATIERE].
📈 *Avancée :* [POSITION]
[NOTES]

🗣️ *Mot du prof :* [REMARQUE]`;

const DEFAULT_ABSENCE_TEMPLATE = `⚠️ *Absence remarquée*
As-salamu alaykum, nous avons noté l'absence de [PRENOM] aujourd'hui ([DATE]).
S'il s'agit d'un oubli ou d'un retard, merci de nous en informer.

La Direction.`;

const DEFAULT_SESSION_REPORT = `📚 *BILAN DE SÉANCE - {nom_classe}*
📅 Date : {date}
👨‍🏫 Prof : {prof}
✅ Présence : {presents}

📝 *Résumé du jour :*
{bilan_collectif}

--------------------------
🔗 Retrouvez le détail individuel sur votre espace parent.`;

const VARIABLES = [
  { tag: "[PRENOM]", label: "Prénom", preview: "Samy" },
  { tag: "[MATIERE]", label: "Matière", preview: "Arabe" },
  { tag: "[POSITION]", label: "Position", preview: "18 Versets" },
  { tag: "[NOTES]", label: "Notes", preview: "⭐ Mémorisation : 5/5" },
  { tag: "[REMARQUE]", label: "Remarque", preview: "Excellent travail !" },
] as const;

const ABSENCE_VARIABLES = [
  { tag: "[PRENOM]", label: "Prénom", preview: "Samy" },
  { tag: "[DATE]", label: "Date", preview: "24 mars 2026" },
] as const;

const SESSION_REPORT_VARIABLES = [
  { tag: "{nom_classe}", label: "Nom classe", preview: "CE1 - Coran" },
  { tag: "{date}", label: "Date", preview: "26 mars 2026" },
  { tag: "{prof}", label: "Professeur", preview: "Oustaz Karim" },
  { tag: "{presents}", label: "Présents", preview: "12/14 élèves" },
  { tag: "{bilan_collectif}", label: "Bilan collectif", preview: "Révision de la sourate Al-Mulk, versets 1 à 10. Bonne participation générale." },
] as const;

function buildPreview(tpl: string, vars: readonly { tag: string; preview: string }[]): string {
  let msg = tpl;
  for (const v of vars) {
    msg = msg.replace(new RegExp(v.tag.replace(/[[\]{}]/g, "\\$&"), "g"), v.preview);
  }
  return msg;
}

function TemplateCard({
  label,
  description,
  icon,
  variables,
  value,
  onChange,
  defaultValue,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  variables: readonly { tag: string; label: string; preview: string }[];
  value: string;
  onChange: (v: string) => void;
  defaultValue: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preview = useMemo(() => buildPreview(value || defaultValue, variables), [value, defaultValue, variables]);

  const insertTag = (tag: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(value + tag);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = value.slice(0, start) + tag + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + tag.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <Card className="border rounded-lg shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/40 py-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {icon}
          {label}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Variable chips */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Variables disponibles — cliquez pour insérer</Label>
          <div className="flex flex-wrap gap-1.5">
            {variables.map((v) => (
              <Badge
                key={v.tag}
                variant="outline"
                className="cursor-pointer hover:bg-accent transition-colors font-mono text-[11px] px-2 py-0.5"
                onClick={() => insertTag(v.tag)}
              >
                {v.tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Editor + Preview */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Éditeur</Label>
            <Textarea
              ref={textareaRef}
              className="min-h-[200px] font-mono text-xs bg-background"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={defaultValue}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Aperçu live</Label>
            <div className="rounded-r-xl rounded-bl-xl bg-[#DCF8C6] p-4 text-xs whitespace-pre-wrap shadow-sm border border-[#b5e2a0] min-h-[200px]">
              {preview}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
  const [absenceTemplate, setAbsenceTemplate] = useState("");
  const [sessionReportTemplate, setSessionReportTemplate] = useState("");

  useEffect(() => {
    if (settings) {
      const s = settings as Record<string, unknown>;
      setTemplate((s["whatsapp_session_template"] as string) ?? DEFAULT_TEMPLATE);
      setAbsenceTemplate((s["whatsapp_absence_template"] as string) ?? DEFAULT_ABSENCE_TEMPLATE);
      setSessionReportTemplate((s["session_report_template"] as string) ?? DEFAULT_SESSION_REPORT);
    }
  }, [settings]);

  const upsert = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        org_id: orgId!,
        whatsapp_session_template: template,
        whatsapp_absence_template: absenceTemplate,
        session_report_template: sessionReportTemplate,
      };
      const { error } = await (supabase.from("madrasa_settings") as any).upsert(payload, { onConflict: "org_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["madrasa_settings", orgId] });
      toast({ title: "Modèles enregistrés" });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-60 w-full" />;

  return (
    <div className="space-y-6">
      <TemplateCard
        label="Compte-rendu individuel"
        description="Message envoyé après une séance pour résumer la progression de l'élève."
        icon={<MessageCircle className="h-4 w-4 text-emerald-600" />}
        variables={VARIABLES}
        value={template}
        onChange={setTemplate}
        defaultValue={DEFAULT_TEMPLATE}
      />

      <TemplateCard
        label="Bilan de séance (collectif)"
        description="Message récapitulatif envoyé après chaque séance avec le bilan global de la classe."
        icon={<FileText className="h-4 w-4 text-cyan-600" />}
        variables={SESSION_REPORT_VARIABLES}
        value={sessionReportTemplate}
        onChange={setSessionReportTemplate}
        defaultValue={DEFAULT_SESSION_REPORT}
      />

      <TemplateCard
        label="Notification d'absence"
        description="Message envoyé aux parents lorsqu'un élève est absent."
        icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
        variables={ABSENCE_VARIABLES}
        value={absenceTemplate}
        onChange={setAbsenceTemplate}
        defaultValue={DEFAULT_ABSENCE_TEMPLATE}
      />

      <div className="flex justify-end">
        <Button onClick={() => upsert.mutate()} disabled={upsert.isPending} className="bg-[hsl(var(--brand-navy))] hover:bg-[hsl(var(--brand-navy))]/90 text-white">
          {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Enregistrer les modèles
        </Button>
      </div>
    </div>
  );
}

export const WA_DEFAULT_TEMPLATE = DEFAULT_TEMPLATE;
export const WA_DEFAULT_ABSENCE_TEMPLATE = DEFAULT_ABSENCE_TEMPLATE;
export const WA_DEFAULT_SESSION_REPORT = DEFAULT_SESSION_REPORT;
