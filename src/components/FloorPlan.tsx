import { motion } from "framer-motion";
import { sallesMock } from "@/data/mock-data";
import { Etage, StatutSalle } from "@/types/amm";

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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
      </div>

      {salles.length === 0 && (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          Aucune salle configurée pour cet étage
        </div>
      )}
    </div>
  );
}
