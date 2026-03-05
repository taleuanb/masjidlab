import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Mail } from "lucide-react";

export default function SetupSuccessPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ background: "hsl(222 68% 6%)" }}>
      <Card className="w-full max-w-md shadow-2xl border-white/10 bg-brand-navy/60 backdrop-blur-xl text-white text-center">
        <CardHeader className="space-y-3 pb-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-emerald/10">
            <CheckCircle2 className="h-8 w-8 text-brand-emerald" />
          </div>
          <CardTitle className="text-xl font-bold text-white">Merci pour votre inscription !</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-start gap-3 text-left">
              <Clock className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-white/50 leading-relaxed">
                Votre dossier est <span className="font-semibold text-white">en cours de validation</span> par nos équipes. 
                Ce processus prend généralement <span className="font-semibold text-white">moins de 24h</span>.
              </p>
            </div>
            <div className="flex items-start gap-3 text-left">
              <Mail className="h-4 w-4 text-brand-cyan mt-0.5 shrink-0" />
              <p className="text-sm text-white/50 leading-relaxed">
                Vous recevrez un <span className="font-semibold text-white">email de confirmation</span> dès que votre espace sera activé.
              </p>
            </div>
          </div>

          <p className="text-xs text-white/40">
            En attendant, vous pouvez accéder à votre profil et explorer le tableau de bord.
          </p>

          <Button className="w-full" onClick={() => navigate("/dashboard", { replace: true })}>
            Accéder à mon espace
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
