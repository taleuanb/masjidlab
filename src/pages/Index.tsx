import { Suspense, useMemo, useEffect, useState } from "react";
import masjidLabLogo from "@/assets/masjidlab-logo.png";
import { motion } from "framer-motion";
import { CommandPalette } from "@/components/CommandPalette";
import { NotificationBell } from "@/components/NotificationBell";
import { WeatherPrayerWidget } from "@/components/WeatherPrayerWidget";
import { QuickActions } from "@/components/QuickActions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { DashboardErrorState } from "@/components/dashboard/DashboardShell";
import { getVisibleWidgets, type WidgetDef, type DbWidgetConfig } from "@/config/widget-registry";
import { supabase } from "@/integrations/supabase/client";

// ── Section header ───────────────────────────────────────────────────
function SectionHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="text-lg">{emoji}</span>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <Separator className="flex-1" />
    </div>
  );
}

// ── Widget wrapper with Suspense ─────────────────────────────────────
function WidgetSlot({ widget, index }: { widget: WidgetDef; index: number }) {
  const colClass =
    widget.colSpan === 3
      ? "col-span-1 sm:col-span-2 lg:col-span-3"
      : widget.colSpan === 2
      ? "col-span-1 lg:col-span-2"
      : "";

  return (
    <motion.div
      className={colClass}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
        <widget.component />
      </Suspense>
    </motion.div>
  );
}

export default function Dashboard() {
  const { isSuperAdmin, userDbRoles, role } = useRole();
  const { impersonatedUser } = useAuth();
  const { orgId, activePoles, loading: orgLoading, org } = useOrganization();

  const isChef = role === "Responsable";

  // ── Resolve effective roles for widget filtering ──
  // When Super Admin previews a role, restrict widgets to that role only
  const isPreviewingRole = isSuperAdmin && !impersonatedUser && role !== "Super Admin";
  const effectiveRoles = isPreviewingRole
    ? [UI_ROLE_TO_DB[role] ?? "benevole"]
    : userDbRoles;
  const effectiveSuperAdmin = isSuperAdmin && !impersonatedUser && !isPreviewingRole;

  // ── Fetch DB widget configs ──
  const [dbConfigs, setDbConfigs] = useState<DbWidgetConfig[] | undefined>(undefined);
  useEffect(() => {
    supabase
      .from("saas_widget_configs")
      .select("widget_key, label, required_plans, allowed_roles, required_pole, priority, is_enabled")
      .then(({ data }) => {
        if (data && data.length > 0) setDbConfigs(data as DbWidgetConfig[]);
      });
  }, []);

  // ── Registry-driven filtering ──
  const visibleWidgets = useMemo(
    () => getVisibleWidgets(
      activePoles,
      userDbRoles,
      isSuperAdmin && !impersonatedUser,
      org?.subscription_plan,
      dbConfigs,
    ),
    [activePoles, userDbRoles, isSuperAdmin, impersonatedUser, org?.subscription_plan, dbConfigs],
  );

  // Group by section preserving weight order
  const sections = useMemo(() => {
    const map = new Map<string, { emoji: string; widgets: WidgetDef[] }>();
    for (const w of visibleWidgets) {
      if (!map.has(w.section)) {
        map.set(w.section, { emoji: w.sectionEmoji, widgets: [] });
      }
      map.get(w.section)!.widgets.push(w);
    }
    return Array.from(map.entries());
  }, [visibleWidgets]);

  if (!orgLoading && !orgId) {
    return <DashboardErrorState />;
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* ── Header ── */}
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
        {sections.map(([sectionName, { emoji, widgets }]) => (
          <section key={sectionName} className="space-y-4">
            {/* KPIs span full width without a section header */}
            {sectionName !== "Vue d'ensemble" && (
              <SectionHeader emoji={emoji} title={sectionName} />
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {widgets.map((w, i) => (
                <WidgetSlot key={w.id} widget={w} index={i} />
              ))}
            </div>
          </section>
        ))}

        {sections.length === 0 && !orgLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-sm font-medium">Aucun module activé pour votre profil</p>
            <p className="text-xs mt-1">Contactez l'administrateur pour accéder aux fonctionnalités.</p>
          </div>
        )}
      </main>

      <QuickActions />
    </div>
  );
}
