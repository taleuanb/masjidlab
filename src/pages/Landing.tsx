import { VitrineHeader } from "@/components/vitrine/VitrineHeader";
import { VitrineFooter } from "@/components/vitrine/VitrineFooter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Building2, Users, BookOpen, BarChart3, Shield, Zap } from "lucide-react";

const features = [
  { icon: Building2, title: "Gestion des locaux", desc: "Plan interactif, réservations et suivi d'occupation en temps réel." },
  { icon: Users, title: "Ressources humaines", desc: "Gestion des bénévoles, contrats et compétences de votre équipe." },
  { icon: BookOpen, title: "Madrasa", desc: "Inscriptions, classes et suivi pédagogique de vos élèves." },
  { icon: BarChart3, title: "Finance & Dons", desc: "Trésorerie, reçus fiscaux et suivi transparent des donations." },
  { icon: Shield, title: "RBAC avancé", desc: "Permissions granulaires par rôle, pôle et module." },
  { icon: Zap, title: "Alertes & Ops", desc: "Maintenance, alertes urgentes et coordination opérationnelle." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-brand-navy text-white">
      <VitrineHeader />

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Glow effects */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-emerald/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-40 right-0 w-[300px] h-[300px] bg-brand-cyan/8 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-brand-cyan text-sm font-medium tracking-widest uppercase mb-4">
              Plateforme SaaS pour mosquées
            </p>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
              Gérez l'organisation,
              <br />
              <span className="text-gradient-brand">élevez les cœurs.</span>
            </h1>
            <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
              MASJIDLAB centralise la gestion de votre mosquée — personnel, finances, éducation et logistique — dans une plateforme moderne et sécurisée.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="https://app.masjidlab.com/register">
                <Button size="lg" className="bg-brand-emerald hover:bg-brand-emerald/90 text-white shadow-[0_0_30px_hsl(161_84%_39%/0.3)] hover:shadow-[0_0_40px_hsl(161_84%_39%/0.5)] transition-all gap-2 px-8">
                  Démarrer gratuitement
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <a href="#solutions">
                <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/5 hover:text-white">
                  Découvrir les solutions
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Solutions */}
      <section id="solutions" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-brand-cyan text-xs font-semibold tracking-widest uppercase mb-2">Solutions</p>
            <h2 className="text-3xl md:text-4xl font-bold">Tout ce dont votre mosquée a besoin</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 hover:border-brand-cyan/30 transition-colors group"
              >
                <div className="h-10 w-10 rounded-lg bg-brand-cyan/10 flex items-center justify-center mb-4 group-hover:bg-brand-cyan/20 transition-colors">
                  <f.icon className="h-5 w-5 text-brand-cyan" />
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-brand-emerald/10 to-brand-cyan/5 p-12 backdrop-blur-sm">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Prêt à moderniser votre mosquée ?
            </h2>
            <p className="text-white/50 mb-8 max-w-lg mx-auto">
              Rejoignez les institutions qui font confiance à MASJIDLAB pour leur gestion quotidienne.
            </p>
            <a href="https://app.masjidlab.com/register">
              <Button size="lg" className="bg-brand-emerald hover:bg-brand-emerald/90 text-white shadow-[0_0_30px_hsl(161_84%_39%/0.3)] gap-2 px-8">
                Créer mon espace
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      <VitrineFooter />
    </div>
  );
}
