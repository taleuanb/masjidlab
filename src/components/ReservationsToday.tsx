import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { reservationsMock, sallesMock } from "@/data/mock-data";
import { Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const poleBadgeColors: Record<string, string> = {
  "Imam": "bg-primary/15 text-primary border-primary/20",
  "École (Avenir)": "bg-amber-500/15 text-amber-700 border-amber-500/20",
  "Social (ABD)": "bg-rose-500/15 text-rose-700 border-rose-500/20",
  "Accueil": "bg-sky-500/15 text-sky-700 border-sky-500/20",
  "Récolte": "bg-violet-500/15 text-violet-700 border-violet-500/20",
  "Com": "bg-orange-500/15 text-orange-700 border-orange-500/20",
  "Digital": "bg-cyan-500/15 text-cyan-700 border-cyan-500/20",
  "Parking": "bg-slate-500/15 text-slate-700 border-slate-500/20",
};

export function ReservationsToday() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Today's reservations sorted by start time
  const today = now.toISOString().slice(0, 10);
  const todayRes = reservationsMock
    .filter(r => r.debut.startsWith(today))
    .sort((a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime());

  // Timeline boundaries (first event start → last event end)
  const starts = todayRes.map(r => new Date(r.debut).getTime());
  const ends = todayRes.map(r => new Date(r.fin).getTime());
  const timelineStart = Math.min(...starts, now.getTime());
  const timelineEnd = Math.max(...ends, now.getTime());
  const timelineSpan = timelineEnd - timelineStart || 1;

  const nowPct = ((now.getTime() - timelineStart) / timelineSpan) * 100;

  return (
    <div className="bento-card">
      <h3 className="text-base font-semibold mb-1">Timeline du jour</h3>
      <p className="text-sm text-muted-foreground mb-5">
        {now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
      </p>

      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[9px] top-0 bottom-0 w-px bg-border" />

        {/* NOW marker */}
        {todayRes.length > 0 && (
          <motion.div
            className="absolute left-0 right-0 flex items-center gap-2 z-10 pointer-events-none"
            style={{ top: `${Math.min(Math.max(nowPct, 2), 98)}%` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {/* Pulsing dot */}
            <div className="relative flex items-center justify-center">
              <span className="absolute h-4 w-4 rounded-full bg-primary/30 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
            </div>
            {/* Horizontal line + label */}
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-px bg-primary/40" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider shrink-0">
                Maintenant
              </span>
            </div>
          </motion.div>
        )}

        {/* Events */}
        <div className="space-y-1">
          {todayRes.map((res, i) => {
            const salle = sallesMock.find(s => s.id === res.salleId);
            const debut = new Date(res.debut);
            const fin = new Date(res.fin);
            const isPast = fin < now;
            const isCurrent = debut <= now && fin >= now;
            const heureDebut = debut.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            const heureFin = fin.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            const badgeClass = poleBadgeColors[res.pole] || "bg-muted text-muted-foreground border-border";

            return (
              <motion.div
                key={res.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`relative flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50 ${
                  isPast ? "opacity-60" : ""
                } ${isCurrent ? "bg-primary/5 border border-primary/15 rounded-lg" : ""}`}
              >
                {/* Timeline dot */}
                <div className="absolute left-[-15px] top-4 flex items-center justify-center">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ring-2 ring-background ${
                      isCurrent ? "bg-primary" : isPast ? "bg-muted-foreground/40" : "bg-border"
                    }`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{res.titre}</p>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${badgeClass}`}>
                      {res.pole}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {heureDebut} – {heureFin}
                    </span>
                    {salle && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3" />
                        {salle.nom}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {todayRes.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aucune réservation aujourd'hui
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
