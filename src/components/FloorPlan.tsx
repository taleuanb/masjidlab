import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Wifi, Mic, Snowflake, Monitor, Speaker, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Etage, Equipement, StatutSalle } from "@/types/amm";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOrganization } from "@/contexts/OrganizationContext";

interface FloorPlanProps {
  selectedEtage: Etage;
}

interface RoomRow {
  id: string;
  floor: string;
  name: string;
  type: string;
  capacity: number;
  features: string[];
  statut: string;
  pole: string | null;
}

const statutColors: Record<string, string> = {
  disponible:  "bg-primary/15 border-primary/30",
  occupée:     "bg-destructive/10 border-destructive/25",
  réservée:    "bg-accent/15 border-accent/30",
  maintenance: "bg-muted border-muted-foreground/20",
};

const statutLabels: Record<string, string> = {
  disponible:  "Disponible",
  occupée:     "Occupée",
  réservée:    "Réservée",
  maintenance: "En maintenance",
};

/* Navy for Disponible, Cyan for Réservée */
const statutDots: Record<string, string> = {
  disponible:  "pastille-disponible",
  occupée:     "bg-destructive",
  réservée:    "pastille-reserve",
  maintenance: "bg-muted-foreground/50",
};

const equipementInfo: Record<string, { icon: typeof Wifi; label: string; tooltip: string }> = {
  wifi:            { icon: Wifi,      label: "Wifi",  tooltip: "Wifi — Connecté" },
  micro:           { icon: Mic,       label: "Micro", tooltip: "Micro sans fil — Disponible" },
  clim:            { icon: Snowflake, label: "Clim",  tooltip: "Climatisation — En marche" },
  vidéoprojecteur: { icon: Monitor,   label: "Vidéo", tooltip: "Vidéoprojecteur — Opérationnel" },
  sono:            { icon: Speaker,   label: "Sono",  tooltip: "Sonorisation — Active" },
};

export function FloorPlan({ selectedEtage }: FloorPlanProps) {
  const [salles, setSalles] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { orgId } = useOrganization();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    let query = supabase
      .from("rooms")
      .select("id, floor, name, type, capacity, features, statut, pole")
      .eq("floor", selectedEtage)
      .order("name");

    if (orgId) query = query.eq("org_id", orgId);

    query.then(({ data }) => {
      if (!cancelled) {
        setSalles((data || []) as RoomRow[]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [selectedEtage, orgId]);

  return (
    <div className="bento-card">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold">Plan de l'étage</h3>
          <p className="text-sm text-muted-foreground">
            {loading ? "Chargement…" : `${salles.length} salle${salles.length > 1 ? "s" : ""} · `}
            {selectedEtage === "RDC" ? "Rez-de-chaussée" : selectedEtage === "EXT" ? "Extérieur" : `${selectedEtage}${selectedEtage === "1" ? "er" : "ème"} étage`}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {(["disponible", "occupée", "réservée", "maintenance"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${statutDots[s]}`} />
              {statutLabels[s]}
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
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
                className={`group relative rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 ${statutColors[salle.statut] || "bg-muted border-border"}`}
              >
                <p className="text-sm font-medium truncate">{salle.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{salle.type}</p>

                {salle.features && salle.features.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {salle.features.map((eq) => {
                      const info = equipementInfo[eq];
                      if (!info) return null;
                      const { icon: Icon, label, tooltip } = info;
                      return (
                        <Tooltip key={eq}>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] text-muted-foreground cursor-help">
                              <Icon className="h-3 w-3" />
                              {label}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">{tooltip}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-muted-foreground">{salle.capacity} places</span>
                  {salle.pole && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                      {salle.pole}
                    </span>
                  )}
                </div>

                <div className="absolute inset-x-0 bottom-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pb-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-foreground/80 text-background px-3 py-1 text-[10px] font-medium shadow-md">
                    <Eye className="h-3 w-3" />Détails
                  </span>
                </div>
              </motion.button>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {!loading && salles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Monitor className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">Aucune salle configurée</p>
          <p className="text-xs mt-1">Cet étage n'a pas encore de salles enregistrées</p>
        </div>
      )}
    </div>
  );
}
