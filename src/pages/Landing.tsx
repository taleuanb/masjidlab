import { VitrineHeader } from "@/components/vitrine/VitrineHeader";
import { VitrineFooter } from "@/components/vitrine/VitrineFooter";
import BentoPolesGrid from "@/components/vitrine/BentoPolesGrid";
import TrustSection from "@/components/vitrine/TrustSection";
import PricingSection from "@/components/vitrine/PricingSection";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Building2, Users, BookOpen, BarChart3, Shield, Zap, Lock, Server, ShieldCheck } from "lucide-react";

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
        {/* Deep radial gradient: navy center → pure black edges */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 55% at 50% 45%, hsl(222 68% 14%) 0%, hsl(222 68% 6%) 50%, hsl(0 0% 2%) 100%)",
          }}
        />

        {/* Lattice Structure — Islamic architectural grid */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="lattice" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              {/* Octagonal lattice pattern inspired by Islamic geometry */}
              <path d="M40 0 L60 20 L60 60 L40 80 L20 60 L20 20 Z" fill="none" stroke="hsl(161 84% 39%)" strokeWidth="0.5" />
              <path d="M0 40 L20 20 L60 20 L80 40 L60 60 L20 60 Z" fill="none" stroke="hsl(185 73% 57%)" strokeWidth="0.3" />
              <circle cx="40" cy="40" r="2" fill="hsl(185 73% 57%)" opacity="0.4" />
              <circle cx="0" cy="0" r="1.5" fill="hsl(161 84% 39%)" opacity="0.3" />
              <circle cx="80" cy="0" r="1.5" fill="hsl(161 84% 39%)" opacity="0.3" />
              <circle cx="0" cy="80" r="1.5" fill="hsl(161 84% 39%)" opacity="0.3" />
              <circle cx="80" cy="80" r="1.5" fill="hsl(161 84% 39%)" opacity="0.3" />
            </pattern>
            {/* Radial mask to fade lattice at edges */}
            <radialGradient id="latticeFade" cx="50%" cy="45%" r="50%">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="70%" stopColor="white" stopOpacity="0.3" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <mask id="latticeMask">
              <rect width="100%" height="100%" fill="url(#latticeFade)" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="url(#lattice)" mask="url(#latticeMask)" />
        </svg>

        {/* Pulsing Core — Emerald breath behind title */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
          animate={{ scale: [1, 1.15, 1], opacity: [0.12, 0.22, 0.12] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          style={{ background: "radial-gradient(circle, hsl(161 84% 39% / 0.25) 0%, transparent 65%)", filter: "blur(100px)" }}
        />
        {/* Cyan outer ring — breath sync */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full pointer-events-none"
          animate={{ scale: [1, 1.08, 1], opacity: [0.06, 0.12, 0.06] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          style={{ background: "radial-gradient(circle, transparent 35%, hsl(185 73% 57% / 0.12) 55%, transparent 70%)", filter: "blur(60px)" }}
        />

        {/* Content */}
        <motion.div
          className="relative z-10 max-w-5xl mx-auto text-center"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {/* Surtitre — light, wide tracking */}
          <motion.p
            variants={fadeUp}
            className="text-brand-cyan text-[11px] sm:text-xs font-light tracking-[0.4em] uppercase mb-8"
          >
            L'INFRASTRUCTURE DIGITALE D'ÉLITE
          </motion.p>

          {/* H1 — Imposing, prestigious */}
          <motion.h1
            variants={fadeUp}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold leading-[1.05] tracking-tight mb-8"
          >
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(180deg, hsl(0 0% 100%) 20%, hsl(220 15% 65%) 100%)" }}
            >
              Gérez l'organisation,
            </span>
            <br />
            <span className="text-gradient-brand">élevez les cœurs.</span>
          </motion.h1>

          {/* Sous-titre */}
          <motion.p
            variants={fadeUp}
            className="text-base md:text-lg text-white/45 max-w-2xl mx-auto mb-14 leading-relaxed font-light"
          >
            MASJIDLAB est le système d'exploitation institutionnel qui centralise votre Madrasa,
            vos finances et votre logistique dans un écosystème SaaS de pointe.
          </motion.p>

          {/* CTAs — Emerald primary */}
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <a href="https://app.masjidlab.com/setup/identity">
              <Button
                size="lg"
                className="bg-brand-emerald hover:bg-brand-emerald/90 text-white px-10 py-6 text-base gap-2.5 transition-all shadow-[0_0_30px_hsl(161_84%_39%/0.35)] hover:shadow-[0_0_50px_hsl(161_84%_39%/0.5)]"
              >
                Inscrire ma mosquée
                <ArrowRight className="h-5 w-5" />
              </Button>
            </a>
            <a href="/contact">
              <Button
                size="lg"
                variant="outline"
                className="border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/5 hover:text-white bg-transparent px-8 py-6 text-base"
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
              <div key={badge.label} className="flex items-center gap-2 text-white/25">
                <badge.icon className="h-4 w-4 text-brand-cyan/40" />
                <span className="text-[11px] font-medium tracking-wide">{badge.label}</span>
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
                className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 hover:border-brand-emerald/30 hover:shadow-[0_0_30px_hsl(161_84%_39%/0.08)] transition-all duration-500 group"
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

      {/* ═══════════════════ BENTO PÔLES ═══════════════════ */}
      <BentoPolesGrid />

      {/* ═══════════════════ CONFIANCE & SÉCURITÉ ═══════════════════ */}
      <TrustSection />

      {/* ═══════════════════ TARIFS ═══════════════════ */}
      <PricingSection />

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
            <a href="https://app.masjidlab.com/setup/identity">
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
