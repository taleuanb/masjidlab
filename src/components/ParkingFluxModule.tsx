import { useState } from "react";
import { motion } from "framer-motion";
import { Car, TrendingUp, TrendingDown, DoorOpen, OctagonAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parkingPlacesMock } from "@/data/mock-data";
import { toast } from "@/hooks/use-toast";

export function ParkingFluxModule() {
  const [places] = useState(parkingPlacesMock);
  const total = places.length;
  const occupees = places.filter(p => p.occupee).length;
  const libres = total - occupees;
  const pct = Math.round((occupees / total) * 100);

  // Simulated trend: rising if occupancy > 60%
  const isRising = pct > 60;

  // Gauge arc math
  const radius = 58;
  const stroke = 10;
  const circumference = Math.PI * radius; // semi-circle
  const offset = circumference - (pct / 100) * circumference;

  // Color based on occupancy
  const gaugeColor =
    pct >= 90 ? "hsl(0, 84%, 60%)" : pct >= 60 ? "hsl(45, 90%, 55%)" : "hsl(160, 89%, 30%)";

  const handleBarriere = () => {
    toast({ title: "Barrière ouverte", description: "La barrière d'entrée a été activée (simulation)." });
  };

  const handleComplet = () => {
    toast({ title: "Parking signalé complet", description: "Les bénévoles aux entrées ont été notifiés.", variant: "destructive" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="bento-card flex flex-col items-center"
    >
      {/* Header */}
      <div className="flex w-full items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-emerald">
            <Car className="h-4 w-4 text-primary-foreground" />
          </div>
          <h3 className="text-sm font-semibold">Gestion Flux Parking</h3>
        </div>
        <Badge
          variant={isRising ? "destructive" : "secondary"}
          className="flex items-center gap-1 text-xs"
        >
          {isRising ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {isRising ? "En hausse" : "En baisse"}
        </Badge>
      </div>

      {/* Radial Gauge */}
      <div className="relative my-2">
        <svg width="140" height="80" viewBox="0 0 140 80">
          {/* Background arc */}
          <path
            d="M 12 76 A 58 58 0 0 1 128 76"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <motion.path
            d="M 12 76 A 58 58 0 0 1 128 76"
            fill="none"
            stroke={gaugeColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-2xl font-bold tabular-nums">{occupees}/{total}</span>
          <span className="text-[10px] text-muted-foreground">places occupées</span>
        </div>
      </div>

      {/* Segmented bar */}
      <div className="w-full flex gap-0.5 rounded-full overflow-hidden h-2 mt-2">
        {(['A', 'B', 'C'] as const).map((zone) => {
          const zPlaces = places.filter(p => p.zone === zone);
          const zOcc = zPlaces.filter(p => p.occupee).length;
          const zPct = (zOcc / zPlaces.length) * 100;
          return (
            <div key={zone} className="flex-1 relative bg-muted rounded-full overflow-hidden" title={`Zone ${zone}: ${zOcc}/${zPlaces.length}`}>
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ backgroundColor: gaugeColor }}
                initial={{ width: 0 }}
                animate={{ width: `${zPct}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex w-full justify-between text-[10px] text-muted-foreground mt-1 px-1">
        <span>Zone A</span>
        <span>Zone B</span>
        <span>Zone C</span>
      </div>

      {/* Libres indicator */}
      <p className="text-sm mt-3">
        <span className="font-semibold text-primary">{libres}</span>{" "}
        <span className="text-muted-foreground">places libres</span>
      </p>

      {/* Action buttons */}
      <div className="flex w-full gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
          onClick={handleBarriere}
        >
          <DoorOpen className="h-3.5 w-3.5" />
          Ouvrir Barrière
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={handleComplet}
        >
          <OctagonAlert className="h-3.5 w-3.5" />
          Parking Complet
        </Button>
      </div>
    </motion.div>
  );
}
