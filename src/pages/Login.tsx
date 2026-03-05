import React, { useState } from "react";
import masjidLabLogo from "@/assets/masjidlab-logo.png";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Loader2, Building2, UserPlus, Users, ChevronRight } from "lucide-react";

type PostSignupStep = null;

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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;

        if (data.session) {
          if (inviteToken) {
            toast({ title: "Compte créé", description: "Bienvenue dans votre équipe !" });
            navigate("/", { replace: true });
          } else {
            navigate("/welcome", { replace: true });
          }
        } else {
          toast({
            title: "Vérifiez votre email",
            description: "Un lien de confirmation vous a été envoyé. Cliquez dessus puis connectez-vous.",
          });
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

  // Post-signup flow now handled by /welcome page

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ background: "hsl(222 68% 6%)" }}>
      <Card className="w-full max-w-md shadow-2xl border-white/10 bg-brand-navy/60 backdrop-blur-xl text-white">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto mb-2">
            <img src={masjidLabLogo} alt="MasjidLab" className="h-16 w-16 object-contain drop-shadow-[0_0_20px_hsl(185_73%_57%/0.3)]" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">MASJIDLAB</CardTitle>
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
