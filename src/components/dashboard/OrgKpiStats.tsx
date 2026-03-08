import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, GraduationCap, HandCoins, Calendar, BarChart3, Box, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useRole } from "@/contexts/RoleContext";
import { Skeleton } from "@/components/ui/skeleton";

interface StatCard {
  label: string;
  value: string;
  sub: string;
  icon: typeof Users;
  variant: "default" | "highlight" | "warning";
  progress?: number;
}

export function OrgKpiStats() {
  const { orgId, activePoles } = useOrganization();
  const { role } = useRole();
  const isAdmin = role === "Admin Mosquée" || role === "Super Admin";
  const isChef = role === "Responsable";

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-kpis", orgId, role],
    enabled: !!orgId,
    queryFn: async () => {
      const [
        { count: membersCount },
        { count: eventsCount },
        { data: donations },
        { count: studentsCount },
        { count: roomsCount },
        { data: roomsOccupied },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("org_id", orgId!),
        supabase.from("events").select("*", { count: "exact", head: true }).eq("org_id", orgId!),
        supabase.from("donations").select("montant").eq("org_id", orgId!),
        supabase.from("madrasa_students").select("*", { count: "exact", head: true }).eq("org_id", orgId!),
        supabase.from("rooms").select("*", { count: "exact", head: true }).eq("org_id", orgId!),
        supabase.from("rooms").select("statut").eq("org_id", orgId!).in("statut", ["occupée", "réservée"]),
      ]);

      const totalDonations = (donations ?? []).reduce((sum, d) => sum + Number(d.montant), 0);
      const occupiedRooms = roomsOccupied?.length ?? 0;
      const totalRooms = roomsCount ?? 0;
      const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

      return {
        members: membersCount ?? 0,
        events: eventsCount ?? 0,
        totalDonations,
        students: studentsCount ?? 0,
        totalRooms,
        occupiedRooms,
        occupancyRate,
      };
    },
  });

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const buildAdminStats = (): StatCard[] => {
    const cards: StatCard[] = [
      {
        label: "Taux d'occupation",
        value: `${stats.occupancyRate}%`,
        sub: `${stats.occupiedRooms}/${stats.totalRooms} salles occupées`,
        icon: BarChart3,
        variant: stats.occupancyRate > 80 ? "warning" : "default",
        progress: stats.occupancyRate,
      },
      {
        label: "Membres actifs",
        value: stats.members.toString(),
        sub: "Profils rattachés à l'institution",
        icon: Users,
        variant: "highlight",
      },
    ];

    if (activePoles.includes("finance") || activePoles.includes("social")) {
      cards.push({
        label: "Total récolté",
        value: `${(stats.totalDonations / 1000).toFixed(1)}k €`,
        sub: "Dons enregistrés",
        icon: HandCoins,
        variant: "highlight",
      });
    }

    if (activePoles.includes("education")) {
      cards.push({
        label: "Élèves inscrits",
        value: stats.students.toString(),
        sub: "Programme Madrasa",
        icon: GraduationCap,
        variant: "default",
      });
    }

    if (!activePoles.includes("finance") && !activePoles.includes("social")) {
      cards.push({
        label: "Événements",
        value: stats.events.toString(),
        sub: "Sessions programmées",
        icon: Calendar,
        variant: "default",
      });
    }

    if (!activePoles.includes("education")) {
      cards.push({
        label: "Événements",
        value: stats.events.toString(),
        sub: "Sessions programmées",
        icon: Calendar,
        variant: "default",
      });
    }

    return cards.slice(0, 4);
  };

  const buildChefStats = (): StatCard[] => [
    {
      label: "Événements du pôle",
      value: stats.events.toString(),
      sub: "Sessions prévues",
      icon: Calendar,
      variant: "highlight",
    },
    {
      label: "Membres",
      value: stats.members.toString(),
      sub: "Profils actifs",
      icon: Users,
      variant: "default",
    },
    {
      label: "Salles",
      value: `${stats.occupiedRooms}/${stats.totalRooms}`,
      sub: `${stats.occupancyRate}% d'occupation`,
      icon: Box,
      variant: stats.occupancyRate > 80 ? "warning" : "default",
      progress: stats.occupancyRate,
    },
    {
      label: "Événements total",
      value: stats.events.toString(),
      sub: "Créneaux réservés",
      icon: BarChart3,
      variant: "default",
    },
  ];

  const cards = isChef ? buildChefStats() : buildAdminStats();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((stat, i) => (
        <motion.div
          key={stat.label + i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.35 }}
          className={`bento-card group ${
            stat.variant === "highlight"
              ? "gradient-emerald-subtle border-primary/20"
              : stat.variant === "warning"
              ? "border-destructive/20 bg-destructive/5"
              : ""
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                {stat.variant === "highlight" && <TrendingUp className="h-3 w-3 text-primary" />}
                {stat.sub}
              </p>
            </div>
            <div
              className={`rounded-lg p-2.5 ${
                stat.variant === "highlight"
                  ? "bg-primary/10"
                  : stat.variant === "warning"
                  ? "bg-destructive/10"
                  : "bg-muted"
              }`}
            >
              <stat.icon
                className={`h-5 w-5 ${
                  stat.variant === "highlight"
                    ? "text-primary"
                    : stat.variant === "warning"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              />
            </div>
          </div>
          {stat.progress !== undefined && (
            <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stat.progress}%` }}
                transition={{ delay: 0.4 + i * 0.08, duration: 0.6 }}
                className={`h-full rounded-full ${stat.progress < 50 ? "bg-destructive" : "bg-primary"}`}
              />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
