import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  Building2,
  LayoutDashboard,
  Package,
  CalendarDays,
  HandCoins,
  Users,
  Calendar,
  Car,
  Wrench,
  Shield,
  ClipboardList,
  UserCheck,
  Settings2,
  UsersRound,
  SlidersHorizontal,
  ChevronDown,
  BookOpen,
  Heart,
  Radio,
  Landmark,
  Truck,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useRole, type UserRole } from "@/contexts/RoleContext";
import type { Pole } from "@/types/amm";

// Simulation SaaS — sera remplacé dynamiquement par org.active_poles via OrganizationContext
// Garde comme fallback si org non chargée
const FALLBACK_ACTIVE_POLES = ["gouvernance", "logistique"];

const POLES: Pole[] = ["Imam", "École (Avenir)", "Social (ABD)", "Accueil", "Récolte", "Digital", "Com", "Parking"];

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles: UserRole[];
}

interface PoleCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

const POLE_CATEGORIES: PoleCategory[] = [
  {
    id: "gouvernance",
    label: "Gouvernance",
    icon: Landmark,
    items: [
      { title: "Tableau de bord", url: "/", icon: LayoutDashboard, roles: ["Admin", "Imam/Chef de Pôle", "Bénévole"] },
      { title: "Organisation", url: "/organisation", icon: Building2, roles: ["Admin"] },
      { title: "Récoltes", url: "/recoltes", icon: HandCoins, roles: ["Admin"] },
    ],
  },
  {
    id: "logistique",
    label: "Logistique",
    icon: Truck,
    items: [
      { title: "Planning", url: "/planning", icon: CalendarDays, roles: ["Admin", "Imam/Chef de Pôle"] },
      { title: "Événements", url: "/evenements", icon: Calendar, roles: ["Admin", "Imam/Chef de Pôle"] },
      { title: "Inventaire", url: "/inventaire", icon: Package, roles: ["Admin", "Imam/Chef de Pôle"] },
      { title: "Parking", url: "/parking", icon: Car, roles: ["Admin"] },
      { title: "Maintenance", url: "/maintenance", icon: Wrench, roles: ["Admin"] },
      { title: "Configuration", url: "/configuration", icon: SlidersHorizontal, roles: ["Admin"] },
    ],
  },
  {
    id: "education",
    label: "Éducation",
    icon: BookOpen,
    items: [],
  },
  {
    id: "social",
    label: "Social",
    icon: Heart,
    items: [],
  },
  {
    id: "communication",
    label: "Communication",
    icon: Radio,
    items: [],
  },
];

// Items hors pôles (toujours visibles selon rôle)
const STANDALONE_ITEMS: NavItem[] = [
  { title: "Approbations", url: "/approbations", icon: UserCheck, roles: ["Admin", "Imam/Chef de Pôle"] },
  { title: "Opérations", url: "/operations", icon: Settings2, roles: ["Admin", "Imam/Chef de Pôle"] },
  { title: "Mon Agenda", url: "/mon-agenda", icon: CalendarDays, roles: ["Bénévole"] },
  { title: "Mes Missions", url: "/missions", icon: ClipboardList, roles: ["Bénévole"] },
  { title: "Mon Équipe", url: "/mon-equipe", icon: Users, roles: ["Imam/Chef de Pôle"] },
];

const roleIcons: Record<UserRole, React.ElementType> = {
  "Admin": Shield,
  "Imam/Chef de Pôle": UserCheck,
  "Bénévole": Users,
};

export function AppSidebar() {
  const location = useLocation();
  const { role, setRole, pole, setPole } = useRole();
  const { activePoles, org } = useOrganization();

  // Fallback sur la constante locale si le context n'a pas encore chargé
  const effectiveActivePoles = activePoles.length > 0 ? activePoles : FALLBACK_ACTIVE_POLES;

  const isPathInCategory = (items: NavItem[]) =>
    items.some((item) =>
      item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url)
    );

  const defaultOpenMap = POLE_CATEGORIES.reduce<Record<string, boolean>>((acc, cat) => {
    acc[cat.id] = isPathInCategory(cat.items);
    return acc;
  }, {});

  const [openCats, setOpenCats] = useState<Record<string, boolean>>(defaultOpenMap);

  const toggleCat = (id: string) =>
    setOpenCats((prev) => ({ ...prev, [id]: !prev[id] }));

  const standaloneVisible = STANDALONE_ITEMS.filter((i) => i.roles.includes(role));

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-emerald">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-primary-foreground tracking-tight">
              {org?.name ?? "AMM Ops"}
            </h1>
            <p className="text-xs text-sidebar-foreground/60">
              Mosquée R+4
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 gap-0">
        {/* Standalone items (Agenda, Missions, Equipe...) */}
        {standaloneVisible.length > 0 && (
          <SidebarGroup className="py-2">
            <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-1">
              Personnel
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {standaloneVisible.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Pôles Métiers */}
        <div className="py-2">
          <p className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-2 px-2">
            Pôles Métiers
          </p>
          <div className="space-y-0.5">
            {POLE_CATEGORIES.map((cat) => {
              const isActive = effectiveActivePoles.includes(cat.id);
              const visibleItems = cat.items.filter((i) => i.roles.includes(role));
              const isOpen = openCats[cat.id] ?? false;
              const hasActiveRoute = isPathInCategory(cat.items);

              return (
                <Collapsible
                  key={cat.id}
                  open={isOpen}
                  onOpenChange={() => isActive && toggleCat(cat.id)}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "cursor-pointer hover:bg-sidebar-accent/60 text-sidebar-foreground"
                          : "cursor-default opacity-35 text-sidebar-foreground/60",
                        hasActiveRoute && isActive && "text-sidebar-primary font-medium"
                      )}
                    >
                      <cat.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{cat.label}</span>
                      {isActive && cat.items.length > 0 && (
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40 transition-transform duration-200",
                            isOpen && "rotate-180"
                          )}
                        />
                      )}
                      {!isActive && (
                        <span className="text-[9px] uppercase tracking-wide text-sidebar-foreground/30 border border-sidebar-foreground/20 rounded px-1 py-0.5">
                          inactif
                        </span>
                      )}
                    </button>
                  </CollapsibleTrigger>

                  {isActive && visibleItems.length > 0 && (
                    <CollapsibleContent>
                      <SidebarMenu className="ml-3 mt-0.5 border-l border-sidebar-border/40 pl-3">
                        {visibleItems.map((item) => (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild>
                              <NavLink
                                to={item.url}
                                end={item.url === "/"}
                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                              >
                                <item.icon className="h-3.5 w-3.5" />
                                <span>{item.title}</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </CollapsibleContent>
                  )}

                  {isActive && cat.items.length === 0 && (
                    <CollapsibleContent>
                      <p className="ml-6 mt-1 mb-2 text-[11px] text-sidebar-foreground/30 italic border-l border-sidebar-border/40 pl-3 py-1">
                        Aucun module actif
                      </p>
                    </CollapsibleContent>
                  )}
                </Collapsible>
              );
            })}
          </div>
        </div>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-3">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-medium px-1">
            Rôle actif
          </label>
          <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
            <SelectTrigger className="h-9 text-xs bg-sidebar-accent/50 border-sidebar-accent text-sidebar-foreground">
              <div className="flex items-center gap-2">
                {React.createElement(roleIcons[role], { className: "h-3.5 w-3.5 text-sidebar-foreground/60" })}
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Admin">Admin</SelectItem>
              <SelectItem value="Imam/Chef de Pôle">Imam / Chef de Pôle</SelectItem>
              <SelectItem value="Bénévole">Bénévole</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {role === "Imam/Chef de Pôle" && (
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-medium px-1">
              Mon Pôle
            </label>
            <Select value={pole} onValueChange={(v) => setPole(v as Pole)}>
              <SelectTrigger className="h-9 text-xs bg-sidebar-accent/50 border-sidebar-accent text-sidebar-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="rounded-lg bg-sidebar-accent/50 p-3">
          <p className="text-xs text-sidebar-foreground/50">
            Complexe AMM — Bâtiment R+4
          </p>
          <p className="text-xs text-sidebar-foreground/30 mt-1">
            v1.0 · Micro-ERP
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
