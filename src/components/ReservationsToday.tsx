import { motion } from "framer-motion";
import { reservationsMock, sallesMock } from "@/data/mock-data";
import { Clock, MapPin, Users } from "lucide-react";

type Affluence = 'Faible' | 'Moyenne' | 'Forte';

function estimerAffluence(capacite: number, pole: string): { level: Affluence; color: string } {
  // Heuristic: prayer rooms + large events = Forte, small classes = Faible
  if (pole === 'Imam' || capacite >= 200) return { level: 'Forte', color: 'bg-destructive/10 text-destructive' };
  if (capacite >= 50 || pole === 'Social (ABD)') return { level: 'Moyenne', color: 'bg-amber-500/10 text-amber-600' };
  return { level: 'Faible', color: 'bg-primary/10 text-primary' };
}

export function ReservationsToday() {
  return (
    <div className="bento-card">
      <h3 className="text-base font-semibold mb-1">Réservations du jour</h3>
      <p className="text-sm text-muted-foreground mb-4">17 février 2026</p>

      <div className="space-y-3">
        {reservationsMock.map((res, i) => {
          const salle = sallesMock.find(s => s.id === res.salleId);
          const heureDebut = new Date(res.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          const heureFin = new Date(res.fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          const affluence = estimerAffluence(salle?.capacite ?? 0, res.pole);

          return (
            <motion.div
              key={res.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{res.titre}</p>
                  <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${affluence.color}`}>
                    <Users className="h-3 w-3" />
                    {affluence.level}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {heureDebut} - {heureFin}
                  </span>
                  {salle && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {salle.nom}
                    </span>
                  )}
                </div>
                <span className="inline-block mt-1.5 text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                  {res.pole}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
