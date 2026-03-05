import { useState } from "react";
import { Copy, Check, Loader2, UserPlus, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const INVITE_ROLES = [
  { value: "enseignant", label: "Enseignant / Oustaz" },
  { value: "benevole", label: "Bénévole" },
  { value: "parent", label: "Parent d'élève" },
  { value: "responsable", label: "Responsable" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited?: () => void;
}

export function InviteMemberDialog({ open, onOpenChange, onInvited }: Props) {
  const { org, orgId } = useOrganization();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("benevole");
  const [saving, setSaving] = useState(false);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setEmail("");
    setRole("benevole");
    setMagicLink(null);
    setCopied(false);
  };

  const handleCreate = async () => {
    if (!email.trim() || !orgId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("invitations" as any)
        .insert({
          org_id: orgId,
          email: email.trim().toLowerCase(),
          role,
          org_name: org?.name || null,
        } as any)
        .select("id")
        .single();

      if (error) throw error;

      const link = `${window.location.origin}/join/${(data as any).id}`;
      setMagicLink(link);
      toast({ title: "Invitation créée !" });
      onInvited?.();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (!magicLink) return;
    navigator.clipboard.writeText(magicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Inviter un membre
          </DialogTitle>
          <DialogDescription>
            Générez un lien d'invitation magique à partager.
          </DialogDescription>
        </DialogHeader>

        {!magicLink ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email de l'invité *
              </Label>
              <Input
                type="email"
                placeholder="nom@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Rôle attribué
              </Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Link2 className="h-4 w-4" />
                Lien d'invitation
              </div>
              <div className="flex gap-2">
                <Input value={magicLink} readOnly className="h-9 text-xs bg-muted font-mono" />
                <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0 gap-1.5">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copié" : "Copier"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Partagez ce lien avec votre invité. Il pourra créer son compte et rejoindre automatiquement votre mosquée.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {!magicLink ? (
            <Button onClick={handleCreate} disabled={!email.trim() || saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Générer le lien
            </Button>
          ) : (
            <Button variant="outline" onClick={() => { reset(); }}>
              Nouvelle invitation
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
