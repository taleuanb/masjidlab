import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, ChevronDown, Wifi, Mic, Snowflake, Monitor, Speaker, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const FLOORS = [
  { value: "RDC", label: "Rez-de-chaussée" },
  { value: "1", label: "1er étage" },
  { value: "2", label: "2ème étage" },
  { value: "3", label: "3ème étage" },
  { value: "EXT", label: "Extérieur" },
];

const statutColors: Record<string, string> = {
  disponible: "bg-primary/15 border-primary/30",
  occupée: "bg-destructive/10 border-destructive/25",
  réservée: "bg-accent/15 border-accent/30",
  maintenance: "bg-muted border-muted-foreground/20",
};

const statutDots: Record<string, string> = {
  disponible: "bg-primary",
  occupée: "bg-destructive",
  réservée: "bg-accent",
  maintenance: "bg-muted-foreground/50",
};

const equipementInfo: Record<string, { icon: typeof Wifi; label: string }> = {
  wifi: { icon: Wifi, label: "Wifi" },
  micro: { icon: Mic, label: "Micro" },
  clim: { icon: Snowflake, label: "Clim" },
  vidéoprojecteur: { icon: Monitor, label: "Vidéo" },
  sono: { icon: Speaker, label: "Sono" },
};

export function RoomsOccupancyWidget() {
  const { orgId } = useOrganization();
  const [floor, setFloor] = useState("RDC");

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["dashboard-rooms", orgId, floor],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("rooms")
        .select("id, floor, name, type, capacity, features, statut, pole")
        .eq("org_id", orgId!)
        .eq("floor", floor)
        .order("name");
      return data ?? [];
    },
  });

  const salles = rooms ?? [];
  const occupees = salles.filter((s) => s.statut === "occupée" || s.statut === "réservée").length;

  return (
    <div className="bento-card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Salles & Occupation</h3>
          <p className="text-xs text-muted-foreground">
            {isLoading ? "Chargement…" : `${occupees}/${salles.length} occupées`}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent">
              <Building2 className="h-4 w-4 text-primary" />
              {FLOORS.find((f) => f.value === floor)?.label ?? floor}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {FLOORS.map((f) => (
              <DropdownMenuItem key={f.value} onClick={() => setFloor(f.value)} className={floor === f.value ? "bg-accent font-medium" : ""}>
                {f.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {["disponible", "occupée", "réservée", "maintenance"].map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${statutDots[s]}`} />
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </span>
        ))}
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Occupation", value: `${occupees}/${salles.length}`, variant: occupees === salles.length ? "destructive" as const : "secondary" as const },
          { label: "Capacité", value: `${salles.reduce((s, r) => s + r.capacity, 0)} places`, variant: "outline" as const },
          { label: "Alertes", value: `${salles.filter((r) => r.statut === "maintenance").length} ticket(s)`, variant: salles.some((r) => r.statut === "maintenance") ? "destructive" as const : "secondary" as const },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2 rounded-xl border bg-card p-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground truncate">{s.label}</p>
              <Badge variant={s.variant} className="text-xs px-2 py-0 mt-0.5">{s.value}</Badge>
            </div>
          </div>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={floor} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }} className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {salles.map((salle, i) => (
              <motion.button
                key={salle.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
                className={`group relative rounded-xl border-2 p-4 text-left transition-all hover:shadow-lg hover:-translate-y-0.5 ${statutColors[salle.statut] || "bg-muted border-border"}`}
              >
                <p className="text-sm font-medium truncate">{salle.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{salle.type}</p>
                {salle.features?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {salle.features.map((eq) => {
                      const info = equipementInfo[eq];
                      if (!info) return null;
                      const { icon: Icon, label } = info;
                      return (
                        <Tooltip key={eq}>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              <Icon className="h-3 w-3" />{label}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-muted-foreground">{salle.capacity} places</span>
                  {salle.pole && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{salle.pole}</span>
                  )}
                </div>
              </motion.button>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {!isLoading && salles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Monitor className="h-8 w-8 mb-2" />
          <p className="text-sm font-medium">Aucune salle configurée</p>
          <p className="text-xs mt-1">Cet étage n'a pas encore de salles</p>
        </div>
      )}
    </div>
  );
}
