import { motion } from "framer-motion";
import { GraduationCap, Wallet, Heart, Building2 } from "lucide-react";
import poleEducation from "@/assets/pole-education.jpg";
import poleFinance from "@/assets/pole-finance.jpg";
import poleSocial from "@/assets/pole-social.jpg";
import poleLogistique from "@/assets/pole-logistique.jpg";

const poles = [
  {
    title: "Pôle Éducation",
    subtitle: "Madrasa 2.0",
    desc: "Pilotez votre école coranique avec un suivi pédagogique moderne : inscriptions en ligne, classes, niveaux, bulletins et portail parents. Chaque élève bénéficie d'un parcours individualisé.",
    features: ["Inscriptions & classes", "Suivi pédagogique", "Portail parents"],
    icon: GraduationCap,
    image: poleEducation,
    accentColor: "hsl(161 84% 39%)",
    accentClass: "text-brand-emerald",
    glowClass: "from-brand-emerald/20",
  },
  {
    title: "Pôle Finance",
    subtitle: "Intégrité & Transparence",
    desc: "Gérez vos dons, générez des reçus fiscaux conformes et offrez une transparence totale à vos donateurs. Un tableau de bord financier clair pour votre trésorier et votre conseil d'administration.",
    features: ["Suivi des dons", "Reçus fiscaux CERFA", "Rapports financiers"],
    icon: Wallet,
    image: poleFinance,
    accentColor: "hsl(185 73% 57%)",
    accentClass: "text-brand-cyan",
    glowClass: "from-brand-cyan/20",
  },
  {
    title: "Pôle Social",
    subtitle: "Communauté & Entraide",
    desc: "Fédérez votre communauté autour d'événements, de programmes sociaux et d'actions caritatives. Coordonnez bénévoles et familles avec des outils collaboratifs intuitifs.",
    features: ["Gestion d'événements", "Coordination bénévoles", "Actions caritatives"],
    icon: Heart,
    image: poleSocial,
    accentColor: "hsl(280 60% 50%)",
    accentClass: "text-purple-400",
    glowClass: "from-purple-400/20",
  },
  {
    title: "Pôle Logistique",
    subtitle: "Maîtrise Opérationnelle",
    desc: "Visualisez vos locaux avec un plan interactif multi-étages, gérez les réservations de salles, le parking et la maintenance. Votre infrastructure physique, numérisée.",
    features: ["Plan interactif", "Réservations temps réel", "Suivi maintenance"],
    icon: Building2,
    image: poleLogistique,
    accentColor: "hsl(185 73% 57%)",
    accentClass: "text-brand-cyan",
    glowClass: "from-brand-cyan/20",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

export default function HumanCentricPoles() {
  return (
    <section className="py-24 px-6 relative" style={{ background: "hsl(222 68% 6%)" }}>
      {/* Section header */}
      <motion.div
        className="text-center mb-20 max-w-3xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-brand-cyan text-xs font-semibold tracking-widest uppercase mb-3">Écosystème</p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Une plateforme pensée pour les humains qui la portent.
        </h2>
        <p className="text-white/40 text-base leading-relaxed">
          Chaque pôle de MASJIDLAB répond à un besoin concret de votre institution, 
          avec des outils conçus pour vos équipes, vos familles et votre communauté.
        </p>
      </motion.div>

      {/* Alternating blocks */}
      <div className="max-w-6xl mx-auto space-y-24">
        {poles.map((pole, i) => {
          const isReversed = i % 2 !== 0;
          return (
            <motion.div
              key={pole.title}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className={`flex flex-col ${isReversed ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-10 lg:gap-16`}
            >
              {/* Image side */}
              <div className="w-full lg:w-1/2 relative group">
                {/* Emerald/Cyan glow behind image */}
                <div
                  className={`absolute -inset-4 rounded-3xl bg-gradient-to-br ${pole.glowClass} to-transparent opacity-60 blur-2xl group-hover:opacity-80 transition-opacity duration-500`}
                />
                <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl">
                  <img
                    src={pole.image}
                    alt={pole.title}
                    className="w-full h-64 md:h-80 object-cover"
                    loading="lazy"
                  />
                  {/* Overlay gradient */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: `linear-gradient(180deg, transparent 50%, hsl(222 68% 6% / 0.7) 100%)`,
                    }}
                  />
                </div>
              </div>

              {/* Text side */}
              <div className="w-full lg:w-1/2 space-y-5">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${pole.accentColor}15` }}
                  >
                    <pole.icon className={`h-5 w-5 ${pole.accentClass}`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{pole.title}</h3>
                    <p className={`text-xs font-medium ${pole.accentClass}`}>{pole.subtitle}</p>
                  </div>
                </div>

                <p className="text-white/50 leading-relaxed">{pole.desc}</p>

                <ul className="space-y-2">
                  {pole.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-white/60">
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ background: pole.accentColor }}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
