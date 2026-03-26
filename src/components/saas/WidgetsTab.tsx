import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2, RefreshCw, Check, Pencil, ArrowUp, ArrowDown,
  LayoutGrid, Plus, Search,
  GraduationCap, Receipt, CalendarDays, BookOpen, Activity,
  BarChart3, UserCheck, Users, UserPlus, Wallet, ShieldAlert,
  DoorOpen, CalendarClock, Landmark, Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WIDGET_REGISTRY, WIDGET_ICON_MAP } from "@/config/widget-registry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DB_ROLE_TO_UI } from "@/contexts/RoleContext";

interface WidgetConfig {
  id: string;
  widget_key: string;
  label: string;
  required_plans: string[];
  allowed_roles: string[];
  required_pole: string | null;
  priority: number;
  is_enabled: boolean;
}

const ALL_PLANS = ["starter", "pro", "elite"];
const ALL_ROLES = ["super_admin", "admin", "responsable", "enseignant", "benevole", "parent"];
const ALL_POLES = [
  { value: "", label: "Aucun (Global)" },
  { value: "education", label: "Éducation" },
  { value: "logistics", label: "Logistique" },
  { value: "finance", label: "Finance" },
];

const PLAN_BADGE: Record<string, string> = {
  starter: "bg-muted text-muted-foreground border-border",
  pro: "bg-blue-500/10 text-blue-700 border-blue-400/30",
  elite: "bg-amber-500/10 text-amber-700 border-amber-400/30",
};

const ROLE_BADGE: Record<string, string> = {
  super_admin: "bg-purple-500/10 text-purple-700 border-purple-400/30",
  admin: "bg-primary/10 text-primary border-primary/30",
  responsable: "bg-blue-500/10 text-blue-700 border-blue-400/30",
  enseignant: "bg-emerald-500/10 text-emerald-700 border-emerald-400/30",
  benevole: "bg-orange-500/10 text-orange-700 border-orange-400/30",
  parent: "bg-pink-500/10 text-pink-700 border-pink-400/30",
};

const POLE_LABEL: Record<string, string> = {
  education: "📚 Éducation",
  logistics: "📍 Logistique",
  finance: "💰 Finance",
};

// ─── Icon component map ─────────────────────────────────────────────
const ICON_COMPONENTS: Record<string, React.ComponentType<any>> = {
  "bar-chart-3": BarChart3,
  "user-check": UserCheck,
  "users": Users,
  "user-plus": UserPlus,
  "wallet": Wallet,
  "shield-alert": ShieldAlert,
  "activity": Activity,
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  "receipt": Receipt,
  "calendar-days": CalendarDays,
  "door-open": DoorOpen,
  "calendar-clock": CalendarClock,
  "landmark": Landmark,
  "package": Package,
};

function WidgetIcon({ widgetKey }: { widgetKey: string }) {
  const iconName = WIDGET_ICON_MAP[widgetKey];
  const IconComp = iconName ? ICON_COMPONENTS[iconName] : null;
  if (!IconComp) return <LayoutGrid className="h-4 w-4 text-muted-foreground" />;
  return <IconComp className="h-4 w-4 text-primary" />;
}

export function WidgetsTab() {
  const { toast } = useToast();
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editWidget, setEditWidget] = useState<WidgetConfig | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Filter state ─────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterPole, setFilterPole] = useState("all");

  // Edit form state
  const [editLabel, setEditLabel] = useState("");
  const [editPlans, setEditPlans] = useState<string[]>([]);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editPole, setEditPole] = useState("");
  const [editPriority, setEditPriority] = useState(500);

  const fetchWidgets = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("saas_widget_configs")
        .select("*")
        .order("priority", { ascending: false });
      if (error) throw error;
      setWidgets((data ?? []) as WidgetConfig[]);
    } catch (err: unknown) {
      toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchWidgets(); }, [fetchWidgets]);

  // ─── Filtered widgets ─────────────────────────────────────────────
  const filteredWidgets = useMemo(() => {
    return widgets.filter((w) => {
      // Text search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!w.label.toLowerCase().includes(q) && !w.widget_key.toLowerCase().includes(q)) {
          return false;
        }
      }
      // Role filter
      if (filterRole !== "all") {
        if (!w.allowed_roles.includes(filterRole)) return false;
      }
      // Pole filter
      if (filterPole !== "all") {
        if (filterPole === "global") {
          if (w.required_pole) return false;
        } else {
          if (w.required_pole !== filterPole) return false;
        }
      }
      return true;
    });
  }, [widgets, searchQuery, filterRole, filterPole]);

  // ─── Sync missing registry widgets to DB ──────────────────────────
  const syncRegistryToDb = async () => {
    setSyncing(true);
    try {
      const existingKeys = new Set(widgets.map((w) => w.widget_key));
      const missing = WIDGET_REGISTRY.filter((w) => !existingKeys.has(w.id));

      if (missing.length === 0) {
        toast({ title: "Déjà synchronisé", description: "Tous les widgets sont déjà enregistrés." });
        setSyncing(false);
        return;
      }

      const rows = missing.map((w) => ({
        widget_key: w.id,
        label: w.label,
        required_plans: ALL_PLANS,
        allowed_roles: w.allowedRoles,
        required_pole: w.requiredPole,
        priority: w.defaultWeight,
        is_enabled: true,
      }));

      const { error } = await supabase.from("saas_widget_configs").insert(rows);
      if (error) throw error;

      toast({
        title: `${missing.length} widget${missing.length > 1 ? "s" : ""} ajouté${missing.length > 1 ? "s" : ""}`,
        description: missing.map((m) => m.label).join(", "),
      });
      fetchWidgets();
    } catch (err: unknown) {
      toast({ title: "Erreur sync", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const missingCount = WIDGET_REGISTRY.filter(
    (w) => !widgets.some((db) => db.widget_key === w.id)
  ).length;

  const openEdit = (w: WidgetConfig) => {
    setEditWidget(w);
    setEditLabel(w.label);
    setEditPlans([...w.required_plans]);
    setEditRoles([...w.allowed_roles]);
    setEditPole(w.required_pole ?? "");
    setEditPriority(w.priority);
  };

  const togglePlan = (plan: string) => {
    setEditPlans((prev) =>
      prev.includes(plan) ? prev.filter((p) => p !== plan) : [...prev, plan]
    );
  };

  const toggleRole = (role: string) => {
    setEditRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSave = async () => {
    if (!editWidget) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("saas_widget_configs")
        .update({
          label: editLabel,
          required_plans: editPlans,
          allowed_roles: editRoles,
          required_pole: editPole || null,
          priority: editPriority,
        })
        .eq("id", editWidget.id);
      if (error) throw error;
      toast({ title: "Widget mis à jour" });
      setEditWidget(null);
      fetchWidgets();
    } catch (err: unknown) {
      toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (w: WidgetConfig) => {
    try {
      const { error } = await supabase
        .from("saas_widget_configs")
        .update({ is_enabled: !w.is_enabled })
        .eq("id", w.id);
      if (error) throw error;
      setWidgets((prev) =>
        prev.map((x) => (x.id === w.id ? { ...x, is_enabled: !x.is_enabled } : x))
      );
    } catch (err: unknown) {
      toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleMovePriority = async (w: WidgetConfig, direction: "up" | "down") => {
    const delta = direction === "up" ? 10 : -10;
    const newPriority = w.priority + delta;
    try {
      const { error } = await supabase
        .from("saas_widget_configs")
        .update({ priority: newPriority })
        .eq("id", w.id);
      if (error) throw error;
      setWidgets((prev) =>
        prev
          .map((x) => (x.id === w.id ? { ...x, priority: newPriority } : x))
          .sort((a, b) => b.priority - a.priority)
      );
    } catch (err: unknown) {
      toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-primary" />
              {widgets.length} widget{widgets.length > 1 ? "s" : ""} configuré{widgets.length > 1 ? "s" : ""}
            </CardTitle>
            <div className="flex items-center gap-2">
              {missingCount > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={syncRegistryToDb}
                  disabled={syncing}
                  className="gap-1.5"
                >
                  {syncing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Synchroniser ({missingCount} nouveau{missingCount > 1 ? "x" : ""})
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={fetchWidgets}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* ─── Filter bar ──────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border mt-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher un widget…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[180px] h-8 text-sm">
                <SelectValue placeholder="Filtrer par rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                {ALL_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {DB_ROLE_TO_UI[r] ?? r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPole} onValueChange={setFilterPole}>
              <SelectTrigger className="w-[170px] h-8 text-sm">
                <SelectValue placeholder="Filtrer par pôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les pôles</SelectItem>
                <SelectItem value="global">Global (aucun pôle)</SelectItem>
                <SelectItem value="education">📚 Éducation</SelectItem>
                <SelectItem value="logistics">📍 Logistique</SelectItem>
                <SelectItem value="finance">💰 Finance</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || filterRole !== "all" || filterPole !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => { setSearchQuery(""); setFilterRole("all"); setFilterPole("all"); }}
              >
                Réinitialiser
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Actif</TableHead>
                <TableHead>Widget</TableHead>
                <TableHead>Pôle</TableHead>
                <TableHead>Plans</TableHead>
                <TableHead>Rôles</TableHead>
                <TableHead className="w-20 text-center">Priorité</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWidgets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                    Aucun widget ne correspond aux filtres sélectionnés
                  </TableCell>
                </TableRow>
              ) : (
                filteredWidgets.map((w) => (
                  <TableRow key={w.id} className={!w.is_enabled ? "opacity-50" : ""}>
                    <TableCell>
                      <Switch
                        checked={w.is_enabled}
                        onCheckedChange={() => handleToggleEnabled(w)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <WidgetIcon widgetKey={w.widget_key} />
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{w.label}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{w.widget_key}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {w.required_pole ? (
                        <Badge variant="outline" className="text-[10px]">
                          {POLE_LABEL[w.required_pole] ?? w.required_pole}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Global</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {w.required_plans.map((p) => (
                          <Badge
                            key={p}
                            variant="outline"
                            className={`text-[10px] capitalize ${PLAN_BADGE[p] ?? ""}`}
                          >
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {w.allowed_roles.length === 0 ? (
                          <span className="text-muted-foreground text-xs">Tous</span>
                        ) : w.allowed_roles.slice(0, 3).map((r) => (
                          <Badge
                            key={r}
                            variant="outline"
                            className={`text-[10px] ${ROLE_BADGE[r] ?? ""}`}
                          >
                            {DB_ROLE_TO_UI[r] ?? r}
                          </Badge>
                        ))}
                        {w.allowed_roles.length > 3 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{w.allowed_roles.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMovePriority(w, "up")}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <span className="text-xs font-mono w-8 text-center">{w.priority}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMovePriority(w, "down")}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openEdit(w)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Éditer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Widget Dialog */}
      <Dialog open={!!editWidget} onOpenChange={() => setEditWidget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editWidget && <WidgetIcon widgetKey={editWidget.widget_key} />}
              Configurer le widget
            </DialogTitle>
            <DialogDescription>
              Modifiez la visibilité et l'ordre de <strong>{editWidget?.label}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nom d'affichage</label>
              <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Plans requis</label>
              <div className="flex gap-3">
                {ALL_PLANS.map((p) => (
                  <label key={p} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={editPlans.includes(p)}
                      onCheckedChange={() => togglePlan(p)}
                    />
                    <span className="text-sm capitalize">{p}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Rôles autorisés</label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={editRoles.includes(r)}
                      onCheckedChange={() => toggleRole(r)}
                    />
                    <span className="text-sm">{DB_ROLE_TO_UI[r] ?? r}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Pôle lié</label>
              <Select value={editPole} onValueChange={setEditPole}>
                <SelectTrigger>
                  <SelectValue placeholder="Aucun (Global)" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_POLES.map((p) => (
                    <SelectItem key={p.value || "none"} value={p.value || "none"}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Priorité (plus haut = affiché en premier)</label>
              <Input
                type="number"
                value={editPriority}
                onChange={(e) => setEditPriority(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditWidget(null)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !editLabel.trim() || editPlans.length === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
