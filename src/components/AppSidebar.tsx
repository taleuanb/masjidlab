import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, LayoutDashboard, CalendarDays, Users, Calendar, Car, Wrench,
  ClipboardList, UserCheck, SlidersHorizontal, ChevronDown,
  BookOpen, Heart, Radio, Globe, LogOut, Wallet, CreditCard,
  GraduationCap, ShieldCheck, FileText, Receipt, Package, Truck,
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
import { useRole, type UserRole, UI_ROLE_TO_DB } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";
import type { Pole } from "@/types/amm";
import { CORE_MODULE_SET } from "@/config/plan-modules";

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

const ALL_ROLES: UserRole[] = ["Super Admin", "Admin Mosquée", "Responsable", "Enseignant / Oustaz", "Bénévole", "Parent d'élève"];
const ADMIN_ROLES: UserRole[] = ["Super Admin", "Admin Mosquée", "Responsable"];

// ── ADMINISTRATION (ex-Pilotage) ──────────────────────────
const ADMIN_ITEMS: NavItem[] = [
  { title: "Configuration", url: "/configuration", icon: SlidersHorizontal, roles: ["Admin Mosquée", "Responsable"] },
  { title: "Membres & Rôles", url: "/structure-membres", icon: Users, roles: ["Admin Mosquée", "Responsable"] },
];

// ── PÔLES MÉTIERS ─────────────────────────────────────────
const METIER_BLOCKS: NavBlock[] = [
  {
    id: "education",
    label: "Éducation",
    icon: GraduationCap,
    poleIds: ["education"],
    blockRoles: ALL_ROLES,
    items: [
      { title: "Élèves", url: "/eleves", icon: GraduationCap, roles: ALL_ROLES },
      { title: "Classes", url: "/classes", icon: BookOpen, roles: ALL_ROLES },
      { title: "Inscriptions", url: "/inscriptions", icon: ClipboardList, roles: ALL_ROLES },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: Wallet,
    poleIds: ["admin"],
    blockRoles: ADMIN_ROLES,
    items: [
      { title: "Transactions", url: "/finance", icon: CreditCard, roles: ["Admin Mosquée", "Responsable"] },
      { title: "Donateurs", url: "/donateurs", icon: Heart, roles: ["Admin Mosquée", "Responsable"] },
      { title: "Reçus Fiscaux", url: "/recus-fiscaux", icon: Receipt, roles: ["Admin Mosquée", "Responsable"] },
    ],
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

// ── LOGISTIQUE (Elite) ────────────────────────────────────
const LOGISTIQUE_BLOCK: NavBlock = {
  id: "operations",
  label: "Logistique",
  icon: Truck,
  poleIds: ["logistics"],
  blockRoles: ALL_ROLES,
  items: [
    { title: "Tableau de bord", url: "/", icon: LayoutDashboard, roles: ["Admin Mosquée", "Responsable", "Bénévole"] },
    { title: "Planning", url: "/planning", icon: CalendarDays, roles: ["Admin Mosquée", "Responsable"] },
    { title: "Événements", url: "/evenements", icon: Calendar, roles: ["Admin Mosquée", "Responsable"] },
    { title: "Inventaire", url: "/inventaire", icon: Package, roles: ["Admin Mosquée", "Responsable"] },
    { title: "Parking", url: "/parking", icon: Car, roles: ["Admin Mosquée"] },
    { title: "Maintenance", url: "/maintenance", icon: Wrench, roles: ["Admin Mosquée"] },
  ],
};

// ── PERSONNEL (Elite) ─────────────────────────────────────
const PERSONNEL_BLOCK: NavBlock = {
  id: "gestion-rh",
  label: "Personnel",
  icon: ShieldCheck,
  poleIds: ["admin"],
  blockRoles: ADMIN_ROLES,
  items: [
    { title: "Approbations", url: "/approbations", icon: UserCheck, roles: ["Admin Mosquée", "Responsable"] },
    { title: "Contrats Staff", url: "/contrats-staff", icon: ShieldCheck, roles: ADMIN_ROLES },
    { title: "Documents", url: "/documents", icon: FileText, roles: ADMIN_ROLES },
    { title: "Structure", url: "/organisation", icon: Users, roles: ADMIN_ROLES },
  ],
};

const STANDALONE_ITEMS: NavItem[] = [
  { title: "Mon Agenda", url: "/mon-agenda", icon: CalendarDays, roles: ["Bénévole", "Parent d'élève"] },
  { title: "Mes Missions", url: "/missions", icon: ClipboardList, roles: ["Bénévole"] },
  { title: "Mon Équipe", url: "/mon-equipe", icon: Users, roles: ["Responsable"] },
];

const roleIcons: Record<UserRole, React.ElementType> = {
  "Super Admin": Globe,
  "Admin Mosquée": ShieldCheck,
  Responsable: UserCheck,
  "Enseignant / Oustaz": GraduationCap,
  Bénévole: Users,
  "Parent d'élève": Users,
};

// ── Reusable collapsible block ────────────────────────────
function SidebarBlock({
  block, role, activePoles, isAdminLike, isSuperAdmin, location,
}: {
  block: NavBlock;
  role: UserRole;
  activePoles: string[];
  isAdminLike: boolean;
  isSuperAdmin: boolean;
  location: ReturnType<typeof useLocation>;
}) {
  const isPoleActive = block.poleIds.length === 0 || block.poleIds.some((p) => activePoles.includes(p));
  const hasActiveRoute = block.items.some((item) =>
    item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url)
  );
  const [open, setOpen] = useState(hasActiveRoute);

  if (!isPoleActive && !isSuperAdmin) return null;
  if (!block.blockRoles.includes(role) && !isSuperAdmin) return null;

  const isActive = isSuperAdmin ? isPoleActive : true;
  const visibleItems = isSuperAdmin ? block.items : block.items.filter((i) => i.roles.includes(role));

  return (
    <Collapsible open={open} onOpenChange={() => isActive && setOpen((o) => !o)}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
            isActive
              ? "cursor-pointer hover:bg-sidebar-accent/60 text-sidebar-foreground"
              : "cursor-default opacity-35 text-sidebar-foreground/60",
            hasActiveRoute && isActive && "text-sidebar-primary font-medium"
          )}
        >
          <block.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
          <span className="flex-1 text-left">{block.label}</span>
          {isActive && block.items.length > 0 && (
            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40 transition-transform duration-200", open && "rotate-180")} />
          )}
          {!isActive && isSuperAdmin && (
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground/60 bg-muted/50 rounded px-1.5 py-0.5">Off</span>
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
                    className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
          <p className="ml-6 mt-1 mb-1 text-[11px] text-sidebar-foreground/30 italic border-l border-sidebar-border/40 pl-3 py-0.5">
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
  const { activePoles, org, allOrgs, overrideOrgId, setOverrideOrgId, isModuleInPlan } = useOrganization();
  const { signOut, dbRole, permissions, refreshPermissions, impersonatedUser } = useAuth();

  // Ghost mode takes absolute priority over preview
  const isGhostActive = !!impersonatedUser;
  // When previewing a different role, disable the Super Admin bypass (but NOT during ghost)
  const isPreviewingOtherRole = !isGhostActive && isSuperAdmin && role !== "Super Admin";
  const effectiveBypass = !isGhostActive && isSuperAdmin && !isPreviewingOtherRole;

  const isAdminLike = !isGhostActive && (role === "Admin Mosquée" || role === "Super Admin" || effectiveBypass);
  const showPoleSelector = !effectiveBypass && !isGhostActive && ["Bénévole", "Parent d'élève"].includes(role);
  const showAdmin = !isGhostActive ? (ADMIN_ROLES.includes(role) || effectiveBypass) : false;
  const standaloneVisible = STANDALONE_ITEMS.filter((i) => i.roles.includes(role));
  const standaloneVisible = STANDALONE_ITEMS.filter((i) => i.roles.includes(role));

  // ── RBAC permissions from DB ──
  const [previewPermissions, setPreviewPermissions] = useState<Set<string> | null>(null);

  const orgId = org?.id;
  const effectiveDbRole = UI_ROLE_TO_DB[role] ?? dbRole;

  // Fetch permissions for the previewed role (role-based RPC)
  const fetchPreviewPermissions = useCallback(async () => {
    if (effectiveBypass) {
      setPreviewPermissions(null);
      return;
    }
    if (!orgId || !effectiveDbRole) {
      setPreviewPermissions(null);
      return;
    }
    const { data, error } = await supabase.rpc("get_effective_permissions" as any, {
      p_org_id: orgId,
      p_role: effectiveDbRole,
    });
    if (error || !data) {
      setPreviewPermissions(null);
      return;
    }
    const allowed = new Set<string>();
    for (const row of data as any[]) {
      if (row.enabled ?? row.can_view) allowed.add(row.module);
    }
    setPreviewPermissions(allowed);
  }, [orgId, effectiveDbRole, effectiveBypass]);

  useEffect(() => { fetchPreviewPermissions(); }, [fetchPreviewPermissions]);

  // Refresh permissions when org or impersonated user changes
  useEffect(() => {
    if (orgId) refreshPermissions(orgId);
  }, [orgId, refreshPermissions, impersonatedUser]);

  // Reset role selector when ghost mode is deactivated
  useEffect(() => {
    if (!impersonatedUser && isSuperAdmin) {
      setRole("Super Admin");
    }
  }, [impersonatedUser, isSuperAdmin, setRole]);

  // ── Resolve RBAC permission set ──
  const rbacModules = useMemo<Set<string> | null>(() => {
    if (isGhostActive) {
      if (permissions.length > 0) {
        const set = new Set<string>();
        for (const p of permissions) { if (p.enabled) set.add(p.module); }
        return set;
      }
      return new Set<string>();
    }
    if (effectiveBypass) return null; // null = show all (super admin, no preview)
    if (isPreviewingOtherRole && previewPermissions) return previewPermissions;
    if (permissions.length > 0) {
      const set = new Set<string>();
      for (const p of permissions) { if (p.enabled) set.add(p.module); }
      return set;
    }
    return previewPermissions;
  }, [isGhostActive, effectiveBypass, isPreviewingOtherRole, previewPermissions, permissions]);

  /**
   * Hiérarchie de visibilité :
   * 1. Plan filter — module absent du plan → masqué (sauf super_admin via isModuleInPlan)
   * 2. CORE exemption — config/gouvernance/operations toujours visibles pour admin (hors RBAC)
   * 3. RBAC filter — enabled === false pour tous les rôles cumulés → masqué
   */
  const isBlockVisible = useCallback((blockId: string): boolean => {
    // 1. Plan
    if (!isModuleInPlan(blockId)) return false;
    // 2. CORE modules exempt from RBAC for admin-like (non-ghost)
    if (CORE_MODULE_SET.has(blockId) && isAdminLike && !isGhostActive) return true;
    // 3. RBAC
    if (rbacModules !== null && !rbacModules.has(blockId)) return false;
    return true;
  }, [isModuleInPlan, rbacModules, isAdminLike, isGhostActive]);

  const filteredMetierBlocks = useMemo(() => {
    return METIER_BLOCKS.filter((block) => isBlockVisible(block.id));
  }, [isBlockVisible]);

  const showLogistique = isBlockVisible("operations");
  const showPersonnel = isBlockVisible("gestion-rh");
  const handleSignOut = async () => { await signOut(); navigate("/login"); };
  const handleLogoClick = () => navigate("/");

  return (
    <Sidebar className="border-r-0">
      {/* ── Header: logo + org ── */}
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

        {isSuperAdmin && allOrgs.length > 0 && (
          <Select value={overrideOrgId ?? org?.id ?? ""} onValueChange={(v) => setOverrideOrgId(v)}>
            <SelectTrigger className="mt-2 h-7 text-[11px] bg-sidebar-accent/40 border-sidebar-accent text-sidebar-foreground">
              <SelectValue placeholder="Choisir une mosquée…" />
            </SelectTrigger>
            <SelectContent>
              {allOrgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </SidebarHeader>

      <SidebarContent className="px-3 gap-0">
        {/* ── Ghost mode banner ── */}
        {isGhostActive && (
          <div className="mx-1 mb-2 px-2 py-1.5 rounded-md bg-orange-500/10 border border-orange-500/20 text-[10px] text-orange-700 dark:text-orange-400 font-medium flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            Mode Ghost : {impersonatedUser.name}
          </div>
        )}
        {/* ── Preview banner ── */}
        {!isGhostActive && isPreviewingOtherRole && (
          <div className="mx-1 mb-2 px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            Mode prévisualisation : {role}
          </div>
        )}

        {/* ── G1: ADMINISTRATION ── */}
        {(showAdmin || isGhostActive) && (
          <div className="py-1">
            <p className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-1 px-2">Administration</p>
            <SidebarMenu className="space-y-px">
              {ADMIN_ITEMS
                .filter((item) => effectiveBypass || item.roles.includes(role) || (isGhostActive && rbacModules !== null))
                .filter((item) => {
                  // Map admin items to block IDs for visibility check
                  const blockMap: Record<string, string> = { "/configuration": "config", "/structure-membres": "gouvernance" };
                  const blockId = blockMap[item.url];
                  return blockId ? isBlockVisible(blockId) : true;
                })
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </div>
        )}

        {/* ── G2: PÔLES MÉTIERS ── */}
        {filteredMetierBlocks.length > 0 && (
          <div className="py-1">
            <p className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-1 px-2">Pôles Métiers</p>
            <div className="space-y-px">
              {filteredMetierBlocks.map((block) => (
                <SidebarBlock key={block.id} block={block} role={role} activePoles={activePoles} isAdminLike={isAdminLike} isSuperAdmin={effectiveBypass} location={location} />
              ))}
            </div>
          </div>
        )}

        {/* ── G3: LOGISTIQUE (Elite) ── */}
        {showLogistique && (
          <div className="py-1">
            <p className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-1 px-2">Logistique</p>
            <div className="space-y-px">
              <SidebarBlock block={LOGISTIQUE_BLOCK} role={role} activePoles={activePoles} isAdminLike={isAdminLike} isSuperAdmin={effectiveBypass} location={location} />
            </div>
          </div>
        )}

        {/* ── G4: PERSONNEL (Elite) ── */}
        {showPersonnel && (
          <div className="py-1">
            <p className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-1 px-2">Personnel</p>
            <div className="space-y-px">
              <SidebarBlock block={PERSONNEL_BLOCK} role={role} activePoles={activePoles} isAdminLike={isAdminLike} isSuperAdmin={effectiveBypass} location={location} />
            </div>
          </div>
        )}

        {/* ── ESPACE PERSO ── */}
        {standaloneVisible.length > 0 && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-0.5">Mon Espace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {standaloneVisible.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end={item.url === "/"} className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
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

      {/* ── Footer ── */}
      <SidebarFooter className="px-3 py-2.5 space-y-2">
        {/* Console SaaS — bottom, super admin only */}
        {isSuperAdmin && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink to="/saas-admin" className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                  <Globe className="h-4 w-4" />
                  <span>Console SaaS</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}

        {/* Role preview switcher */}
        <div className={cn("space-y-1", isGhostActive && "opacity-40 pointer-events-none")}>
          <label className="text-[9px] uppercase tracking-wider text-sidebar-foreground/30 font-medium px-1">
            {isGhostActive
              ? "Désactivé (Mode Ghost)"
              : isSuperAdmin ? "Prévisualiser en tant que" : "Rôle actif"}
          </label>
          <Select value={role} onValueChange={(v) => setRole(v as UserRole)} disabled={isGhostActive}>
            <SelectTrigger className="h-8 text-[11px] bg-sidebar-accent/30 border-sidebar-accent/50 text-sidebar-foreground/70">
              <div className="flex items-center gap-2">
                {React.createElement(roleIcons[role], { className: "h-3 w-3 text-sidebar-foreground/40" })}
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {ALL_ROLES.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showPoleSelector && (
          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-wider text-sidebar-foreground/30 font-medium px-1">Mon Pôle</label>
            <Select value={pole} onValueChange={(v) => setPole(v as Pole)}>
              <SelectTrigger className="h-8 text-[11px] bg-sidebar-accent/30 border-sidebar-accent/50 text-sidebar-foreground/70">
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

        {/* User identity + sign out */}
        <div className="flex items-center gap-2 pt-1 border-t border-sidebar-border/30">
          <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sidebar-foreground/60", impersonatedUser ? "bg-orange-500/20" : "bg-sidebar-accent/50")}>
            <Users className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-sidebar-foreground truncate">
              {impersonatedUser ? impersonatedUser.name : (displayName ?? "—")} <span className="text-sidebar-foreground/25 font-normal">· v1.0</span>
            </p>
            <p className="text-[10px] text-sidebar-foreground/40 truncate">{impersonatedUser ? "Mode Ghost" : (org?.name ?? "—")}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-sidebar-foreground/30 hover:text-destructive" onClick={handleSignOut}>
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
