import { motion } from "framer-motion";
import {
  DoorOpen,
  Package,
  HandCoins,
  CalendarCheck,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Users,
} from "lucide-react";
import { sallesMock, materielMock, recoltesMock, reservationsMock } from "@/data/mock-data";
import { Etage } from "@/types/amm";

interface DashboardStatsProps {
  selectedEtage: Etage;
}

export function DashboardStats({ selectedEtage }: DashboardStatsProps) {
  const sallesEtage = sallesMock.filter(s => s.etage === selectedEtage);
  const sallesOccupees = sallesEtage.filter(s => s.statut === 'occupée' || s.statut === 'réservée').length;
  const sallesTotal = sallesEtage.length;
  const tauxOccupation = sallesTotal > 0 ? Math.round((sallesOccupees / sallesTotal) * 100) : 0;

  const totalRecolte = recoltesMock.reduce((sum, r) => sum + r.montant, 0);
  const reservationsJour = reservationsMock.length;

  const materielAlerte = materielMock.filter(m => m.quantiteDisponible / m.quantiteTotal < 0.3).length;

  // Mock staffing data
  const benevolesConfirmes = 12;
  const benevolesRequis = 18;
  const staffingRatio = Math.round((benevolesConfirmes / benevolesRequis) * 100);

  const stats = [
    {
      label: "Taux d'occupation",
      value: `${tauxOccupation}%`,
      sub: `${sallesOccupees}/${sallesTotal} salles · Étage ${selectedEtage === 'RDC' ? 'RDC' : selectedEtage}`,
      icon: BarChart3,
      variant: tauxOccupation > 80 ? "warning" as const : "default" as const,
      progress: tauxOccupation,
    },
    {
      label: "Staffing du jour",
      value: `${benevolesConfirmes}/${benevolesRequis}`,
      sub: `${staffingRatio}% des bénévoles confirmés`,
      icon: Users,
      variant: staffingRatio < 70 ? "warning" as const : "highlight" as const,
      progress: staffingRatio,
    },
    {
      label: "Total récolté (mois)",
      value: `${(totalRecolte / 1000).toFixed(1)}k €`,
      sub: "+12% vs mois dernier",
      icon: HandCoins,
      variant: "highlight" as const,
    },
    {
      label: "Matériel en alerte",
      value: materielAlerte.toString(),
      sub: "Stock < 30%",
      icon: materielAlerte > 0 ? AlertTriangle : Package,
      variant: materielAlerte > 0 ? ("warning" as const) : ("default" as const),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.35 }}
          className={`bento-card group ${
            stat.variant === 'highlight'
              ? 'gradient-emerald-subtle border-primary/20'
              : stat.variant === 'warning'
              ? 'border-destructive/20 bg-destructive/5'
              : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                {stat.variant === 'highlight' && <TrendingUp className="h-3 w-3 text-primary" />}
                {stat.sub}
              </p>
            </div>
            <div className={`rounded-lg p-2.5 ${
              stat.variant === 'highlight'
                ? 'bg-primary/10'
                : stat.variant === 'warning'
                ? 'bg-destructive/10'
                : 'bg-muted'
            }`}>
              <stat.icon className={`h-5 w-5 ${
                stat.variant === 'highlight'
                  ? 'text-primary'
                  : stat.variant === 'warning'
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              }`} />
            </div>
          </div>
          {/* Mini progress bar for occupation & staffing */}
          {'progress' in stat && stat.progress !== undefined && (
            <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stat.progress}%` }}
                transition={{ delay: 0.4 + i * 0.08, duration: 0.6 }}
                className={`h-full rounded-full ${
                  stat.progress < 50 ? 'bg-destructive' : stat.progress < 80 ? 'bg-primary' : 'bg-primary'
                }`}
              />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
