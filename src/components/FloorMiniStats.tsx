import { Users, Armchair, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { sallesMock, ticketsMock } from "@/data/mock-data";
import { Etage } from "@/types/amm";

interface FloorMiniStatsProps {
  selectedEtage: Etage;
}

export function FloorMiniStats({ selectedEtage }: FloorMiniStatsProps) {
  const salles = sallesMock.filter(s => s.etage === selectedEtage);
  const occupees = salles.filter(s => s.statut === 'occupée' || s.statut === 'réservée').length;
  const capaciteTotale = salles.reduce((sum, s) => sum + s.capacite, 0);

  // Map etage to localisation keyword for ticket matching
  const etageKeywords: Record<string, string> = {
    RDC: 'RDC',
    '1': '1er',
    '2': '2ème',
    '3': '3ème',
    '4': '4ème',
    EXT: 'Extérieur',
  };
  const keyword = etageKeywords[selectedEtage] || selectedEtage;
  const alertes = ticketsMock.filter(
    t => t.localisation.includes(keyword) && t.statut !== 'résolu'
  ).length;

  const stats = [
    {
      label: "Occupation Étage",
      value: `${occupees} / ${salles.length}`,
      icon: Users,
      badge: occupees === salles.length ? "destructive" as const : "secondary" as const,
    },
    {
      label: "Capacité d'accueil",
      value: `${capaciteTotale} places`,
      icon: Armchair,
      badge: "outline" as const,
    },
    {
      label: "Alertes Étage",
      value: `${alertes} ticket${alertes > 1 ? 's' : ''}`,
      icon: AlertTriangle,
      badge: alertes > 0 ? "destructive" as const : "secondary" as const,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-3 rounded-xl border bg-card p-3"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground truncate">{stat.label}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={stat.badge} className="text-xs px-2 py-0">
                {stat.value}
              </Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
