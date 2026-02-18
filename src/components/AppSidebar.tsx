import React from "react";
import { useLocation } from "react-router-dom";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRole, type UserRole } from "@/contexts/RoleContext";
import type { Pole } from "@/types/amm";

const POLES: Pole[] = ["Imam", "École (Avenir)", "Social (ABD)", "Accueil", "Récolte", "Digital", "Com", "Parking"];

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { title: "Tableau de bord", url: "/", icon: LayoutDashboard, roles: ["Admin", "Imam/Chef de Pôle", "Bénévole"] },
  { title: "Planning", url: "/planning", icon: CalendarDays, roles: ["Admin", "Imam/Chef de Pôle"] },
  { title: "Mon Agenda", url: "/mon-agenda", icon: CalendarDays, roles: ["Bénévole"] },
  { title: "Événements", url: "/evenements", icon: Calendar, roles: ["Admin", "Imam/Chef de Pôle"] },
  { title: "Approbations", url: "/approbations", icon: UserCheck, roles: ["Admin", "Imam/Chef de Pôle"] },
  { title: "Opérations", url: "/operations", icon: Settings2, roles: ["Admin", "Imam/Chef de Pôle"] },
  { title: "Inventaire", url: "/inventaire", icon: Package, roles: ["Admin", "Imam/Chef de Pôle"] },
  { title: "Parking", url: "/parking", icon: Car, roles: ["Admin"] },
  { title: "Maintenance", url: "/maintenance", icon: Wrench, roles: ["Admin"] },
  { title: "Récoltes", url: "/recoltes", icon: HandCoins, roles: ["Admin"] },
  { title: "Organisation", url: "/organisation", icon: Building2, roles: ["Admin"] },
  { title: "Configuration", url: "/configuration", icon: SlidersHorizontal, roles: ["Admin"] },
  { title: "Mon Équipe", url: "/mon-equipe", icon: Users, roles: ["Imam/Chef de Pôle"] },
  { title: "Mes Missions", url: "/missions", icon: ClipboardList, roles: ["Bénévole"] },
];

const roleIcons: Record<UserRole, React.ElementType> = {
  "Admin": Shield,
  "Imam/Chef de Pôle": UserCheck,
  "Bénévole": Users,
};

export function AppSidebar() {
  const location = useLocation();
  const { role, setRole, pole, setPole } = useRole();

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-emerald">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-primary-foreground tracking-tight">
              AMM Ops
            </h1>
            <p className="text-xs text-sidebar-foreground/60">
              Mosquée R+4
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-xs uppercase tracking-wider">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
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
