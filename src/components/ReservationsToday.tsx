import { motion } from "framer-motion";
import { reservationsMock, sallesMock } from "@/data/mock-data";
import { Clock, MapPin } from "lucide-react";

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
                <p className="text-sm font-medium truncate">{res.titre}</p>
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
