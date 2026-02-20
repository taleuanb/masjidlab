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

const ALL_ROLES: UserRole[] = ["Super Admin", "Admin", "Chef de Pôle", "Responsable", "Bénévole", "Parent", "Élève"];
const ADMIN_ROLES: UserRole[] = ["Super Admin", "Admin", "Responsable"];

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
  "Super Admin": Globe,
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
  isSuperAdmin,
  location,
}: {
  block: NavBlock;
  role: UserRole;
  activePoles: string[];
  isAdminLike: boolean;
  isSuperAdmin: boolean;
  location: ReturnType<typeof useLocation>;
}) {
  const isPoleActive =
    block.poleIds.length === 0 || block.poleIds.some((p) => activePoles.includes(p));
  const hasActiveRoute = block.items.some((item) =>
    item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url)
  );
  const [open, setOpen] = useState(hasActiveRoute);

  // Non-super-admin: completely hide inactive modules
  if (!isPoleActive && !isSuperAdmin) return null;
  if (!block.blockRoles.includes(role) && !isSuperAdmin) return null;

  const isActive = isSuperAdmin ? isPoleActive : true;
  const visibleItems = isSuperAdmin
    ? block.items
    : block.items.filter((i) => i.roles.includes(role));

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
          {!isActive && isSuperAdmin && (
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground/60 bg-muted/50 rounded px-1.5 py-0.5">
              Off
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

  const isAdminLike = role === "Admin" || role === "Super Admin" || isSuperAdmin;
  const showPoleSelector = !isSuperAdmin && ["Chef de Pôle", "Bénévole", "Parent", "Élève"].includes(role);
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
      {/* ── Compact Header: logo + org name on one line ── */}
      <SidebarHeader className="px-4 py-3">
        <button onClick={handleLogoClick} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md gradient-emerald">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0 text-left">
            <h1 className="text-sm font-bold text-sidebar-primary-foreground tracking-tight truncate">
              {org?.name ?? "AMM Ops"}
            </h1>
          </div>
        </button>

        {/* Org switcher for super-admin — compact */}
        {isSuperAdmin && allOrgs.length > 0 && (
          <Select
            value={overrideOrgId ?? org?.id ?? ""}
            onValueChange={handleOrgSwitch}
          >
            <SelectTrigger className="mt-2 h-7 text-[11px] bg-sidebar-accent/40 border-sidebar-accent text-sidebar-foreground">
              <SelectValue placeholder="Choisir une mosquée…" />
            </SelectTrigger>
            <SelectContent>
              {allOrgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </SidebarHeader>

      <SidebarContent className="px-3 gap-0">
        {/* ── PILOTAGE ── */}
        {showPilotage && (
          <div className="py-1.5">
            <p className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-1 px-2">
              Pilotage
            </p>
            <div className="space-y-px">
              {/* Console SaaS — inside Pilotage, above Configuration */}
              {isSuperAdmin && (
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/saas-admin"
                        className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <Globe className="h-4 w-4" />
                        <span>Console SaaS</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              )}
              {PILOTAGE_BLOCKS.map((block) => (
                <SidebarBlock
                  key={block.id}
                  block={block}
                  role={role}
                  activePoles={activePoles}
                  isAdminLike={isAdminLike}
                  isSuperAdmin={isSuperAdmin}
                  location={location}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── PERSONNEL ── */}
        {standaloneVisible.length > 0 && (
          <SidebarGroup className="py-1.5">
            <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-0.5">
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
                        className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
        <div className="py-1.5">
          <p className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-1 px-2">
            Pôles Métiers
          </p>
          <div className="space-y-px">
            {METIER_BLOCKS.map((block) => (
              <SidebarBlock
                key={block.id}
                block={block}
                role={role}
                activePoles={activePoles}
                isAdminLike={isAdminLike}
                isSuperAdmin={isSuperAdmin}
                location={location}
              />
            ))}
          </div>
        </div>
      </SidebarContent>

      {/* ── Compact Footer ── */}
      <SidebarFooter className="px-3 py-2.5 space-y-2">
        {/* Role preview switcher — discret */}
        <div className="space-y-1">
          <label className="text-[9px] uppercase tracking-wider text-sidebar-foreground/30 font-medium px-1">
            {isSuperAdmin ? "Prévisualiser en tant que" : "Rôle actif"}
          </label>
          <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
            <SelectTrigger className="h-8 text-[11px] bg-sidebar-accent/30 border-sidebar-accent/50 text-sidebar-foreground/70">
              <div className="flex items-center gap-2">
                {React.createElement(roleIcons[role], { className: "h-3 w-3 text-sidebar-foreground/40" })}
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

        {/* Mon Pôle */}
        {showPoleSelector && (
          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-wider text-sidebar-foreground/30 font-medium px-1">Mon Pôle</label>
            <Select value={pole} onValueChange={(v) => setPole(v as Pole)}>
              <SelectTrigger className="h-8 text-[11px] bg-sidebar-accent/30 border-sidebar-accent/50 text-sidebar-foreground/70">
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

        {/* User identity + version + sign out — single compact row */}
        <div className="flex items-center gap-2 pt-1 border-t border-sidebar-border/30">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent/50 text-sidebar-foreground/60">
            <Users className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-sidebar-foreground truncate">
              {displayName ?? "—"} <span className="text-sidebar-foreground/25 font-normal">· v1.0</span>
            </p>
            <p className="text-[10px] text-sidebar-foreground/40 truncate">{org?.name ?? "—"}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-sidebar-foreground/30 hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
