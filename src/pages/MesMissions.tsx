import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  MapPin,
  User,
  Check,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  ShieldCheck,
  HandHeart,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useRole } from "@/contexts/RoleContext";
import { useNotifications } from "@/contexts/NotificationContext";

interface Mission {
  id: string;
  titre: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  lieu: string;
  responsable: string;
  pole: string;
  instructions: string;
  type: "accueil" | "securite" | "logistique" | "social";
}

const MISSIONS_MOCK: Mission[] = [
  {
    id: "m1",
    titre: "Accueil Jumu'ah",
    date: "2026-02-20",
    heureDebut: "11:30",
    heureFin: "14:00",
    lieu: "Entrée principale — RDC",
    responsable: "Youssef K.",
    pole: "Accueil",
    instructions: "Porter le gilet jaune, se placer à l'entrée Nord. Distribuer les programmes aux fidèles. Orienter les nouveaux vers la salle de prière principale.",
    type: "accueil",
  },
  {
    id: "m2",
    titre: "Sécurité Parking",
    date: "2026-02-20",
    heureDebut: "11:00",
    heureFin: "14:30",
    lieu: "Parking souterrain — Zone A & B",
    responsable: "Hassan M.",
    pole: "Parking",
    instructions: "Gérer le flux d'entrée et de sortie. Orienter les véhicules vers les places disponibles en zone B en priorité. Signaler tout incident au responsable.",
    type: "securite",
  },
  {
    id: "m3",
    titre: "Distribution alimentaire",
    date: "2026-02-22",
    heureDebut: "15:00",
    heureFin: "18:00",
    lieu: "Salle Polyvalente — 2ème Étage",
    responsable: "Khadija M.",
    pole: "Social (ABD)",
    instructions: "Préparer les colis à partir de 14h30. Vérifier la liste des bénéficiaires à l'entrée. Chaque famille reçoit un colis standard + un colis frais si disponible.",
    type: "social",
  },
  {
    id: "m4",
    titre: "Installation Conférence Ramadan",
    date: "2026-02-21",
    heureDebut: "09:00",
    heureFin: "11:30",
    lieu: "Salle de Prière Principale — RDC",
    responsable: "Omar S.",
    pole: "Imam",
    instructions: "Installer 2 sonos portables et 4 micros sans fil. Tester le vidéoprojecteur. Disposer 200 chaises en rangées face au minbar. Vérifier la climatisation.",
    type: "logistique",
  },
  {
    id: "m5",
    titre: "Accueil Portes Ouvertes",
    date: "2026-02-28",
    heureDebut: "10:00",
    heureFin: "17:00",
    lieu: "Terrasse Événement — 4ème Étage",
    responsable: "Mehdi A.",
    pole: "Com",
    instructions: "Accueillir les visiteurs avec le sourire. Distribuer les brochures de présentation. Proposer une visite guidée toutes les 30 minutes.",
    type: "accueil",
  },
];

const TYPE_STYLES: Record<string, { icon: typeof Check; badge: string }> = {
  accueil: { icon: HandHeart, badge: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
  securite: { icon: ShieldCheck, badge: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  logistique: { icon: CalendarDays, badge: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
  social: { icon: HandHeart, badge: "bg-pink-500/10 text-pink-600 border-pink-500/20" },
};

function MissionCard({ mission }: { mission: Mission }) {
  const [confirmed, setConfirmed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { push } = useNotifications();

  const typeStyle = TYPE_STYLES[mission.type] || TYPE_STYLES.accueil;
  const TypeIcon = typeStyle.icon;
  const isPast = new Date(`${mission.date}T${mission.heureFin}`) < new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md ${
        isPast ? "opacity-60" : ""
      }`}
    >
      {/* Card body */}
      <div className="p-5">
        {/* Top row: badge + date */}
        <div className="flex items-center justify-between mb-3">
          <Badge variant="outline" className={`text-[11px] ${typeStyle.badge}`}>
            <TypeIcon className="h-3 w-3 mr-1" />
            {mission.type.charAt(0).toUpperCase() + mission.type.slice(1)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {format(parseISO(mission.date), "EEEE d MMM", { locale: fr })}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold tracking-tight mb-3">
          {mission.titre}
        </h3>

        {/* Details */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{mission.heureDebut} — {mission.heureFin}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{mission.lieu}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span>
              Responsable : <span className="text-foreground font-medium">{mission.responsable}</span>
              <span className="text-muted-foreground/60"> · {mission.pole}</span>
            </span>
          </div>
        </div>

        {/* Confirm button */}
        <Button
          onClick={() => {
            const next = !confirmed;
            setConfirmed(next);
            if (next) {
              push({
                type: "presence",
                titre: `Présence confirmée : ${mission.titre}`,
                description: `Un bénévole a confirmé sa présence pour "${mission.titre}" le ${format(parseISO(mission.date), "d MMM", { locale: fr })}.`,
                destinataire: "Responsable",
                pole: mission.pole,
              });
            }
          }}
          disabled={isPast}
          className={`w-full h-11 text-sm font-semibold transition-all ${
            confirmed
              ? "bg-primary hover:bg-primary/90 text-primary-foreground"
              : "bg-accent hover:bg-accent/90 text-accent-foreground"
          }`}
        >
          {confirmed ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Présence confirmée
            </>
          ) : (
            "Confirmer ma présence"
          )}
        </Button>
      </div>

      {/* Instructions collapsible */}
      <div className="border-t">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full px-5 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="font-medium">Instructions</span>
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                {mission.instructions}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function MesMissionsPage() {
  const { pole } = useRole();

  const upcoming = MISSIONS_MOCK.filter(
    (m) => new Date(`${m.date}T${m.heureFin}`) >= new Date()
  ).sort((a, b) => a.date.localeCompare(b.date) || a.heureDebut.localeCompare(b.heureDebut));

  const past = MISSIONS_MOCK.filter(
    (m) => new Date(`${m.date}T${m.heureFin}`) < new Date()
  );

  return (
    <div className="flex-1 overflow-auto">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 backdrop-blur-sm px-6 py-4">
        <SidebarTrigger />
        <div className="flex-1">
          <h2 className="text-lg font-semibold tracking-tight">Mes Missions</h2>
          <p className="text-sm text-muted-foreground">
            {upcoming.length} mission{upcoming.length > 1 ? "s" : ""} à venir
          </p>
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
              À venir
            </h3>
            {upcoming.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <MissionCard mission={m} />
              </motion.div>
            ))}
          </section>
        )}

        {/* Past */}
        {past.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Passées
            </h3>
            {past.map((m) => (
              <MissionCard key={m.id} mission={m} />
            ))}
          </section>
        )}

        {upcoming.length === 0 && past.length === 0 && (
          <div className="text-center py-16">
            <HandHeart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">Aucune mission assignée pour le moment.</p>
          </div>
        )}
      </main>
    </div>
  );
}
