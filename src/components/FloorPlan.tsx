import { AnimatePresence, motion } from "framer-motion";
import { Wifi, Mic, Snowflake, Monitor, Speaker } from "lucide-react";
import { sallesMock } from "@/data/mock-data";
import { Etage, Equipement, StatutSalle } from "@/types/amm";

interface FloorPlanProps {
  selectedEtage: Etage;
}

const statutColors: Record<StatutSalle, string> = {
  disponible: "bg-primary/15 border-primary/30 hover:bg-primary/25",
  occupée: "bg-destructive/10 border-destructive/25 hover:bg-destructive/15",
  réservée: "bg-accent/15 border-accent/30 hover:bg-accent/25",
  maintenance: "bg-muted border-muted-foreground/20",
};

const statutLabels: Record<StatutSalle, string> = {
  disponible: "Disponible",
  occupée: "Occupée",
  réservée: "Réservée",
  maintenance: "En maintenance",
};

const statutDots: Record<StatutSalle, string> = {
  disponible: "bg-primary",
  occupée: "bg-destructive",
  réservée: "bg-accent",
  maintenance: "bg-muted-foreground/50",
};

const equipementIcons: Record<Equipement, { icon: typeof Wifi; label: string }> = {
  wifi: { icon: Wifi, label: "Wifi" },
  micro: { icon: Mic, label: "Micro" },
  clim: { icon: Snowflake, label: "Clim" },
  vidéoprojecteur: { icon: Monitor, label: "Vidéo" },
  sono: { icon: Speaker, label: "Sono" },
};

export function FloorPlan({ selectedEtage }: FloorPlanProps) {
  const salles = sallesMock.filter(s => s.etage === selectedEtage);

  return (
    <div className="bento-card">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold">Plan de l'étage</h3>
          <p className="text-sm text-muted-foreground">
            {salles.length} salle{salles.length > 1 ? 's' : ''} ·{' '}
            {selectedEtage === 'RDC' ? 'Rez-de-chaussée' : `${selectedEtage}${selectedEtage === '1' ? 'er' : 'ème'} étage`}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {(['disponible', 'occupée', 'réservée', 'maintenance'] as StatutSalle[]).map(s => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${statutDots[s]}`} />
              {statutLabels[s]}
            </span>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedEtage}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="grid grid-cols-2 md:grid-cols-3 gap-3"
        >
          {salles.map((salle, i) => (
            <motion.button
              key={salle.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
              className={`relative rounded-xl border-2 p-4 text-left transition-all cursor-pointer ${statutColors[salle.statut]}`}
            >
              <p className="text-sm font-medium truncate">{salle.nom}</p>
              <p className="text-xs text-muted-foreground mt-1">{salle.type}</p>

              {/* Equipment badges */}
              {salle.equipements && salle.equipements.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {salle.equipements.map((eq) => {
                    const { icon: Icon, label } = equipementIcons[eq];
                    return (
                      <span
                        key={eq}
                        title={label}
                        className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        <Icon className="h-3 w-3" />
                        {label}
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">
                  {salle.capacite} places
                </span>
                {salle.pole && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    {salle.pole}
                  </span>
                )}
              </div>
            </motion.button>
          ))}
        </motion.div>
      </AnimatePresence>

      {salles.length === 0 && (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          Aucune salle configurée pour cet étage
        </div>
      )}
    </div>
  );
}
