import { motion } from "framer-motion";
import {
  Package,
  HandCoins,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Users,
  Calendar,
  Box,
} from "lucide-react";
import { sallesMock, materielMock, recoltesMock, reservationsMock, evenementsMock } from "@/data/mock-data";
import { Etage, Pole } from "@/types/amm";
import { useRole } from "@/contexts/RoleContext";

interface DashboardStatsProps {
  selectedEtage: Etage;
}

export function DashboardStats({ selectedEtage }: DashboardStatsProps) {
  const { role, pole } = useRole();
  const isChef = role === "Imam/Chef de Pôle";

  // ---------- Admin / default stats ----------
  const sallesEtage = sallesMock.filter(s => s.etage === selectedEtage);
  const sallesOccupees = sallesEtage.filter(s => s.statut === 'occupée' || s.statut === 'réservée').length;
  const sallesTotal = sallesEtage.length;
  const tauxOccupation = sallesTotal > 0 ? Math.round((sallesOccupees / sallesTotal) * 100) : 0;

  const totalRecolte = recoltesMock.reduce((sum, r) => sum + r.montant, 0);

  const materielAlerte = materielMock.filter(m => m.quantiteDisponible / m.quantiteTotal < 0.3).length;

  const benevolesConfirmes = 12;
  const benevolesRequis = 18;
  const staffingRatio = Math.round((benevolesConfirmes / benevolesRequis) * 100);

  // ---------- Chef de Pôle stats ----------
  const poleEvenements = evenementsMock.filter(e => e.pole === pole);
  const poleReservations = reservationsMock.filter(r => r.pole === pole);

  const poleBenevolesTotal = poleEvenements.reduce((sum, e) => sum + e.benevoles.length, 0);
  const poleBenevolesConfirmes = poleEvenements.reduce((sum, e) => sum + e.benevoles.filter(b => b.confirme).length, 0);
  const poleStaffing = poleBenevolesTotal > 0 ? Math.round((poleBenevolesConfirmes / poleBenevolesTotal) * 100) : 0;

  const poleMaterielReserve = poleReservations.reduce((sum, r) => sum + (r.materiel?.reduce((s, m) => s + m.quantite, 0) ?? 0), 0)
    + poleEvenements.reduce((sum, e) => sum + e.materiel.reduce((s, m) => s + m.quantite, 0), 0);

  const adminStats = [
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

  const chefStats = [
    {
      label: "Mes Événements",
      value: poleEvenements.length.toString(),
      sub: `Sessions prévues · Pôle ${pole}`,
      icon: Calendar,
      variant: "highlight" as const,
    },
    {
      label: "Taux de Staffing",
      value: `${poleBenevolesConfirmes}/${poleBenevolesTotal}`,
      sub: `${poleStaffing}% confirmés`,
      icon: Users,
      variant: poleStaffing < 70 ? "warning" as const : "highlight" as const,
      progress: poleStaffing,
    },
    {
      label: "Ressources Réservées",
      value: poleMaterielReserve.toString(),
      sub: "Assets bloqués pour mon pôle",
      icon: Box,
      variant: "default" as const,
    },
    {
      label: "Réservations",
      value: poleReservations.length.toString(),
      sub: "Créneaux réservés ce mois",
      icon: BarChart3,
      variant: "default" as const,
    },
  ];

  const stats = isChef ? chefStats : adminStats;

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
          {'progress' in stat && stat.progress !== undefined && (
            <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stat.progress}%` }}
                transition={{ delay: 0.4 + i * 0.08, duration: 0.6 }}
                className={`h-full rounded-full ${
                  stat.progress < 50 ? 'bg-destructive' : 'bg-primary'
                }`}
              />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
