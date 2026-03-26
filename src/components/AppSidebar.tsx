import React, { useState, useEffect, useMemo, useCallback } from "react";
import masjidLabLogo from "@/assets/masjidlab-logo.png";
import { useLocation, useNavigate } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getVitrineUrl } from "@/lib/domain";
import {
  Building2, LayoutDashboard, CalendarDays, Users, Calendar, Car, Wrench,
  ClipboardList, UserCheck, SlidersHorizontal, ChevronDown,
  BookOpen, Heart, Radio, Globe, LogOut, Wallet, CreditCard,
  GraduationCap, ShieldCheck, FileText, Receipt, Package, Truck, UserCircle,
  Settings, CreditCard as BillingIcon, ClipboardCheck,
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
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { CORE_MODULE_IDS, MODULE_MAP } from "@/config/module-registry";

const POLES: Pole[] = ["Imam", "École (Avenir)", "Social (ABD)", "Accueil", "Récolte", "Digital", "Com", "Parking"];

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  moduleKey?: string;
}

interface NavBlock {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

const ALL_ROLES: UserRole[] = ["Super Admin", "Admin Mosquée", "Responsable", "Enseignant / Oustaz", "Bénévole", "Parent d'élève"];

// ── GROUPE A: ADMINISTRATION ──
const ADMIN_ITEMS: (NavItem & { moduleKey: string })[] = [
  { title: "Paramètres", url: "/configuration", icon: Settings, moduleKey: "config" },
  { title: "Ressources Humaines", url: "/structure-membres", icon: Users, moduleKey: "gouvernance" },
  { title: "Abonnement & Facturation", url: "/configuration/plan", icon: BillingIcon, moduleKey: "config" },
];

// ── GROUPE B: PÔLES MÉTIERS ──
const METIER_BLOCKS: NavBlock[] = [
  {
    id: "education",
    label: "Éducation",
    icon: GraduationCap,
    items: [
      { title: "Élèves", url: "/eleves", icon: GraduationCap, moduleKey: "education.eleves" },
      { title: "Classes", url: "/classes", icon: BookOpen, moduleKey: "education.classes" },
      { title: "Inscriptions", url: "/inscriptions", icon: ClipboardList, moduleKey: "education.inscriptions" },
      { title: "Session & Suivi", url: "/appel", icon: ClipboardList, moduleKey: "education.sessions" },
      { title: "Évaluations", url: "/evaluations", icon: ClipboardCheck, moduleKey: "education.evaluations" },
      { title: "Frais Scolarité", url: "/frais-scolarite", icon: CreditCard, moduleKey: "education.frais" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: Wallet,
    items: [
      { title: "Transactions", url: "/finance", icon: CreditCard, moduleKey: "finance.transactions" },
      { title: "Donateurs", url: "/donateurs", icon: Heart, moduleKey: "finance.donateurs" },
      { title: "Reçus Fiscaux", url: "/recus-fiscaux", icon: Receipt, moduleKey: "finance.recus" },
    ],
  },
  {
    id: "social",
    label: "Social",
    icon: Heart,
    items: [
      { title: "Dashboard Social", url: "/social", icon: Heart, moduleKey: "social" },
    ],
  },
  {
    id: "comms",
    label: "Communication",
    icon: Radio,
    items: [
      { title: "Dashboard Com", url: "/communication", icon: Radio, moduleKey: "comms" },
    ],
  },
];

const LOGISTIQUE_BLOCK: NavBlock = {
  id: "operations",
  label: "Logistique",
  icon: Truck,
  items: [
    { title: "Dashboard Logistique", url: "/", icon: LayoutDashboard },
    { title: "Planning", url: "/planning", icon: CalendarDays, moduleKey: "operations.planning" },
    { title: "Événements", url: "/evenements", icon: Calendar, moduleKey: "operations.evenements" },
    { title: "Inventaire", url: "/inventaire", icon: Package, moduleKey: "operations.inventaire" },
    { title: "Parking", url: "/parking", icon: Car, moduleKey: "operations.parking" },
    { title: "Maintenance", url: "/maintenance", icon: Wrench, moduleKey: "operations.maintenance" },
  ],
};

const PERSONNEL_BLOCK: NavBlock = {
  id: "gestion-rh",
  label: "Personnel",
  icon: ShieldCheck,
  items: [
    { title: "Approbations", url: "/approbations", icon: UserCheck, moduleKey: "gestion-rh.approbations" },
    { title: "Contrats Staff", url: "/contrats-staff", icon: ShieldCheck, moduleKey: "gestion-rh.contrats" },
    { title: "Documents", url: "/documents", icon: FileText, moduleKey: "gestion-rh.documents" },
    { title: "Structure", url: "/organisation", icon: Users, moduleKey: "gestion-rh.structure" },
  ],
};

// ── GROUPE C: MON ESPACE ──
const MON_ESPACE_ITEMS: NavItem[] = [
  { title: "Tableau de bord", url: "/dashboard", icon: LayoutDashboard },
  { title: "Mon Agenda", url: "/mon-agenda", icon: CalendarDays },
  { title: "Mes Missions", url: "/missions", icon: ClipboardList },
];

// ── PARENT SIMPLIFIED NAV ──
const PARENT_NAV_ITEMS: NavItem[] = [
  { title: "Tableau de bord", url: "/dashboard", icon: LayoutDashboard },
  { title: "Mes Enfants", url: "/eleves", icon: GraduationCap },
  { title: "Factures", url: "/frais-scolarite", icon: CreditCard },
];

const roleIcons: Record<UserRole, React.ElementType> = {
  "Super Admin": Globe,
  "Admin Mosquée": ShieldCheck,
  Responsable: UserCheck,
  "Enseignant / Oustaz": GraduationCap,
  Bénévole: Users,
  "Parent d'élève": Users,
};

// ── Reusable collapsible block ──
function SidebarBlock({
  block, location, isModuleVisible,
}: {
  block: NavBlock;
  location: ReturnType<typeof useLocation>;
  isModuleVisible: (key: string) => boolean;
}) {
  const visibleItems = block.items.filter((item) => {
    if (!item.moduleKey) return true;
    return isModuleVisible(item.moduleKey);
  });

  const hasActiveRoute = visibleItems.some((item) =>
    item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url)
  );
  const [open, setOpen] = useState(hasActiveRoute);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
            "cursor-pointer hover:bg-sidebar-accent/60 text-sidebar-foreground",
            hasActiveRoute && "text-sidebar-primary font-medium"
          )}
        >
          <block.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{block.label}</span>
          {visibleItems.length > 0 && (
            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40 transition-transform duration-200", open && "rotate-180")} />
          )}
        </button>
      </CollapsibleTrigger>

      {visibleItems.length > 0 && (
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

      {visibleItems.length === 0 && (
        <CollapsibleContent>
          <p className="ml-6 mt-1 mb-1 text-[11px] text-sidebar-foreground/30 italic border-l border-sidebar-border/40 pl-3 py-0.5">
            Aucun module actif
          </p>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

// ── Main Sidebar ──
export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, setRole, pole, setPole, displayName, isSuperAdmin, userDbRoles } = useRole();
  const { activePoles, org, allOrgs, overrideOrgId, setOverrideOrgId } = useOrganization();
  const { signOut, dbRole, permissions, refreshPermissions, impersonatedUser } = useAuth();
  const { hasAccess, isBypassing } = useModuleAccess();

  const isParentOnly = useMemo(() => {
    return userDbRoles.length > 0 && userDbRoles.every((r) => r === "parent") && !isSuperAdmin;
  }, [userDbRoles, isSuperAdmin]);

  const isGhostActive = !!impersonatedUser;
  const isPreviewingOtherRole = !isGhostActive && isSuperAdmin && role !== "Super Admin";
  const effectiveBypass = isBypassing && !isPreviewingOtherRole;

  // ── Preview permissions (for "Prévisualiser en tant que") ──
  const [previewPermissions, setPreviewPermissions] = useState<Set<string> | null>(null);
  const orgId = org?.id;
  const effectiveDbRole = UI_ROLE_TO_DB[role] ?? dbRole;

  const fetchPreviewPermissions = useCallback(async () => {
    if (effectiveBypass) { setPreviewPermissions(null); return; }
    if (!orgId || !effectiveDbRole) { setPreviewPermissions(null); return; }
    const { data, error } = await supabase.rpc("get_effective_permissions" as any, {
      p_org_id: orgId,
      p_role: effectiveDbRole,
    });
    if (error || !data) { setPreviewPermissions(null); return; }
    const allowed = new Set<string>();
    for (const row of data as any[]) {
      if (row.enabled ?? row.can_view) allowed.add(row.module);
    }
    setPreviewPermissions(allowed);
  }, [orgId, effectiveDbRole, effectiveBypass]);

  useEffect(() => { fetchPreviewPermissions(); }, [fetchPreviewPermissions]);

  useEffect(() => {
    if (orgId) refreshPermissions(orgId);
  }, [orgId, refreshPermissions, impersonatedUser]);

  useEffect(() => {
    if (!impersonatedUser && isSuperAdmin) setRole("Super Admin");
  }, [impersonatedUser, isSuperAdmin, setRole]);

  const isModuleVisible = useCallback((moduleKey: string): boolean => {
    if (!hasAccess(moduleKey)) return false;
    if (isPreviewingOtherRole && previewPermissions !== null) {
      if (CORE_MODULE_IDS.has(moduleKey)) {
        const meta = MODULE_MAP.get(moduleKey);
        const defaultRoles = meta?.defaultRoles ?? [];
        const previewDbRole = UI_ROLE_TO_DB[role];
        return defaultRoles.includes("*") || (previewDbRole ? defaultRoles.includes(previewDbRole) : false);
      }
      if (!previewPermissions.has(moduleKey)) return false;
    }
    return true;
  }, [hasAccess, isPreviewingOtherRole, previewPermissions, role]);

  // ── GROUPE A: Administration — visible for admin roles ──
  const visibleAdminItems = useMemo(
    () => ADMIN_ITEMS.filter((item) => isModuleVisible(item.moduleKey)),
    [isModuleVisible]
  );

  // ── GROUPE B: Pôles Métiers ──
  const visibleMetierBlocks = useMemo(
    () => METIER_BLOCKS.filter((block) => isModuleVisible(block.id)),
    [isModuleVisible]
  );
  const showLogistique = isModuleVisible(LOGISTIQUE_BLOCK.id);
  const showPersonnel = isModuleVisible(PERSONNEL_BLOCK.id);

  const handleSignOut = async () => { await signOut(); navigate("/login"); };
  const handleLogoClick = () => { window.location.href = getVitrineUrl(); };

  return (
    <Sidebar className="border-r-0">
      {/* ── Header: logo + org ── */}
      <SidebarHeader className="px-4 py-3">
        <button onClick={handleLogoClick} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <img src={masjidLabLogo} alt="MasjidLab" className="h-16 w-auto shrink-0 object-contain bg-transparent mix-blend-screen drop-shadow-[0_0_15px_rgba(62,212,226,0.3)]" />
          <div className="min-w-0 text-left">
            <h1 className="text-sm font-bold text-sidebar-primary-foreground tracking-tight truncate">
              {org?.name ?? "MasjidLab"}
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

        {/* ══════════ PARENT SIMPLIFIED NAV ══════════ */}
        {isParentOnly ? (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
              <UserCircle className="h-3 w-3" />
              Mon Espace Famille
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-px">
                {PARENT_NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/dashboard"}
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
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <>
            {/* ══════════ GROUPE A : ADMINISTRATION ══════════ */}
            {visibleAdminItems.length > 0 && (
              <SidebarGroup className="py-1">
                <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                  <Settings className="h-3 w-3" />
                  Administration
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-px">
                    {visibleAdminItems.map((item) => (
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
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* ══════════ GROUPE B : PÔLES MÉTIERS ══════════ */}
            {(visibleMetierBlocks.length > 0 || showLogistique || showPersonnel) && (
              <SidebarGroup className="py-1">
                <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" />
                  Pôles Métiers
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <div className="space-y-px">
                    {visibleMetierBlocks.map((block) => (
                      <SidebarBlock key={block.id} block={block} location={location} isModuleVisible={isModuleVisible} />
                    ))}
                    {showLogistique && (
                      <SidebarBlock block={LOGISTIQUE_BLOCK} location={location} isModuleVisible={isModuleVisible} />
                    )}
                    {showPersonnel && (
                      <SidebarBlock block={PERSONNEL_BLOCK} location={location} isModuleVisible={isModuleVisible} />
                    )}
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* ══════════ GROUPE C : MON ESPACE ══════════ */}
            <SidebarGroup className="py-1">
              <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                <UserCircle className="h-3 w-3" />
                Mon Espace
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-px">
                  {MON_ESPACE_ITEMS.map((item) => (
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
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className="px-3 py-2.5 space-y-2">
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

        {isSuperAdmin && (
          <div className={cn("space-y-1", isGhostActive && "opacity-40 pointer-events-none")}>
            <label className="text-[9px] uppercase tracking-wider text-sidebar-foreground/30 font-medium px-1">
              {isGhostActive
                ? "Désactivé (Mode Ghost)"
                : "Prévisualiser en tant que"}
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
        )}

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
