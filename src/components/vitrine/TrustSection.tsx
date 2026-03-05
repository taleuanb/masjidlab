import { motion } from "framer-motion";
import { ShieldCheck, Lock, Server, Quote } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const securityItems = [
  {
    icon: Lock,
    title: "Chiffrement Militaire",
    desc: "Toutes les données sensibles et financières sont chiffrées en AES-256. Vos informations restent privées et protégées.",
  },
  {
    icon: ShieldCheck,
    title: "Conformité RGPD",
    desc: "Architecture souveraine respectant les normes européennes de protection des données personnelles de vos fidèles et élèves.",
  },
  {
    icon: Server,
    title: "Disponibilité 99.9%",
    desc: "Une infrastructure cloud haute performance pour garantir que vos services restent accessibles à tout moment.",
  },
];

const stats = [
  { value: "+150k", label: "Élèves gérés sereinement" },
  { value: "100%", label: "Transparence financière atteinte" },
  { value: "+40h", label: "Temps admin économisé / mois / mosquée" },
];

function GradientDivider() {
  return (
    <div className="h-px w-full max-w-4xl mx-auto" style={{
      background: "linear-gradient(90deg, transparent 0%, hsl(185 73% 57% / 0.2) 50%, transparent 100%)",
    }} />
  );
}

export default function TrustSection() {
  return (
    <section className="py-24 px-6 relative" style={{ background: "hsl(222 68% 6%)" }}>
      {/* Header */}
      <motion.div
        className="text-center max-w-3xl mx-auto mb-16"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        variants={fadeUp}
      >
        <p className="text-brand-cyan text-xs font-semibold tracking-widest uppercase mb-3">Confiance & Sécurité</p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Bâtir sur une base inébranlable.
        </h2>
        <p className="text-white/45 leading-relaxed">
          La sécurité de vos données et la transparence de votre gestion sont au cœur de notre mission.
        </p>
      </motion.div>

      {/* Security Grid */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {securityItems.map((item, i) => (
          <motion.div
            key={item.title}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ delay: i * 0.1 }}
            className="rounded-2xl border border-white/[0.06] p-6 backdrop-blur-lg text-center"
            style={{ background: "hsl(222 68% 15% / 0.35)" }}
          >
            <div className="h-12 w-12 rounded-xl bg-brand-cyan/10 flex items-center justify-center mx-auto mb-4">
              <item.icon className="h-6 w-6 text-brand-cyan" />
            </div>
            <h3 className="text-white font-semibold mb-2">{item.title}</h3>
            <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
          </motion.div>
        ))}
      </div>

      <GradientDivider />

      {/* Impact Stats */}
      <motion.div
        className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 py-16"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
      >
        {stats.map((s) => (
          <motion.div key={s.value} variants={fadeUp} className="text-center">
            <p className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(135deg, hsl(161 84% 39%), hsl(185 73% 57%))" }}
            >
              {s.value}
            </p>
            <p className="text-sm text-white/40 mt-2">{s.label}</p>
          </motion.div>
        ))}
      </motion.div>

      <GradientDivider />

      {/* Testimonial */}
      <motion.div
        className="max-w-3xl mx-auto mt-16"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        variants={fadeUp}
      >
        <div className="relative rounded-2xl border border-brand-emerald/20 p-8 md:p-10"
          style={{ background: "hsl(222 68% 10%)" }}
        >
          <Quote className="absolute top-6 left-6 h-8 w-8 text-brand-emerald/20" />
          <blockquote className="relative z-10 text-white/70 text-base md:text-lg leading-relaxed italic pl-6 md:pl-8">
            "Depuis que nous utilisons MASJIDLAB, notre mosquée n'est plus gérée comme une simple association,
            mais comme une véritable institution. La fluidité du Pôle Éducation a transformé la vie de nos
            professeurs et des parents."
          </blockquote>
          <div className="mt-6 pl-6 md:pl-8 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-brand-emerald/15 flex items-center justify-center">
              <span className="text-brand-emerald text-sm font-bold">RC</span>
            </div>
            <div>
              <p className="text-white/60 text-sm font-medium">Responsable de Centre Islamique</p>
              <p className="text-brand-emerald/60 text-xs">Utilisateur Elite</p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
