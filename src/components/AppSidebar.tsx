import { useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Building2,
  LayoutDashboard,
  Package,
  CalendarDays,
  HandCoins,
  Users,
  ChevronDown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { ETAGES } from "@/data/mock-data";
import { Etage } from "@/types/amm";
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
  { title: "Inventaire", url: "/inventaire", icon: Package },
  { title: "Planning", url: "/planning", icon: CalendarDays },
  { title: "Récoltes", url: "/recoltes", icon: HandCoins },
  { title: "Pôles", url: "/poles", icon: Users },
];

interface AppSidebarProps {
  selectedEtage: Etage;
  onEtageChange: (etage: Etage) => void;
}

export function AppSidebar({ selectedEtage, onEtageChange }: AppSidebarProps) {
  const [etageOpen, setEtageOpen] = useState(false);
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
        {/* Floor Selector */}
        <div className="mb-4">
          <button
            onClick={() => setEtageOpen(!etageOpen)}
            className="flex w-full items-center justify-between rounded-lg bg-sidebar-accent px-3 py-2.5 text-sm font-medium text-sidebar-accent-foreground transition-colors hover:bg-sidebar-accent/80"
          >
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-sidebar-primary" />
              {ETAGES.find(e => e.value === selectedEtage)?.label}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${etageOpen ? 'rotate-180' : ''}`} />
          </button>
          {etageOpen && (
            <div className="mt-1 space-y-0.5 rounded-lg bg-sidebar-accent/50 p-1">
              {ETAGES.map((etage) => (
                <button
                  key={etage.value}
                  onClick={() => {
                    onEtageChange(etage.value);
                    setEtageOpen(false);
                  }}
                  className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                    selectedEtage === etage.value
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                  }`}
                >
                  {etage.label}
                </button>
              ))}
            </div>
          )}
        </div>

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
