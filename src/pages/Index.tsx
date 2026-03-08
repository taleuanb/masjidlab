import masjidLabLogo from "@/assets/masjidlab-logo.png";
import { motion } from "framer-motion";
import { CommandPalette } from "@/components/CommandPalette";
import { NotificationBell } from "@/components/NotificationBell";
import { WeatherPrayerWidget } from "@/components/WeatherPrayerWidget";
import { QuickActions } from "@/components/QuickActions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

import { DashboardErrorState } from "@/components/dashboard/DashboardShell";
import { OrgKpiStats } from "@/components/dashboard/OrgKpiStats";
import { RoomsOccupancyWidget } from "@/components/dashboard/RoomsOccupancyWidget";
import { EventsTimelineWidget } from "@/components/dashboard/EventsTimelineWidget";
import { FinanceWidget } from "@/components/dashboard/FinanceWidget";
import { AssetsWidget } from "@/components/dashboard/AssetsWidget";
import { EducationWidget } from "@/components/dashboard/EducationWidget";

export default function Dashboard() {
  const { role, isSuperAdmin } = useRole();
  const { impersonatedUser } = useAuth();
  const { orgId, activePoles, loading: orgLoading } = useOrganization();

  const isAdmin = role === "Admin Mosquée" || role === "Super Admin" || isSuperAdmin;
  const isChef = role === "Responsable";
  const isEnseignant = role === "Enseignant / Oustaz";

  const hasFinance = activePoles.includes("finance") || activePoles.includes("social");
  const hasEducation = activePoles.includes("education");
  const hasLogistics = activePoles.includes("logistics") || activePoles.includes("logistique");

  // Org guard
  if (!orgLoading && !orgId) {
    return <DashboardErrorState />;
  }

  return (
    <div className="flex-1 overflow-auto">
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-6 py-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2.5">
            <img src={masjidLabLogo} alt="MasjidLab" className="h-8 w-8 object-contain" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold tracking-tight text-foreground leading-none">MASJIDLAB</h2>
              <p className="text-[10px] text-muted-foreground italic leading-tight mt-0.5">
                Gérez l'organisation, élevez les cœurs.
              </p>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <WeatherPrayerWidget />
            <CommandPalette />
            <NotificationBell />
          </div>
        </div>

        {/* Bloc spirituel — visible sauf Responsable */}
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
        {/* KPIs — visible pour tous sauf enseignant */}
        {!isEnseignant && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <OrgKpiStats />
          </motion.div>
        )}

        {/* ── Admin / Responsable : Salles + Timeline ── */}
        {(isAdmin || isChef) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RoomsOccupancyWidget />
            </div>
            <div>
              <EventsTimelineWidget />
            </div>
          </div>
        )}

        {/* ── Enseignant : Timeline seule ── */}
        {isEnseignant && (
          <div className="max-w-2xl">
            <EventsTimelineWidget />
          </div>
        )}

        {/* ── Widgets métier conditionnels ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {hasFinance && (isAdmin || isChef) && <FinanceWidget />}
          {hasLogistics && (isAdmin || isChef) && <AssetsWidget />}
        </div>

        {hasEducation && (isAdmin || isChef) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <EducationWidget />
          </div>
        )}
      </main>

      <QuickActions />
    </div>
  );
}
