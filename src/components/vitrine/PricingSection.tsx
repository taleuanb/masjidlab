import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const plans = [
  {
    id: "starter",
    name: "Starter",
    subtitle: "L'Essentiel",
    monthlyPrice: 49,
    features: [
      "Pôle Membres & Donateurs",
      "Gestion Administrative",
      "Dashboard & Statistiques",
      "Support Standard (email)",
    ],
    cta: "Démarrer",
    style: {
      border: "border-white/10",
      btnClass: "border-brand-cyan/40 text-brand-cyan hover:bg-brand-cyan/10 bg-transparent",
      btnVariant: "outline" as const,
      glow: false,
      badge: null,
      accentIcon: "text-brand-cyan",
    },
  },
  {
    id: "pro",
    name: "Pro",
    subtitle: "L'Institutionnel",
    monthlyPrice: 99,
    features: [
      "Tout le Starter inclus",
      "Pôle Éducation (Madrasa)",
      "Pôle Finance & Reçus Fiscaux",
      "Portail Parents dédié",
      "Rapports avancés",
    ],
    cta: "Choisir Pro",
    style: {
      border: "border-brand-emerald/40",
      btnClass: "bg-brand-emerald hover:bg-brand-emerald/90 text-white shadow-[0_0_24px_hsl(161_84%_39%/0.25)]",
      btnVariant: "default" as const,
      glow: true,
      badge: "Plus Populaire",
      accentIcon: "text-brand-emerald",
    },
  },
  {
    id: "elite",
    name: "Elite",
    subtitle: "L'Infrastructure Totale",
    monthlyPrice: 199,
    features: [
      "Tout le Pro inclus",
      "Pôle Logistique (Salles & Parking)",
      "Pôle Personnel (RH & Bénévoles)",
      "Support Prioritaire 24/7",
      "Intégrations sur-mesure",
    ],
    cta: "Passer à l'Élite",
    style: {
      border: "border-brand-cyan/20",
      btnClass: "bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/20",
      btnVariant: "outline" as const,
      glow: false,
      badge: null,
      accentIcon: "text-brand-cyan",
    },
  },
];

export default function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <section className="py-24 px-6 relative" style={{ background: "hsl(222 68% 6%)" }}>
      {/* Header */}
      <motion.div
        className="text-center max-w-3xl mx-auto mb-12"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        variants={fadeUp}
      >
        <p className="text-brand-cyan text-xs font-semibold tracking-widest uppercase mb-3">Tarifs</p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Investissez dans votre excellence.
        </h2>
        <p className="text-white/45 leading-relaxed mb-8">
          Des plans pensés pour accompagner chaque étape de votre croissance institutionnelle.
        </p>

        {/* Toggle */}
        <div className="inline-flex items-center gap-3 rounded-full border border-white/10 p-1 text-sm"
          style={{ background: "hsl(222 68% 15% / 0.5)" }}
        >
          <button
            onClick={() => setAnnual(false)}
            className={`px-4 py-1.5 rounded-full transition-all text-sm font-medium ${!annual ? "bg-brand-emerald text-white shadow-sm" : "text-white/50 hover:text-white/70"}`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-4 py-1.5 rounded-full transition-all text-sm font-medium flex items-center gap-1.5 ${annual ? "bg-brand-emerald text-white shadow-sm" : "text-white/50 hover:text-white/70"}`}
          >
            Annuel
            <span className="text-[10px] font-bold bg-brand-cyan/20 text-brand-cyan px-1.5 py-0.5 rounded-full">
              -20%
            </span>
          </button>
        </div>
      </motion.div>

      {/* Cards */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan, i) => {
          const price = annual ? Math.round(plan.monthlyPrice * 0.8) : plan.monthlyPrice;
          return (
            <motion.div
              key={plan.id}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={fadeUp}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl border ${plan.style.border} p-6 md:p-8 backdrop-blur-lg flex flex-col ${plan.style.glow ? "shadow-[0_0_60px_hsl(161_84%_39%/0.08)]" : ""}`}
              style={{ background: "hsl(222 68% 15% / 0.5)" }}
            >
              {/* Badge */}
              {plan.style.badge && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-emerald text-white border-0 text-xs px-3 py-0.5 shadow-lg">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {plan.style.badge}
                </Badge>
              )}

              {/* Header */}
              <div className="mb-6">
                <p className="text-white/40 text-xs uppercase tracking-widest mb-1">{plan.subtitle}</p>
                <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">{price}€</span>
                  <span className="text-white/30 text-sm font-light">/ mois</span>
                </div>
                {annual && (
                  <p className="text-brand-emerald text-xs mt-1 font-medium">
                    Facturé {price * 12}€ / an
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="h-px w-full mb-6" style={{
                background: "linear-gradient(90deg, transparent 0%, hsl(185 73% 57% / 0.15) 50%, transparent 100%)",
              }} />

              {/* Features */}
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-brand-emerald shrink-0 mt-0.5" />
                    <span className="text-sm text-white/55 font-light leading-snug">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <a href={`https://app.masjidlab.com/setup/identity`}>
                <Button className={`w-full ${plan.style.btnClass}`} size="lg">
                  {plan.id === "elite" && <Zap className="h-4 w-4 mr-1.5" />}
                  {plan.cta}
                </Button>
              </a>
            </motion.div>
          );
        })}
      </div>

      {/* Custom plan footer */}
      <motion.p
        className="text-center text-white/30 text-sm mt-12"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        variants={fadeUp}
      >
        Besoin d'un plan sur-mesure pour un grand centre ?{" "}
        <a href="/contact" className="text-brand-cyan hover:text-brand-cyan/80 underline underline-offset-2 transition-colors">
          Contactez notre équipe de consultants
        </a>.
      </motion.p>
    </section>
  );
}
