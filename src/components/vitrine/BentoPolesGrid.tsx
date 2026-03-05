import { motion } from "framer-motion";
import { GraduationCap, Wallet, Building2, Users, TrendingUp, CheckCircle2, BookOpen, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

/* ── Mini-UI: fake progress bars ── */
function MiniProgress({ items, accentClass }: { items: { label: string; pct: number }[]; accentClass: string }) {
  return (
    <div className="space-y-2 mt-4">
      {items.map((it) => (
        <div key={it.label} className="space-y-1">
          <div className="flex justify-between text-[10px] text-white/40">
            <span>{it.label}</span>
            <span>{it.pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${accentClass}`}
              initial={{ width: 0 }}
              whileInView={{ width: `${it.pct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Mini-UI: stat row ── */
function MiniStats({ stats, accentClass }: { stats: { label: string; value: string }[]; accentClass: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 mt-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg bg-white/[0.04] border border-white/5 p-2 text-center">
          <p className={`text-sm font-bold ${accentClass}`}>{s.value}</p>
          <p className="text-[9px] text-white/35 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Mini-UI: checklist ── */
function MiniChecklist({ items, accentClass }: { items: string[]; accentClass: string }) {
  return (
    <ul className="mt-4 space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2 text-[11px] text-white/45">
          <CheckCircle2 className={`h-3 w-3 shrink-0 ${accentClass}`} />
          {item}
        </li>
      ))}
    </ul>
  );
}

/* ── Mini-UI: badge tags ── */
function MiniBadges({ tags, accentBg }: { tags: string[]; accentBg: string }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-4">
      {tags.map((t) => (
        <span key={t} className={`text-[10px] px-2 py-0.5 rounded-full border border-white/10 ${accentBg} text-white/70`}>
          {t}
        </span>
      ))}
    </div>
  );
}

const poles = [
  {
    title: "Pôle Éducation",
    desc: "Madrasa 2.0 : Pilotage pédagogique et portail parents.",
    badge: "Inclus dans Pro/Elite",
    icon: GraduationCap,
    accentBorder: "hover:shadow-[0_0_40px_hsl(161_84%_39%/0.15)]",
    accentIcon: "text-brand-emerald",
    accentBg: "bg-brand-emerald/10",
    span: "md:col-span-2 md:row-span-2",
    content: (
      <MiniProgress
        accentClass="bg-brand-emerald"
        items={[
          { label: "Coran — Niveau 3", pct: 82 },
          { label: "Arabe — Grammaire", pct: 65 },
          { label: "Sciences Islamiques", pct: 91 },
        ]}
      />
    ),
  },
  {
    title: "Pôle Finance",
    desc: "Intégrité & Transparence : Gestion des dons et reçus fiscaux.",
    badge: "Inclus dans Pro/Elite",
    icon: Wallet,
    accentBorder: "hover:shadow-[0_0_40px_hsl(185_73%_57%/0.15)]",
    accentIcon: "text-brand-cyan",
    accentBg: "bg-brand-cyan/10",
    span: "md:col-span-1",
    content: (
      <MiniStats
        accentClass="text-brand-cyan"
        stats={[
          { label: "Dons", value: "12.4k" },
          { label: "Reçus", value: "89" },
          { label: "Récolt.", value: "94%" },
        ]}
      />
    ),
  },
  {
    title: "Pôle Logistique",
    desc: "Maîtrise Opérationnelle : Salles, équipements et flux.",
    badge: "Elite",
    icon: Building2,
    accentBorder: "hover:shadow-[0_0_40px_hsl(220_60%_50%/0.15)]",
    accentIcon: "text-blue-400",
    accentBg: "bg-blue-400/10",
    span: "md:col-span-1",
    content: (
      <MiniChecklist
        accentClass="text-blue-400"
        items={["Plan interactif multi-étages", "Réservations en temps réel", "Suivi d'occupation & maintenance"]}
      />
    ),
  },
  {
    title: "Pôle Personnel",
    desc: "Capital Humain : Gestion des contrats, bénévoles et compétences.",
    badge: "Elite",
    icon: Users,
    accentBorder: "hover:shadow-[0_0_40px_hsl(280_60%_50%/0.12)]",
    accentIcon: "text-purple-400",
    accentBg: "bg-purple-400/10",
    span: "md:col-span-2",
    content: (
      <MiniBadges
        accentBg="bg-purple-400/10"
        tags={["CDI", "CDD", "Bénévole", "Vacataire", "Imam", "Enseignant", "Gardien", "Comptable"]}
      />
    ),
  },
];

export default function BentoPolesGrid() {
  return (
    <section className="py-24 px-6 relative" style={{ background: "hsl(222 68% 6%)" }}>
      {/* subtle dot grid continuity */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(185 73% 57% / 0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative max-w-6xl mx-auto">
        {/* Section header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-brand-cyan text-xs font-semibold tracking-widest uppercase mb-3">Écosystème</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            L'écosystème modulaire de votre institution.
          </h2>
        </motion.div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {poles.map((pole, i) => (
            <motion.div
              key={pole.title}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`group relative rounded-2xl border border-white/[0.06] p-6 backdrop-blur-lg transition-all duration-500 ${pole.span} ${pole.accentBorder}`}
              style={{ background: "hsl(222 68% 15% / 0.4)" }}
            >
              {/* Icon + Badge row */}
              <div className="flex items-start justify-between mb-3">
                <div className={`h-10 w-10 rounded-xl ${pole.accentBg} flex items-center justify-center`}>
                  <pole.icon className={`h-5 w-5 ${pole.accentIcon}`} />
                </div>
                <Badge className={`${pole.accentBg} ${pole.accentIcon} border-0 text-[10px] font-medium`}>
                  {pole.badge}
                </Badge>
              </div>

              {/* Text */}
              <h3 className="text-lg font-semibold text-white mb-1">{pole.title}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{pole.desc}</p>

              {/* Mini-UI content */}
              {pole.content}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
