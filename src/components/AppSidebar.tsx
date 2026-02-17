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

const navItems = [
  { title: "Tableau de bord", url: "/", icon: LayoutDashboard },
  { title: "Planning", url: "/planning", icon: CalendarDays },
  { title: "Événements", url: "/evenements", icon: Calendar },
  { title: "Inventaire", url: "/inventaire", icon: Package },
  { title: "Parking", url: "/parking", icon: Car },
  { title: "Maintenance", url: "/maintenance", icon: Wrench },
  { title: "Récoltes", url: "/recoltes", icon: HandCoins },
  { title: "Pôles", url: "/poles", icon: Users },
];

export function AppSidebar() {
  const location = useLocation();

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
              {navItems.map((item) => (
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

      <SidebarFooter className="p-4">
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
