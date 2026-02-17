import { useState } from "react";
import { motion } from "framer-motion";
import { Etage } from "@/types/amm";
import { DashboardStats } from "@/components/DashboardStats";
import { FloorPlan } from "@/components/FloorPlan";
import { FloorContextHeader } from "@/components/FloorContextHeader";
import { FloorMiniStats } from "@/components/FloorMiniStats";
import { ReservationsToday } from "@/components/ReservationsToday";
import { InventaireSummary } from "@/components/InventaireSummary";
import { RecolteSummary } from "@/components/RecolteSummary";
import { QuickActions } from "@/components/QuickActions";
import { MaintenanceWidget } from "@/components/MaintenanceWidget";
import { ParkingFluxModule } from "@/components/ParkingFluxModule";
import { CommandPalette } from "@/components/CommandPalette";
import { NotificationBell } from "@/components/NotificationBell";
import { WeatherPrayerWidget } from "@/components/WeatherPrayerWidget";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function Dashboard() {
  const [selectedEtage, setSelectedEtage] = useState<Etage>('RDC');

  return (
    <div className="flex-1 overflow-auto">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 backdrop-blur-sm px-6 py-4">
        <SidebarTrigger />
        <div className="flex-1">
          <h2 className="text-lg font-semibold tracking-tight">Tableau de bord</h2>
          <p className="text-sm text-muted-foreground">
            Bienvenue sur AMM Ops — Vue d'ensemble du complexe
          </p>
        </div>
        <div className="flex items-center gap-3">
          <WeatherPrayerWidget />
          <CommandPalette />
          <NotificationBell />
        </div>
      </header>

      <main className="p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <DashboardStats selectedEtage={selectedEtage} />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <FloorContextHeader selectedEtage={selectedEtage} onEtageChange={setSelectedEtage} />
            <FloorMiniStats selectedEtage={selectedEtage} />
            <FloorPlan selectedEtage={selectedEtage} />
          </div>
          <div className="space-y-6">
            <ReservationsToday />
          </div>
        </div>

        <ParkingFluxModule />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InventaireSummary />
          <MaintenanceWidget />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RecolteSummary />
        </div>
      </main>

      <QuickActions />
    </div>
  );
}
