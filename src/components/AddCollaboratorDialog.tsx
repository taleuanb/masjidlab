import { useState } from "react";
import {
  UserPlus, Mail, Link2, Copy, Check, Loader2, User, Wifi, WifiOff,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

const INVITE_ROLES = [
  { value: "admin", label: "Admin Mosquée" },
  { value: "responsable", label: "Responsable" },
  { value: "enseignant", label: "Enseignant / Oustaz" },
  { value: "benevole", label: "Bénévole" },
  { value: "parent", label: "Parent d'élève" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poles: { id: string; nom: string }[];
  onSuccess?: () => void;
}

type Mode = "invite" | "local";

export function AddCollaboratorDialog({ open, onOpenChange, poles, onSuccess }: Props) {
  const { org, orgId } = useOrganization();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("invite");
  const [saving, setSaving] = useState(false);

  // Invite fields
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState("benevole");
  const [invPole, setInvPole] = useState("none");
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Local fields
  const [locPrenom, setLocPrenom] = useState("");
  const [locNom, setLocNom] = useState("");
  const [locPhone, setLocPhone] = useState("");
  const [locRole, setLocRole] = useState("benevole");

  const reset = () => {
    setMode("invite");
    setInvEmail(""); setInvRole("benevole"); setInvPole("none");
    setMagicLink(null); setCopied(false);
    setLocPrenom(""); setLocNom(""); setLocPhone(""); setLocRole("benevole");
  };

  const handleInvite = async () => {
    if (!invEmail.trim() || !orgId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("invitations" as any)
        .insert({
          org_id: orgId,
          email: invEmail.trim().toLowerCase(),
          role: invRole,
          org_name: org?.name || null,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      const link = `${window.location.origin}/join/${(data as any).id}`;
      setMagicLink(link);
      toast({ title: "Invitation créée !" });
      onSuccess?.();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLocal = async () => {
    const displayName = `${locPrenom.trim()} ${locNom.trim()}`.trim();
    if (!displayName) return;
    setSaving(true);
    try {
      const fakeUserId = crypto.randomUUID();
      await supabase.from("profiles").insert({
        user_id: fakeUserId,
        display_name: displayName,
        phone: locPhone.trim() || null,
        has_account: false,
        is_active: true,
      } as any);
      await supabase.from("user_roles").insert({ user_id: fakeUserId, role: locRole as any });
      toast({ title: "Profil enregistré" });
      onSuccess?.();
      onOpenChange(false);
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Ajouter un collaborateur
          </DialogTitle>
          <DialogDescription>
            Choisissez le type d'ajout selon le besoin.
          </DialogDescription>
        </DialogHeader>

        {/* ── Mode selector: Radio Cards ── */}
        {!magicLink && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("invite")}
              className={cn(
                "rounded-lg border-2 p-4 text-left transition-all",
                mode === "invite"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              )}
            >
              <Wifi className={cn("h-5 w-5 mb-2", mode === "invite" ? "text-primary" : "text-muted-foreground")} />
              <p className="text-sm font-semibold text-foreground">Invitation SaaS</p>
              <p className="text-xs text-muted-foreground mt-1">Accès au logiciel via lien magique</p>
            </button>
            <button
              type="button"
              onClick={() => setMode("local")}
              className={cn(
                "rounded-lg border-2 p-4 text-left transition-all",
                mode === "local"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              )}
            >
              <WifiOff className={cn("h-5 w-5 mb-2", mode === "local" ? "text-primary" : "text-muted-foreground")} />
              <p className="text-sm font-semibold text-foreground">Profil local</p>
              <p className="text-xs text-muted-foreground mt-1">Contact interne sans accès logiciel</p>
            </button>
          </div>
        )}

        {/* ── Invite form ── */}
        {mode === "invite" && !magicLink && (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email *</Label>
              <Input type="email" placeholder="nom@email.com" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rôle</Label>
                <Select value={invRole} onValueChange={setInvRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INVITE_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pôle</Label>
                <Select value={invPole} onValueChange={setInvPole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {poles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* ── Magic link result ── */}
        {mode === "invite" && magicLink && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Link2 className="h-4 w-4" /> Lien d'invitation
              </div>
              <div className="flex gap-2">
                <Input value={magicLink} readOnly className="h-9 text-xs bg-muted font-mono" />
                <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0 gap-1.5">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copié" : "Copier"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Partagez ce lien avec votre invité pour qu'il rejoigne votre mosquée.
              </p>
            </div>
          </div>
        )}

        {/* ── Local form ── */}
        {mode === "local" && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prénom *</Label>
                <Input placeholder="Prénom" value={locPrenom} onChange={(e) => setLocPrenom(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nom *</Label>
                <Input placeholder="Nom" value={locNom} onChange={(e) => setLocNom(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Téléphone</Label>
              <Input placeholder="06 xx xx xx xx" value={locPhone} onChange={(e) => setLocPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rôle</Label>
              <Select value={locRole} onValueChange={setLocRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          {mode === "invite" && !magicLink && (
            <Button onClick={handleInvite} disabled={!invEmail.trim() || saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Générer le lien magique
            </Button>
          )}
          {mode === "invite" && magicLink && (
            <Button variant="outline" onClick={reset}>Nouvelle invitation</Button>
          )}
          {mode === "local" && (
            <Button onClick={handleLocal} disabled={!locPrenom.trim() || !locNom.trim() || saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
              Enregistrer le profil
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
