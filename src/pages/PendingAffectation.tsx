import { Building2, Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function PendingAffectation() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-2xl gradient-emerald flex items-center justify-center">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium uppercase tracking-wider">En attente</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            En attente d'affectation à une mosquée
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Votre compte a bien été créé. Un administrateur doit vous rattacher
            à une organisation avant que vous puissiez accéder à l'application.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 text-left space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Que faire ?
          </p>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
            <li>Contactez votre administrateur de mosquée</li>
            <li>Demandez-lui de vous affecter à votre pôle</li>
            <li>Revenez ensuite sur cette page</li>
          </ul>
        </div>

        <Button
          variant="outline"
          className="gap-2"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
