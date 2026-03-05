import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Building2, UserPlus } from "lucide-react";
import masjidLabLogo from "@/assets/masjidlab-logo.png";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin Mosquée",
  responsable: "Responsable",
  enseignant: "Enseignant / Oustaz",
  benevole: "Bénévole",
  parent: "Parent d'élève",
};

type Invitation = {
  id: string;
  org_id: string;
  org_name: string | null;
  email: string;
  role: string;
  status: string;
};

export default function JoinPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Signup form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Fetch invitation
  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error: fetchErr } = await supabase
        .from("invitations" as any)
        .select("id, org_id, org_name, email, role, status")
        .eq("id", id)
        .eq("status", "pending")
        .maybeSingle();

      if (fetchErr || !data) {
        setError("Invitation introuvable ou déjà utilisée.");
      } else {
        setInvitation(data as any);
        setEmail((data as any).email);
      }
      setLoading(false);
    })();
  }, [id]);

  // If user is already logged in and invitation exists, auto-accept
  useEffect(() => {
    if (!user || !invitation || done) return;
    acceptInvitation(user.id);
  }, [user, invitation]);

  const acceptInvitation = async (userId: string) => {
    if (!invitation) return;
    setSubmitting(true);
    try {
      // Link profile to org
      await supabase
        .from("profiles")
        .update({ org_id: invitation.org_id } as any)
        .eq("user_id", userId);

      // Insert role
      await supabase.from("user_roles").insert({
        user_id: userId,
        role: invitation.role as any,
        org_id: invitation.org_id,
      });

      // Mark invitation as accepted
      await supabase
        .from("invitations" as any)
        .update({ status: "accepted" } as any)
        .eq("id", invitation.id);

      setDone(true);
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async () => {
    if (!displayName.trim() || !password || !invitation) return;
    setSubmitting(true);
    setError(null);

    try {
      const { data: signupData, error: signupErr } = await supabase.auth.signUp({
        email: invitation.email,
        password,
        options: { data: { display_name: displayName.trim() } },
      });

      if (signupErr) throw signupErr;
      if (!signupData.user) throw new Error("Erreur lors de la création du compte");

      // The handle_new_user trigger creates profile & default role.
      // We now override org_id and role.
      // Small delay to let trigger execute
      await new Promise((r) => setTimeout(r, 1000));

      await acceptInvitation(signupData.user.id);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <img src={masjidLabLogo} alt="MasjidLab" className="h-16 w-16 object-contain" />
        </div>

        {error && !invitation ? (
          <div className="text-center space-y-4">
            <h1 className="text-xl font-bold text-foreground">Invitation invalide</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => navigate("/login")}>Se connecter</Button>
          </div>
        ) : done ? (
          <div className="text-center space-y-4 py-8">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-primary" />
              </div>
            </div>
            <p className="text-xl font-bold text-foreground">Bienvenue !</p>
            <p className="text-sm text-muted-foreground">Redirection vers le tableau de bord…</p>
            <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
          </div>
        ) : user ? (
          <div className="text-center space-y-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Acceptation de l'invitation…</p>
          </div>
        ) : invitation ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span className="text-sm font-medium uppercase tracking-wider">Invitation</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Rejoindre {invitation.org_name || "une mosquée"}
              </h1>
              <p className="text-muted-foreground text-sm">
                Vous êtes invité en tant que{" "}
                <span className="font-semibold text-primary">
                  {ROLE_LABELS[invitation.role] || invitation.role}
                </span>
              </p>
            </div>

            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Votre nom complet *
                </Label>
                <Input
                  placeholder="ex : Ahmed Diallo"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-10"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email
                </Label>
                <Input value={invitation.email} disabled className="h-10 bg-muted" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Mot de passe *
                </Label>
                <Input
                  type="password"
                  placeholder="Minimum 6 caractères"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <Button
              className="w-full h-12 gap-2"
              disabled={!displayName.trim() || password.length < 6 || submitting}
              onClick={handleSignup}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Créer mon compte et rejoindre
            </Button>

            <div className="text-center">
              <button
                className="text-sm text-muted-foreground hover:text-foreground underline"
                onClick={() => navigate("/login")}
              >
                Déjà un compte ? Se connecter
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
