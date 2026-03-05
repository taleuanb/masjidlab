import { useState } from "react";
import masjidLabLogo from "@/assets/masjidlab-logo.png";
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
import { Separator } from "@/components/ui/separator";
import { useRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const [selectedEtage, setSelectedEtage] = useState<Etage>('RDC');
  const { role, pole, isSuperAdmin } = useRole();
  const { impersonatedUser } = useAuth();
  const isAdmin = role === "Admin Mosquée" || role === "Super Admin" || isSuperAdmin;
  const isChef = role === "Responsable";

  return (
    <div className="flex-1 overflow-auto">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        {/* Barre principale */}
        <div className="flex items-center gap-3 px-6 py-4">
          <SidebarTrigger />
          <div className="flex-1">
            <h2 className="text-xl font-semibold tracking-tight">
              {impersonatedUser ? `Tableau de bord — ${impersonatedUser.name}` : "Tableau de bord"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {impersonatedUser
                ? "Mode Ghost actif — Vue utilisateur"
                : isChef
                  ? `Vue Pôle ${pole} — Mes activités`
                  : "Bienvenue au service de la Maison d'Allah"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <WeatherPrayerWidget />
            <CommandPalette />
            <NotificationBell />
          </div>
        </div>

        {/* Bloc spirituel — Verset At-Tawba: 18 */}
        {!isChef && (
          <div className="px-6 pb-4 text-center space-y-1 mb-2">
            <p
              className="leading-relaxed"
              dir="rtl"
              style={{
                fontFamily: "'Amiri', 'Traditional Arabic', serif",
                fontSize: "1.35rem",
                color: "hsl(var(--primary))",
                lineHeight: "2",
              }}
            >
              إِنَّمَا يَعْمُرُ مَسَاجِدَ اللَّهِ مَنْ آمَنَ بِاللَّهِ وَالْيَوْمِ الْآخِرِ وَأَقَامَ الصَّلَاةَ وَآتَى الزَّكَاةَ وَلَمْ يَخْشَ إِلَّا اللَّهَ ۖ فَعَسَىٰ أُولَٰئِكَ أَن يَكُونُوا مِنَ الْمُهْتَدِينَ
            </p>
            <p className="text-sm text-muted-foreground italic max-w-2xl mx-auto">
              "Ne peupleront les mosquées d'Allah que ceux qui croient en Allah et au Jour dernier,
              accomplissent la Salât, acquittent la Zakât et ne craignent qu'Allah.
              Il se peut que ceux-là soient du nombre des bien-guidés." — <span className="not-italic font-medium">At-Tawba : 18</span>
            </p>
            <Separator className="mt-4" />
          </div>
        )}
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

        {isAdmin && <ParkingFluxModule />}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InventaireSummary />
          {isAdmin && <MaintenanceWidget />}
        </div>

        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RecolteSummary />
          </div>
        )}
      </main>

      <QuickActions />
    </div>
  );
}
