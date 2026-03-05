import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Loader2, Building2, UserPlus, Users, ChevronRight } from "lucide-react";

type PostSignupStep = "choice" | null;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [postSignupStep, setPostSignupStep] = useState<PostSignupStep>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("token");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;

        if (inviteToken) {
          // Invitation flow: redirect directly, the token will be handled server-side
          toast({ title: "Compte créé", description: "Bienvenue dans votre équipe !" });
          navigate("/", { replace: true });
        } else {
          // Free signup: show post-signup choice
          setPostSignupStep("choice");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/", { replace: true });
      }
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Post-signup choice screen ──
  if (postSignupStep === "choice") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-lg border-border/50">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-xl gradient-emerald flex items-center justify-center mb-2">
              <span className="text-2xl font-bold text-white">M</span>
            </div>
            <CardTitle className="text-xl font-bold">Bienvenue sur Masjidi 🎉</CardTitle>
            <CardDescription>Votre compte a été créé avec succès.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full h-14 justify-start gap-3 text-left"
              onClick={() => navigate("/", { replace: true })}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/20">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Inscrire ma mosquée sur Masjidi</p>
                <p className="text-[11px] opacity-80">Créer une nouvelle organisation</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
            </Button>

            <div className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">J'ai déjà une équipe</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Demandez une invitation à votre administrateur de mosquée.
                Il pourra vous ajouter depuis l'espace "Membres & Rôles".
              </p>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Retour à la connexion
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-xl gradient-emerald flex items-center justify-center mb-2">
            <span className="text-2xl font-bold text-white">M</span>
          </div>
          <CardTitle className="text-2xl font-bold">Masjidi</CardTitle>
          <CardDescription>
            {isSignUp
              ? inviteToken
                ? "Créer votre compte pour rejoindre l'équipe"
                : "Créer un nouveau compte"
              : "Connectez-vous pour accéder au tableau de bord"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="displayName">Nom complet</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Ahmed Ben Ali"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@mosquee.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : isSignUp ? (
                <UserPlus className="mr-2 h-4 w-4" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              {isSignUp ? "Créer le compte" : "Se connecter"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isSignUp ? "Déjà un compte ? Se connecter" : "Pas de compte ? S'inscrire"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
