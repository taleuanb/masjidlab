import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { reservationsMock, sallesMock } from "@/data/mock-data";
import { Clock, MapPin, ChevronUp, ChevronDown } from "lucide-react";
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

const HOUR_HEIGHT = 80; // px per hour
const START_HOUR = 6;
const END_HOUR = 23;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const TIMELINE_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;

function timeToY(date: Date): number {
  const hours = date.getHours() + date.getMinutes() / 60;
  return (hours - START_HOUR) * HOUR_HEIGHT;
}

export function ReservationsToday() {
  const [now, setNow] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to "now" on mount
  useEffect(() => {
    if (scrollRef.current && !hasScrolled.current) {
      const nowY = timeToY(now);
      scrollRef.current.scrollTop = Math.max(0, nowY - 120);
      hasScrolled.current = true;
    }
  }, [now]);

  const today = now.toISOString().slice(0, 10);
  const todayRes = reservationsMock
    .filter(r => r.debut.startsWith(today))
    .sort((a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime());

  const nowY = timeToY(now);

  const scrollBy = (delta: number) => {
    scrollRef.current?.scrollBy({ top: delta, behavior: "smooth" });
  };

  // Hour labels
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);

  return (
    <div className="bento-card flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold">Timeline du jour</h3>
          <p className="text-xs text-muted-foreground">
            {now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            {" · "}Glissez pour naviguer
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => scrollBy(-HOUR_HEIGHT * 2)}
            className="rounded-md p-1 hover:bg-muted transition-colors"
          >
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={() => scrollBy(HOUR_HEIGHT * 2)}
            className="rounded-md p-1 hover:bg-muted transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Scrollable timeline */}
      <div
        ref={scrollRef}
        className="relative overflow-y-auto overscroll-contain flex-1"
        style={{ maxHeight: 380, cursor: "grab" }}
        onMouseDown={(e) => {
          const el = scrollRef.current;
          if (!el) return;
          el.style.cursor = "grabbing";
          const startY = e.clientY;
          const startScroll = el.scrollTop;
          const onMove = (ev: MouseEvent) => {
            el.scrollTop = startScroll - (ev.clientY - startY);
          };
          const onUp = () => {
            el.style.cursor = "grab";
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
      >
        <div className="relative" style={{ height: TIMELINE_HEIGHT }}>
          {/* Hour grid lines */}
          {hours.map((h) => {
            const y = (h - START_HOUR) * HOUR_HEIGHT;
            return (
              <div key={h} className="absolute left-0 right-0" style={{ top: y }}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-10 text-right tabular-nums shrink-0">
                    {String(h).padStart(2, "0")}:00
                  </span>
                  <div className="flex-1 h-px bg-border/60" />
                </div>
              </div>
            );
          })}

          {/* NOW marker */}
          {nowY >= 0 && nowY <= TIMELINE_HEIGHT && (
            <motion.div
              className="absolute left-0 right-0 z-20 pointer-events-none flex items-center gap-1"
              style={{ top: nowY }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="w-10 flex justify-end pr-1">
                <span className="text-[9px] font-bold text-primary uppercase">Now</span>
              </div>
              <div className="relative flex items-center justify-center">
                <span className="absolute h-4 w-4 rounded-full bg-primary/30 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
              </div>
              <div className="flex-1 h-px bg-primary/50" />
            </motion.div>
          )}

          {/* Events */}
          {todayRes.map((res, i) => {
            const salle = sallesMock.find(s => s.id === res.salleId);
            const debut = new Date(res.debut);
            const fin = new Date(res.fin);
            const isPast = fin < now;
            const isCurrent = debut <= now && fin >= now;
            const top = timeToY(debut);
            const height = Math.max(timeToY(fin) - top, 36);
            const heureDebut = debut.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            const heureFin = fin.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            const badgeClass = poleBadgeColors[res.pole] || "bg-muted text-muted-foreground border-border";

            return (
              <motion.div
                key={res.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`absolute left-14 right-1 rounded-lg border p-2.5 transition-colors hover:shadow-md cursor-pointer select-none ${
                  isCurrent
                    ? "bg-primary/5 border-primary/20 shadow-sm"
                    : "bg-card border-border hover:bg-muted/50"
                } ${isPast ? "opacity-50" : ""}`}
                style={{ top, minHeight: height }}
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-xs font-medium truncate">{res.titre}</p>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 leading-4 ${badgeClass}`}>
                    {res.pole}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {heureDebut} – {heureFin}
                  </span>
                  {salle && (
                    <span className="flex items-center gap-0.5 truncate">
                      <MapPin className="h-2.5 w-2.5" />
                      {salle.nom}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}

          {todayRes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Aucune réservation aujourd'hui</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
