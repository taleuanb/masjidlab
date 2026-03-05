import { VitrineHeader } from "@/components/vitrine/VitrineHeader";
import { VitrineFooter } from "@/components/vitrine/VitrineFooter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Building2, Users, BookOpen, BarChart3, Shield, Zap, Lock, Server, ShieldCheck } from "lucide-react";
import masjidLabLogo from "@/assets/masjidlab-logo.png";

const features = [
  { icon: Building2, title: "Gestion des locaux", desc: "Plan interactif, réservations et suivi d'occupation en temps réel." },
  { icon: Users, title: "Ressources humaines", desc: "Gestion des bénévoles, contrats et compétences de votre équipe." },
  { icon: BookOpen, title: "Madrasa", desc: "Inscriptions, classes et suivi pédagogique de vos élèves." },
  { icon: BarChart3, title: "Finance & Dons", desc: "Trésorerie, reçus fiscaux et suivi transparent des donations." },
  { icon: Shield, title: "RBAC avancé", desc: "Permissions granulaires par rôle, pôle et module." },
  { icon: Zap, title: "Alertes & Ops", desc: "Maintenance, alertes urgentes et coordination opérationnelle." },
];

const trustBadges = [
  { icon: Server, label: "Architecture Haute Disponibilité" },
  { icon: Lock, label: "Données Chiffrées AES-256" },
  { icon: ShieldCheck, label: "Conformité RGPD" },
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen text-white" style={{ background: "hsl(222 68% 6%)" }}>
      <VitrineHeader />

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
        {/* Radial gradient background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 70% 60% at 50% 40%, hsl(222 68% 15%) 0%, hsl(222 68% 6%) 60%, hsl(0 0% 0%) 100%)",
          }}
        />

        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, hsl(185 73% 57% / 0.08) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Glow Core — Emerald layer */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(161 84% 39% / 0.15) 0%, transparent 70%)", filter: "blur(80px)" }}
        />
        {/* Glow Core — Cyan ring */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, transparent 40%, hsl(185 73% 57% / 0.08) 60%, transparent 75%)", filter: "blur(40px)" }}
        />

        {/* Content */}
        <motion.div
          className="relative z-10 max-w-4xl mx-auto text-center"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {/* Breathing Logo */}
          <motion.div variants={fadeUp} className="flex justify-center mb-8">
            <motion.div
              animate={{ scale: [1, 1.06, 1], opacity: [0.9, 1, 0.9] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative"
            >
              {/* Logo glow ring */}
              <div className="absolute inset-0 -m-4 rounded-full"
                style={{ background: "radial-gradient(circle, hsl(161 84% 39% / 0.2) 0%, transparent 70%)", filter: "blur(20px)" }}
              />
              <img src={masjidLabLogo} alt="MASJIDLAB" className="relative h-20 w-20 object-contain drop-shadow-[0_0_30px_hsl(185_73%_57%/0.4)]" />
            </motion.div>
          </motion.div>

          {/* Surtitre */}
          <motion.p
            variants={fadeUp}
            className="text-brand-cyan text-xs font-light tracking-[0.3em] uppercase mb-6"
          >
            L'INFRASTRUCTURE DIGITALE D'ÉLITE
          </motion.p>

          {/* H1 */}
          <motion.h1
            variants={fadeUp}
            className="text-4xl sm:text-5xl md:text-7xl font-extrabold leading-[1.1] tracking-tight mb-8"
          >
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(180deg, hsl(0 0% 100%) 30%, hsl(220 15% 70%) 100%)" }}
            >
              Gérez l'organisation,
            </span>
            <br />
            <span className="text-gradient-brand">élevez les cœurs.</span>
          </motion.h1>

          {/* Sous-titre */}
          <motion.p
            variants={fadeUp}
            className="text-base md:text-lg text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            MASJIDLAB est le système d'exploitation institutionnel qui centralise votre Madrasa,
            vos finances et votre logistique dans un écosystème SaaS de pointe.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a href="/register">
              <Button
                size="lg"
                className="bg-brand-emerald hover:bg-brand-emerald/90 text-white px-8 gap-2 transition-all shadow-[0_0_24px_hsl(161_84%_39%/0.3)] hover:shadow-[0_0_40px_hsl(185_73%_57%/0.4)]"
              >
                Inscrire ma mosquée
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <a href="/contact">
              <Button
                size="lg"
                variant="outline"
                className="border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/5 hover:text-white bg-transparent"
              >
                Demander une démo
              </Button>
            </a>
          </motion.div>

          {/* Trust Badges */}
          <motion.div
            variants={fadeUp}
            className="flex flex-wrap items-center justify-center gap-6 md:gap-10"
          >
            {trustBadges.map((badge) => (
              <div key={badge.label} className="flex items-center gap-2 text-white/30">
                <badge.icon className="h-4 w-4 text-brand-cyan/50" />
                <span className="text-xs font-medium tracking-wide">{badge.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ═══════════════════ SOLUTIONS ═══════════════════ */}
      <section id="solutions" className="py-24 px-6 relative">
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
                className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 hover:border-brand-cyan/30 transition-colors group"
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

      {/* ═══════════════════ CTA FINAL ═══════════════════ */}
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
