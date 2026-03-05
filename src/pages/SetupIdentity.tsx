import { useState, useEffect } from "react";
import masjidLabLogo from "@/assets/masjidlab-logo.png";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";

export default function SetupIdentityPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [form, setForm] = useState({
    name: "",
    city: "",
    postal_code: "",
    phone: "",
    siret: "",
  });

  // Setup pages are publicly accessible — no auth redirect

  // Restore form state from sessionStorage when returning from /setup/plan
  useEffect(() => {
    const saved = sessionStorage.getItem("setup_identity");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setForm(parsed);
      } catch { /* ignore */ }
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const canContinue = form.name.trim().length > 0 && form.city.trim().length > 0;

  const handleNext = () => {
    sessionStorage.setItem("setup_identity", JSON.stringify(form));
    navigate("/setup/plan");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ background: "hsl(222 68% 6%)" }}>
      <Card className="w-full max-w-lg shadow-2xl border-white/10 bg-brand-navy/60 backdrop-blur-xl text-white">
        <CardHeader className="text-center space-y-2">
          <a href="https://masjidlab.com" className="mx-auto mb-2 block">
            <img src={masjidLabLogo} alt="MasjidLab" className="h-16 w-16 object-contain drop-shadow-[0_0_20px_hsl(185_73%_57%/0.3)]" />
          </a>
          <CardTitle className="text-xl font-bold text-white">Identité de votre mosquée</CardTitle>
          <CardDescription className="text-white/50">Renseignez les informations de base. Vous pourrez les modifier plus tard.</CardDescription>
          <div className="flex justify-center gap-2 pt-2">
            <div className="h-1.5 w-12 rounded-full bg-primary" />
            <div className="h-1.5 w-12 rounded-full bg-muted" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-white/70">Nom de la mosquée *</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Mosquée Al-Fath" className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-white/70">Ville *</Label>
              <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Paris" className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-white/70">Code postal</Label>
              <Input value={form.postal_code} onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))} placeholder="75001" className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-white/70">Téléphone</Label>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="01 23 45 67 89" className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-white/70">Numéro RNA / SIRET <span className="text-white/30">(Optionnel)</span></Label>
            <Input value={form.siret} onChange={(e) => setForm((f) => ({ ...f, siret: e.target.value }))} placeholder="W123456789 ou 123 456 789 00012" className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>

          <Button className="w-full mt-2 bg-brand-emerald hover:bg-brand-emerald/90 text-white" onClick={handleNext} disabled={!canContinue}>
            Suivant
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => navigate("/welcome")}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              ← Retour
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
