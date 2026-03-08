import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function DashboardErrorState() {
  return (
    <div className="flex-1 flex items-center justify-center p-10">
      <Card className="max-w-md w-full border-destructive/30">
        <CardContent className="flex flex-col items-center py-12 text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Organisation non trouvée</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Impossible de charger les données du tableau de bord.<br />
              Votre profil n'est lié à aucune organisation valide.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
