import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Building2, LayoutDashboard, Package, CalendarDays, HandCoins, Users,
  Calendar, Car, Wrench, Shield, ClipboardList, UserCheck, Settings2,
  SlidersHorizontal, ChevronDown, BookOpen, Heart, Radio, Landmark, Truck, Globe,
  LogOut, Eye, Wallet, CreditCard,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useRole, type UserRole } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";
import type { Pole } from "@/types/amm";

const POLES: Pole[] = ["Imam", "École (Avenir)", "Social (ABD)", "Accueil", "Récolte", "Digital", "Com", "Parking"];

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles: UserRole[];
}

interface NavBlock {
  id: string;
  label: string;
  icon: React.ElementType;
  poleIds: string[];
  blockRoles: UserRole[];
  items: NavItem[];
}

const ALL_ROLES: UserRole[] = ["Admin", "Chef de Pôle", "Responsable", "Bénévole", "Parent", "Élève"];
const ADMIN_ROLES: UserRole[] = ["Admin", "Responsable"];

// ── PILOTAGE ──────────────────────────────────────────────
const PILOTAGE_BLOCKS: NavBlock[] = [
  {
    id: "config",
    label: "Configuration",
    icon: SlidersHorizontal,
    poleIds: [],
    blockRoles: ["Admin", "Responsable"],
    items: [
      { title: "Espaces & Pôles", url: "/configuration", icon: SlidersHorizontal, roles: ["Admin", "Responsable"] },
    ],
  },
  {
    id: "gouvernance",
    label: "Structure & Membres",
    icon: Users,
    poleIds: ["admin"],
    blockRoles: ["Admin", "Responsable"],
    items: [
      { title: "Structure & Membres", url: "/structure-membres", icon: Users, roles: ["Admin", "Responsable"] },
    ],
  },
];

// ── MÉTIERS ───────────────────────────────────────────────
const METIER_BLOCKS: NavBlock[] = [
  {
    id: "operations",
    label: "Opérations & Planning",
    icon: Truck,
    poleIds: ["logistics"],
    blockRoles: ALL_ROLES,
    items: [
      { title: "Tableau de bord", url: "/", icon: LayoutDashboard, roles: ["Admin", "Chef de Pôle", "Responsable", "Bénévole"] },
      { title: "Planning", url: "/planning", icon: CalendarDays, roles: ["Admin", "Chef de Pôle", "Responsable"] },
      { title: "Événements", url: "/evenements", icon: Calendar, roles: ["Admin", "Chef de Pôle", "Responsable"] },
      { title: "Inventaire", url: "/inventaire", icon: Package, roles: ["Admin", "Chef de Pôle", "Responsable"] },
      { title: "Parking", url: "/parking", icon: Car, roles: ["Admin"] },
      { title: "Maintenance", url: "/maintenance", icon: Wrench, roles: ["Admin"] },
    ],
  },
  {
    id: "finance",
    label: "Finance & Récoltes",
    icon: Wallet,
    poleIds: ["admin"],
    blockRoles: ALL_ROLES,
    items: [
      { title: "Transactions", url: "/finance", icon: CreditCard, roles: ["Admin", "Responsable"] },
      { title: "Récoltes", url: "/recoltes", icon: HandCoins, roles: ["Admin", "Responsable", "Chef de Pôle", "Bénévole"] },
    ],
  },
  {
    id: "education",
    label: "Éducation",
    icon: BookOpen,
    poleIds: ["education"],
    blockRoles: ALL_ROLES,
    items: [],
  },
  {
    id: "social",
    label: "Social",
    icon: Heart,
    poleIds: ["social"],
    blockRoles: ALL_ROLES,
    items: [],
  },
  {
    id: "comms",
    label: "Communication",
    icon: Radio,
    poleIds: ["comms"],
    blockRoles: ALL_ROLES,
    items: [],
  },
];

const STANDALONE_ITEMS: NavItem[] = [
  { title: "Approbations", url: "/approbations", icon: UserCheck, roles: ["Admin", "Chef de Pôle", "Responsable"] },
  { title: "Opérations", url: "/operations", icon: Settings2, roles: ["Admin", "Chef de Pôle", "Responsable"] },
  { title: "Mon Agenda", url: "/mon-agenda", icon: CalendarDays, roles: ["Bénévole", "Parent", "Élève"] },
  { title: "Mes Missions", url: "/missions", icon: ClipboardList, roles: ["Bénévole"] },
  { title: "Mon Équipe", url: "/mon-equipe", icon: Users, roles: ["Chef de Pôle", "Responsable"] },
];

const roleIcons: Record<UserRole, React.ElementType> = {
  Admin: Shield,
  "Chef de Pôle": UserCheck,
  Responsable: UserCheck,
  Bénévole: Users,
  Parent: Users,
  Élève: Users,
};

// ── Reusable collapsible block ────────────────────────────
function SidebarBlock({
  block,
  role,
  activePoles,
  isAdminLike,
  location,
}: {
  block: NavBlock;
  role: UserRole;
  activePoles: string[];
  isAdminLike: boolean;
  location: ReturnType<typeof useLocation>;
}) {
  const isPoleActive =
    block.poleIds.length === 0 || block.poleIds.some((p) => activePoles.includes(p));
  const isActive = isAdminLike ? isPoleActive : isPoleActive;
  const visibleItems = block.items.filter((i) => i.roles.includes(role));
  const hasActiveRoute = block.items.some((item) =>
    item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url)
  );
  const [open, setOpen] = useState(hasActiveRoute);

  // Non-admin: hide inactive blocks entirely
  if (!isPoleActive && !isAdminLike) return null;
  if (!block.blockRoles.includes(role) && !isAdminLike) return null;

  return (
    <Collapsible open={open} onOpenChange={() => isActive && setOpen((o) => !o)}>
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
          <block.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
          <span className="flex-1 text-left">{block.label}</span>
          {isActive && block.items.length > 0 && (
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40 transition-transform duration-200",
                open && "rotate-180"
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

      {isActive && block.items.length === 0 && (
        <CollapsibleContent>
          <p className="ml-6 mt-1 mb-2 text-[11px] text-sidebar-foreground/30 italic border-l border-sidebar-border/40 pl-3 py-1">
            Aucun module actif
          </p>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

// ── Main Sidebar ─────────────────────────────────────────
export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, setRole, pole, setPole, displayName, isSuperAdmin } = useRole();
  const { activePoles, org, allOrgs, overrideOrgId, setOverrideOrgId } = useOrganization();
  const { signOut } = useAuth();

  const isAdminLike = role === "Admin" || isSuperAdmin;
  const showPoleSelector = ["Chef de Pôle", "Bénévole", "Parent", "Élève"].includes(role);
  const showPilotage = ADMIN_ROLES.includes(role) || isSuperAdmin;

  const standaloneVisible = STANDALONE_ITEMS.filter((i) => i.roles.includes(role));

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleLogoClick = () => navigate("/");

  const handleOrgSwitch = (orgId: string) => {
    setOverrideOrgId(orgId);
  };

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-5">
        {/* Super-admin Console SaaS */}
        {isSuperAdmin && (
          <div className="space-y-3 mb-4 rounded-lg bg-sidebar-accent/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-semibold flex items-center gap-1.5">
              <Globe className="h-3 w-3" /> Console SaaS
            </p>

            {/* Org switcher */}
            {allOrgs.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] text-sidebar-foreground/40 px-0.5">Mosquée active</label>
                <Select
                  value={overrideOrgId ?? org?.id ?? ""}
                  onValueChange={handleOrgSwitch}
                >
                  <SelectTrigger className="h-8 text-xs bg-sidebar-accent/60 border-sidebar-accent text-sidebar-foreground">
                    <SelectValue placeholder="Choisir…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allOrgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Dashboard Global SaaS */}
            <NavLink
              to="/saas-admin"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Console SaaS</span>
            </NavLink>
          </div>
        )}

        <button onClick={handleLogoClick} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-emerald">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="text-left">
            <h1 className="text-sm font-bold text-sidebar-primary-foreground tracking-tight">
              {org?.name ?? "AMM Ops"}
            </h1>
            <p className="text-xs text-sidebar-foreground/60">Mosquée R+4</p>
          </div>
        </button>
      </SidebarHeader>

      <SidebarContent className="px-3 gap-0">
        {/* ── PILOTAGE ── */}
        {showPilotage && (
          <div className="py-2">
            <p className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-2 px-2">
              Pilotage
            </p>
            <div className="space-y-0.5">
              {PILOTAGE_BLOCKS.map((block) => (
                <SidebarBlock
                  key={block.id}
                  block={block}
                  role={role}
                  activePoles={activePoles}
                  isAdminLike={isAdminLike}
                  location={location}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── PERSONNEL ── */}
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

        {/* ── MÉTIERS ── */}
        <div className="py-2">
          <p className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-2 px-2">
            Pôles Métiers
          </p>
          <div className="space-y-0.5">
            {METIER_BLOCKS.map((block) => (
              <SidebarBlock
                key={block.id}
                block={block}
                role={role}
                activePoles={activePoles}
                isAdminLike={isAdminLike}
                location={location}
              />
            ))}
          </div>
        </div>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-3">
        {/* User identity */}
        <div className="rounded-lg bg-sidebar-accent/40 px-3 py-2.5 space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-medium">Utilisateur</p>
          <p className="text-xs font-semibold text-sidebar-foreground truncate">{displayName ?? "—"}</p>
          <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-medium mt-1.5">Organisation</p>
          <p className="text-xs text-sidebar-foreground/70 truncate">{org?.name ?? "—"}</p>
        </div>

        {/* Role switcher */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-medium px-1">Rôle actif</label>
          <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
            <SelectTrigger className="h-9 text-xs bg-sidebar-accent/50 border-sidebar-accent text-sidebar-foreground">
              <div className="flex items-center gap-2">
                {React.createElement(roleIcons[role], { className: "h-3.5 w-3.5 text-sidebar-foreground/60" })}
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {ALL_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mon Pôle — only for Chef de Pôle, Bénévole, Parent, Élève */}
        {showPoleSelector && (
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-medium px-1">Mon Pôle</label>
            <Select value={pole} onValueChange={(v) => setPole(v as Pole)}>
              <SelectTrigger className="h-9 text-xs bg-sidebar-accent/50 border-sidebar-accent text-sidebar-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Sign out */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </Button>

        <div className="rounded-lg bg-sidebar-accent/50 p-3">
          <p className="text-xs text-sidebar-foreground/50">Complexe AMM — Bâtiment R+4</p>
          <p className="text-xs text-sidebar-foreground/30 mt-1">v1.0 · Micro-ERP</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
