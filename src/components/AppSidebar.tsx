import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth, type EffectivePermission } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, LayoutDashboard, CalendarDays, Users, Calendar, Car, Wrench,
  ClipboardList, UserCheck, Settings2, SlidersHorizontal, ChevronDown,
  BookOpen, Heart, Radio, Globe, LogOut, Wallet, CreditCard,
  GraduationCap, ShieldCheck, FileText, Receipt, Package,
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

const POLES: Pole[] = ["Imam", "École (Avenir)", "Social (ABD)", "Accueil", "Récolte", "Digital", "Com", "Parking"];

/* ─────────────────────────────────────────────────────────
   Each nav item & block has a `moduleKey` that maps to the
   `module` field returned by the RPC `get_effective_permissions`.
   This is the ONLY thing that decides visibility.
   ───────────────────────────────────────────────────────── */

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  moduleKey: string; // maps to permissions.module
}

interface NavBlock {
  id: string;
  label: string;
  icon: React.ElementType;
  moduleKey: string; // parent module key
  poleIds: string[];
  items: NavItem[];
}

// ── PILOTAGE ──────────────────────────────────────────────
const PILOTAGE_BLOCKS: NavBlock[] = [
  {
    id: "config",
    label: "Configuration",
    icon: SlidersHorizontal,
    moduleKey: "admin",
    poleIds: [],
    items: [
      { title: "Espaces & Pôles", url: "/configuration", icon: SlidersHorizontal, moduleKey: "admin" },
    ],
  },
  {
    id: "gouvernance",
    label: "Structure & Membres",
    icon: Users,
    moduleKey: "admin",
    poleIds: ["admin"],
    items: [
      { title: "Structure & Membres", url: "/structure-membres", icon: Users, moduleKey: "admin" },
    ],
  },
];

// ── MÉTIERS ───────────────────────────────────────────────
const METIER_BLOCKS: NavBlock[] = [
  {
    id: "operations",
    label: "Opérations & Planning",
    icon: CalendarDays,
    moduleKey: "logistics",
    poleIds: ["logistics"],
    items: [
      { title: "Tableau de bord", url: "/", icon: LayoutDashboard, moduleKey: "logistics" },
      { title: "Planning", url: "/planning", icon: CalendarDays, moduleKey: "logistics.planning" },
      { title: "Événements", url: "/evenements", icon: Calendar, moduleKey: "logistics" },
      { title: "Inventaire", url: "/inventaire", icon: Package, moduleKey: "logistics" },
      { title: "Parking", url: "/parking", icon: Car, moduleKey: "logistics.parking" },
      { title: "Maintenance", url: "/maintenance", icon: Wrench, moduleKey: "logistics.maintenance" },
    ],
  },
  {
    id: "education",
    label: "Éducation",
    icon: GraduationCap,
    moduleKey: "education",
    poleIds: ["education"],
    items: [
      { title: "Élèves", url: "/eleves", icon: GraduationCap, moduleKey: "education.eleves" },
      { title: "Classes", url: "/classes", icon: BookOpen, moduleKey: "education.classes" },
      { title: "Inscriptions", url: "/inscriptions", icon: ClipboardList, moduleKey: "education.inscriptions" },
    ],
  },
  {
    id: "gestion-rh",
    label: "Gestion & RH",
    icon: ShieldCheck,
    moduleKey: "admin",
    poleIds: ["admin"],
    items: [
      { title: "Contrats Staff", url: "/contrats-staff", icon: ShieldCheck, moduleKey: "admin.contrats" },
      { title: "Documents", url: "/documents", icon: FileText, moduleKey: "admin" },
      { title: "Structure", url: "/organisation", icon: Users, moduleKey: "admin" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: Wallet,
    moduleKey: "admin.finance",
    poleIds: ["admin"],
    items: [
      { title: "Transactions", url: "/finance", icon: CreditCard, moduleKey: "admin.finance" },
      { title: "Donateurs", url: "/donateurs", icon: Heart, moduleKey: "admin.donateurs" },
      { title: "Reçus Fiscaux", url: "/recus-fiscaux", icon: Receipt, moduleKey: "admin.finance" },
    ],
  },
  {
    id: "social",
    label: "Social",
    icon: Heart,
    moduleKey: "social",
    poleIds: ["social"],
    items: [],
  },
  {
    id: "comms",
    label: "Communication",
    icon: Radio,
    moduleKey: "comms",
    poleIds: ["comms"],
    items: [],
  },
];

const STANDALONE_ITEMS: NavItem[] = [
  { title: "Approbations", url: "/approbations", icon: UserCheck, moduleKey: "admin" },
  { title: "Opérations", url: "/operations", icon: Settings2, moduleKey: "admin" },
  { title: "Mon Agenda", url: "/mon-agenda", icon: CalendarDays, moduleKey: "logistics" },
  { title: "Mes Missions", url: "/missions", icon: ClipboardList, moduleKey: "logistics" },
  { title: "Mon Équipe", url: "/mon-equipe", icon: Users, moduleKey: "admin" },
];

const ALL_ROLES: UserRole[] = ["Super Admin", "Admin Mosquée", "Responsable", "Enseignant / Oustaz", "Bénévole", "Parent d'élève"];

const roleIcons: Record<UserRole, React.ElementType> = {
  "Super Admin": Globe,
  "Admin Mosquée": ShieldCheck,
  Responsable: UserCheck,
  "Enseignant / Oustaz": GraduationCap,
  Bénévole: Users,
  "Parent d'élève": Users,
};

/* ─────────────────────────────────────────────────────────
   Helper: check if a module key is enabled in the
   resolved permission set (a Set<string> of enabled modules).
   Returns true if the set is null (= bypass / show all).
   ───────────────────────────────────────────────────────── */
function isModuleAllowed(moduleKey: string, allowedModules: Set<string> | null): boolean {
  if (!allowedModules) return true; // null = show everything (super admin bypass)
  // Check exact match OR parent match (e.g. "logistics" enables "logistics.planning")
  if (allowedModules.has(moduleKey)) return true;
  const parent = moduleKey.split(".")[0];
  if (parent !== moduleKey && allowedModules.has(parent)) return true;
  return false;
}

// ── Reusable collapsible block ────────────────────────────
function SidebarBlock({
  block, activePoles, isSuperAdminBypass, allowedModules, location,
}: {
  block: NavBlock;
  activePoles: string[];
  isSuperAdminBypass: boolean;
  allowedModules: Set<string> | null;
  location: ReturnType<typeof useLocation>;
}) {
  const isPoleActive = block.poleIds.length === 0 || block.poleIds.some((p) => activePoles.includes(p));
  const hasActiveRoute = block.items.some((item) =>
    item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url)
  );
  const [open, setOpen] = useState(hasActiveRoute);

  // Permission check: block visible only if its moduleKey is allowed
  if (!isModuleAllowed(block.moduleKey, allowedModules)) return null;
  // Pole check: hide if pole is off (unless super admin bypass shows it with badge)
  if (!isPoleActive && !isSuperAdminBypass) return null;

  const isActive = isSuperAdminBypass ? isPoleActive : true;
  // Filter items by their individual moduleKey
  const visibleItems = block.items.filter((i) => isModuleAllowed(i.moduleKey, allowedModules));

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
          {isActive && visibleItems.length > 0 && (
            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40 transition-transform duration-200", open && "rotate-180")} />
          )}
          {!isActive && isSuperAdminBypass && (
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

      {isActive && visibleItems.length === 0 && block.items.length === 0 && (
        <CollapsibleContent>
          <p className="ml-6 mt-1 mb-1 text-[11px] text-sidebar-foreground/30 italic border-l border-sidebar-border/40 pl-3 py-0.5">
            Aucun module actif
          </p>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

/* ─────────────────────────────────────────────────────────
   Build a Set<string> of enabled module keys from a
   permission array. This is the SINGLE source of truth.
   ───────────────────────────────────────────────────────── */
function buildModuleSet(perms: EffectivePermission[]): Set<string> {
  const set = new Set<string>();
  for (const p of perms) {
    if (p.enabled) set.add(p.module);
  }
  return set;
}

// ── Main Sidebar ─────────────────────────────────────────
export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, setRole, pole, setPole, displayName, isSuperAdmin } = useRole();
  const { activePoles, org, allOrgs, overrideOrgId, setOverrideOrgId } = useOrganization();
  const { signOut, permissions, refreshPermissions, impersonatedUser } = useAuth();

  const isGhostActive = !!impersonatedUser;

  // When NOT ghost and NOT previewing another role, Super Admin sees everything
  const isPreviewingOtherRole = !isGhostActive && isSuperAdmin && role !== "Super Admin";
  const isSuperAdminBypass = !isGhostActive && isSuperAdmin && !isPreviewingOtherRole;

  const orgId = org?.id;
  const effectiveDbRole = UI_ROLE_TO_DB[role];

  // ── Preview-mode permissions (role-based RPC, only for role preview) ──
  const [previewPermissions, setPreviewPermissions] = useState<Set<string> | null>(null);

  const fetchPreviewPermissions = useCallback(async () => {
    if (!isPreviewingOtherRole || !orgId || !effectiveDbRole) {
      setPreviewPermissions(null);
      return;
    }
    const { data, error } = await supabase.rpc("get_effective_permissions" as any, {
      p_org_id: orgId,
      p_role: effectiveDbRole,
    });
    if (error || !data) { setPreviewPermissions(null); return; }
    const set = new Set<string>();
    for (const row of data as any[]) {
      if (row.enabled ?? row.can_view) set.add(row.module);
    }
    setPreviewPermissions(set);
  }, [orgId, effectiveDbRole, isPreviewingOtherRole]);

  useEffect(() => { fetchPreviewPermissions(); }, [fetchPreviewPermissions]);

  // ── Refresh real permissions when org or ghost changes ──
  useEffect(() => {
    if (orgId) refreshPermissions(orgId);
  }, [orgId, refreshPermissions, impersonatedUser]);

  // ── Reset role selector when ghost deactivates ──
  useEffect(() => {
    if (!impersonatedUser && isSuperAdmin) setRole("Super Admin");
  }, [impersonatedUser, isSuperAdmin, setRole]);

  /* ─────────────────────────────────────────────────────
     THE SINGLE SOURCE OF TRUTH for module visibility.
     Priority:
     1. Ghost → use AuthContext.permissions (resolved for ghost user)
     2. Preview role → use previewPermissions
     3. Super Admin (no preview) → null (show all)
     4. Normal user → use AuthContext.permissions
     ───────────────────────────────────────────────────── */
  const allowedModules = useMemo<Set<string> | null>(() => {
    if (isGhostActive) {
      return permissions.length > 0 ? buildModuleSet(permissions) : new Set<string>();
    }
    if (isSuperAdminBypass) return null;
    if (isPreviewingOtherRole && previewPermissions) return previewPermissions;
    if (permissions.length > 0) return buildModuleSet(permissions);
    return previewPermissions;
  }, [isGhostActive, isSuperAdminBypass, isPreviewingOtherRole, previewPermissions, permissions]);

  // ── Filter blocks by permissions (data-driven) ──
  const filteredPilotageBlocks = useMemo(
    () => PILOTAGE_BLOCKS.filter((b) => isModuleAllowed(b.moduleKey, allowedModules)),
    [allowedModules]
  );
  const filteredMetierBlocks = useMemo(
    () => METIER_BLOCKS.filter((b) => isModuleAllowed(b.moduleKey, allowedModules)),
    [allowedModules]
  );
  const filteredStandalone = useMemo(
    () => STANDALONE_ITEMS.filter((i) => isModuleAllowed(i.moduleKey, allowedModules)),
    [allowedModules]
  );

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

        {/* ── PILOTAGE ── */}
        {filteredPilotageBlocks.length > 0 && (
          <div className="py-1">
            <p className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-1 px-2">Pilotage</p>
            <div className="space-y-px">
              {filteredPilotageBlocks.map((block) => (
                <SidebarBlock key={block.id} block={block} activePoles={activePoles} isSuperAdminBypass={isSuperAdminBypass} allowedModules={allowedModules} location={location} />
              ))}
            </div>
          </div>
        )}

        {/* ── PERSONNEL ── */}
        {filteredStandalone.length > 0 && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-0.5">Personnel</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredStandalone.map((item) => (
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

        {/* ── MÉTIERS ── */}
        <div className="py-1">
          <p className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-1 px-2">Pôles Métiers</p>
          <div className="space-y-px">
            {filteredMetierBlocks.map((block) => (
              <SidebarBlock key={block.id} block={block} activePoles={activePoles} isSuperAdminBypass={isSuperAdminBypass} allowedModules={allowedModules} location={location} />
            ))}
          </div>
        </div>
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="px-3 py-2.5 space-y-2">
        {/* Console SaaS — super admin only */}
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

        {!isGhostActive && !isSuperAdmin && (
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
