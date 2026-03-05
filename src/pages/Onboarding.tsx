import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Star, Heart, Shield } from "lucide-react";
import masjidLabLogo from "@/assets/masjidlab-logo.png";

const visionCards = [
  {
    icon: Star,
    title: "Ihsan — الإحسان",
    subtitle: "Excellence",
    description: "Professionnaliser chaque service pour mieux rayonner et élever l'image de la Maison d'Allah.",
  },
  {
    icon: Heart,
    title: "Khidma — الخدمة",
    subtitle: "Service",
    description: "Simplifier l'engagement des serviteurs de la mosquée et valoriser chaque contribution.",
  },
  {
    icon: Shield,
    title: "Amanah — الأمانة",
    subtitle: "Dépôt sacré",
    description: "Rigueur et transparence dans chaque action, car Allah est témoin de ce que nous faisons.",
  },
];

export default function OnboardingPage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen w-full bg-background overflow-auto"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      {/* Hero Section */}
      <div
        className="relative flex flex-col items-center justify-center text-center px-6 py-20"
        style={{
          background: "linear-gradient(160deg, hsl(160, 89%, 8%) 0%, hsl(160, 89%, 14%) 50%, hsl(160, 60%, 20%) 100%)",
        }}
      >
        {/* Decorative top border */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ background: "linear-gradient(90deg, transparent, hsl(45, 90%, 55%), transparent)" }}
        />

        {/* Logo */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl shadow-2xl mb-4 bg-primary-foreground/10">
            <img src={masjidLabLogo} alt="MASJIDLAB" className="h-16 w-16 object-contain" />
          </div>
          <h1
            className="text-4xl font-bold tracking-widest"
            style={{ color: "hsl(45, 90%, 65%)", letterSpacing: "0.2em" }}
          >
            MASJIDLAB
          </h1>
        </div>

        {/* Welcome title */}
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight max-w-2xl">
          Bienvenue au service de<br />
          <span style={{ color: "hsl(45, 90%, 65%)" }}>la Maison d'Allah</span>
        </h2>
        <p className="text-lg text-white/70 max-w-xl leading-relaxed">
          Imams, Responsables, Bénévoles :<br />
          <em>une seule Oummah, une seule mission</em> — <span style={{ color: "hsl(45, 90%, 65%)" }}>Al-Khidma</span>
        </p>

        {/* Decorative bottom arc */}
        <div
          className="absolute bottom-0 left-0 right-0 h-12"
          style={{
            background: "hsl(60, 9%, 97.5%)",
            clipPath: "ellipse(60% 100% at 50% 100%)",
          }}
        />
      </div>

      {/* Verset Section */}
      <div className="px-6 py-16 max-w-3xl mx-auto text-center">
        <div
          className="rounded-2xl p-8 md:p-12 border shadow-sm relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, hsl(160, 89%, 97%) 0%, hsl(160, 60%, 96%) 100%)",
            borderColor: "hsl(160, 89%, 80%)",
          }}
        >
          {/* Decorative quote mark */}
          <div
            className="absolute top-4 left-6 text-8xl font-serif opacity-10 leading-none select-none"
            style={{ color: "hsl(160, 89%, 20%)" }}
          >
            "
          </div>

          {/* Arabic text */}
          <p
            className="text-2xl md:text-3xl leading-loose mb-6 text-right"
            dir="rtl"
            style={{
              fontFamily: "'Amiri', 'Traditional Arabic', 'Times New Roman', serif",
              color: "hsl(160, 89%, 18%)",
              lineHeight: "2.2",
            }}
          >
            إِنَّمَا يَعْمُرُ مَسَاجِدَ اللَّهِ مَنْ آمَنَ بِاللَّهِ وَالْيَوْمِ الْآخِرِ وَأَقَامَ الصَّلَاةَ وَآتَى الزَّكَاةَ وَلَمْ يَخْشَ إِلَّا اللَّهَ ۖ فَعَسَىٰ أُولَٰئِكَ أَن يَكُونُوا مِنَ الْمُهْتَدِينَ
          </p>

          {/* Divider */}
          <div
            className="w-16 h-0.5 mx-auto mb-6"
            style={{ background: "hsl(45, 90%, 55%)" }}
          />

          {/* French translation */}
          <p
            className="text-base md:text-lg text-foreground/80 leading-relaxed italic max-w-2xl mx-auto"
          >
            "Ne peupleront les mosquées d'Allah que ceux qui croient en Allah et au Jour dernier,
            accomplissent la Salât, acquittent la Zakât et ne craignent qu'Allah.
            Il se peut que ceux-là soient du nombre des bien-guidés."
          </p>
          <p
            className="mt-3 text-sm font-semibold"
            style={{ color: "hsl(160, 89%, 25%)" }}
          >
            — Sourate At-Tawba, verset 18
          </p>
        </div>
      </div>

      {/* Vision Cards */}
      <div className="px-6 pb-16 max-w-5xl mx-auto">
        <h3 className="text-center text-xl font-semibold text-foreground mb-8">
          Les piliers de notre engagement
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {visionCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="group rounded-2xl p-7 border shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 text-center"
                style={{
                  background: "linear-gradient(160deg, hsl(160, 89%, 10%) 0%, hsl(160, 89%, 16%) 100%)",
                  borderColor: "hsl(160, 60%, 25%)",
                }}
              >
                {/* Icon */}
                <div
                  className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
                  style={{ background: "hsl(45, 90%, 55% / 0.15)", border: "1px solid hsl(45, 90%, 55% / 0.3)" }}
                >
                  <Icon
                    className="h-6 w-6"
                    style={{ color: "hsl(45, 90%, 60%)" }}
                  />
                </div>

                <h4
                  className="text-lg font-bold mb-1"
                  style={{ color: "hsl(45, 90%, 70%)" }}
                >
                  {card.title}
                </h4>
                <p className="text-sm font-medium mb-3" style={{ color: "hsl(160, 60%, 70%)" }}>
                  {card.subtitle}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "hsl(210, 20%, 75%)" }}>
                  {card.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA Section */}
      <div className="px-6 pb-10 max-w-xl mx-auto text-center">
        <Button
          onClick={() => navigate("/", { replace: true })}
          size="lg"
          className="w-full h-14 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
          style={{
            background: "linear-gradient(135deg, hsl(160, 89%, 20%), hsl(160, 60%, 30%))",
            color: "white",
          }}
        >
          Entrer dans MASJIDLAB
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>

      {/* Coming Soon */}
      <div className="px-6 pb-16 max-w-2xl mx-auto">
        <div
          className="rounded-xl p-5 border border-dashed text-center"
          style={{ borderColor: "hsl(160, 30%, 80%)", background: "hsl(160, 30%, 97%)" }}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Prochainement
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            🎓 <strong>Votre espace École</strong> — Suivi des élèves, objectifs de mémorisation du Coran et parcours pédagogiques personnalisés.
          </p>
        </div>
      </div>
    </div>
  );
}
