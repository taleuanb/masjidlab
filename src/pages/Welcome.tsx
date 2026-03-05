import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function WelcomePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
          <CardTitle className="text-xl font-bold">Bienvenue sur Masjidi 🎉</CardTitle>
          <CardDescription>Votre compte a été créé avec succès.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full h-14 justify-start gap-3 text-left"
            onClick={() => navigate("/setup/identity")}
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
