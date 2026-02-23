import { useState, useEffect, useCallback } from "react";
import {
  Building2, Plus, Trash2, Pencil, Loader2, Save,
  Layers, Tag, Package, RefreshCw, X, CheckCircle2,
  Snowflake, Wifi, Mic, Monitor, Speaker, Lock,
  Landmark, Truck, BookOpen, Heart, Radio, Zap, Crown, Star, GraduationCap, Check, ArrowRight,
} from "lucide-react";
import {
  PLAN_IDS, PLAN_META,
  getBusinessModules, getModulesForPlan, isPlanAtLeast, MODULE_MAP,
  type PlanId,
} from "@/config/module-registry";

import { MadrasaSettingsPanel } from "@/components/MadrasaSettingsPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ─── Types ────────────────────────────────────────────────────────────────────

type Floor = "RDC" | "1" | "2" | "3" | "4" | "EXT";

interface Room {
  id: string;
  floor: Floor;
  name: string;
  type: string;
  capacity: number;
  features: string[];
  statut: string;
  pole: string | null;
}

interface SkillTag {
  id: string;
  label: string;
}

interface Asset {
  id: string;
  nom: string;
  type: string;
  statut: string;
  description: string | null;
  pole_id: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FLOORS: { value: Floor; label: string }[] = [
  { value: "RDC", label: "Rez-de-chaussée" },
  { value: "1",   label: "1er Étage" },
  { value: "2",   label: "2ème Étage" },
  { value: "3",   label: "3ème Étage" },
  { value: "4",   label: "4ème Étage" },
  { value: "EXT", label: "Extérieur" },
];

const ROOM_TYPES = ["Prière Homme", "Prière Femme", "Classe", "Cuisine", "Bureau", "Parking", "Autre"];
const ASSET_STATUTS = ["Neuf", "Usagé", "En panne"];
const ALL_FEATURES = [
  { key: "clim",           icon: Snowflake, label: "Clim" },
  { key: "wifi",           icon: Wifi,      label: "Wifi" },
  { key: "micro",          icon: Mic,       label: "Micro" },
  { key: "vidéoprojecteur",icon: Monitor,   label: "Vidéo" },
  { key: "sono",           icon: Speaker,   label: "Sono" },
];

const STATUT_STYLES: Record<string, string> = {
  disponible: "bg-green-500/10 text-green-700 border-green-400/30",
  occupée:    "bg-destructive/10 text-destructive border-destructive/30",
  réservée:   "bg-accent/10 text-accent border-accent/30",
  maintenance:"bg-muted text-muted-foreground border-border",
};

// ─── Module & Plan Config — driven by module-registry ─────────────────────────

const BUSINESS_MODULES = getBusinessModules();

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { toast } = useToast();
  const { dbRole } = useAuth();
  const { orgId, activePoles, org } = useOrganization();
  const isAdmin = dbRole === "admin" || dbRole === "super_admin";
  const isResponsable = dbRole === "responsable";
  const canManageModules = isAdmin || isResponsable;
  const currentPlan = (org?.subscription_plan ?? "starter") as PlanId;
  const showMadrassa = activePoles.includes("education");

  // ── Tab: Pôles ──
  const [polesLoading, setPolesLoading] = useState(false);

  const togglePole = async (poleId: string) => {
    if (!orgId || !isAdmin) return;
    const isActive = activePoles.includes(poleId);
    const next = isActive
      ? activePoles.filter((p) => p !== poleId)
      : [...activePoles, poleId];
    setPolesLoading(true);
    const { error } = await supabase
      .from("organizations")
      .update({ active_poles: next })
      .eq("id", orgId);
    setPolesLoading(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      window.dispatchEvent(new CustomEvent("org-poles-updated", { detail: { active_poles: next } }));
      toast({
        title: isActive ? "Pôle désactivé" : "Pôle activé",
        description: MODULE_MAP.get(poleId)?.label ?? poleId,
      });
    }
  };


  // ── Tab: Espaces ──
  const [rooms, setRooms]           = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomDialog, setRoomDialog] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomSaving, setRoomSaving] = useState(false);
  const [roomForm, setRoomForm]     = useState<{
    floor: Floor; name: string; type: string;
    capacity: string; features: string[]; statut: string; pole: string;
  }>({ floor: "RDC", name: "", type: "Classe", capacity: "0", features: [], statut: "disponible", pole: "" });

  // ── Tab: Compétences ──
  const [skills, setSkills]           = useState<SkillTag[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [newSkill, setNewSkill]       = useState("");
  const [skillSaving, setSkillSaving] = useState(false);

  // ── Tab: Inventaire ──
  const [assets, setAssets]           = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetDialog, setAssetDialog] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [assetSaving, setAssetSaving] = useState(false);
  const [assetForm, setAssetForm]     = useState({ nom: "", type: "", statut: "Neuf", description: "" });

  // ─── Fetchers ────────────────────────────────────────────────────────────

  const fetchRooms = useCallback(async () => {
    setRoomsLoading(true);
    let q = supabase.from("rooms").select("*").order("floor").order("name");
    if (orgId) q = q.eq("org_id", orgId);
    const { data, error } = await q;
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else setRooms((data || []) as Room[]);
    setRoomsLoading(false);
  }, [toast, orgId]);

  const fetchSkills = useCallback(async () => {
    setSkillsLoading(true);
    const { data, error } = await supabase.from("skills_library").select("*").order("label");
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else setSkills((data || []) as SkillTag[]);
    setSkillsLoading(false);
  }, [toast]);

  const fetchAssets = useCallback(async () => {
    setAssetsLoading(true);
    let q = supabase.from("assets").select("*").order("nom");
    if (orgId) q = q.eq("org_id", orgId);
    const { data, error } = await q;
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else setAssets((data || []) as Asset[]);
    setAssetsLoading(false);
  }, [toast, orgId]);

  useEffect(() => { fetchRooms(); fetchSkills(); fetchAssets(); }, [fetchRooms, fetchSkills, fetchAssets]);

  // ─── Room Handlers ────────────────────────────────────────────────────────

  const openAddRoom = () => {
    setEditingRoom(null);
    setRoomForm({ floor: "RDC", name: "", type: "Classe", capacity: "0", features: [], statut: "disponible", pole: "" });
    setRoomDialog(true);
  };
  const openEditRoom = (r: Room) => {
    setEditingRoom(r);
    setRoomForm({ floor: r.floor, name: r.name, type: r.type, capacity: String(r.capacity), features: r.features, statut: r.statut, pole: r.pole || "" });
    setRoomDialog(true);
  };
  const toggleFeature = (key: string) =>
    setRoomForm((f) => ({
      ...f,
      features: f.features.includes(key) ? f.features.filter((x) => x !== key) : [...f.features, key],
    }));

  const handleSaveRoom = async () => {
    if (!roomForm.name.trim()) return;
    setRoomSaving(true);
    const payload = {
      floor: roomForm.floor,
      name: roomForm.name.trim(),
      type: roomForm.type,
      capacity: parseInt(roomForm.capacity) || 0,
      features: roomForm.features,
      statut: roomForm.statut,
      pole: roomForm.pole.trim() || null,
      ...(orgId ? { org_id: orgId } : {}),
    };
    try {
      if (editingRoom) {
        const { error } = await supabase.from("rooms").update(payload).eq("id", editingRoom.id);
        if (error) throw error;
        toast({ title: "Espace mis à jour" });
      } else {
        const { error } = await supabase.from("rooms").insert(payload);
        if (error) throw error;
        toast({ title: "Espace créé", description: `"${payload.name}" ajouté.` });
      }
      setRoomDialog(false);
      fetchRooms();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setRoomSaving(false);
    }
  };

  const handleDeleteRoom = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Espace supprimé", description: `"${name}" retiré.` });
      fetchRooms();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  // ─── Skills Handlers ──────────────────────────────────────────────────────

  const handleAddSkill = async () => {
    const label = newSkill.trim();
    if (!label) return;
    setSkillSaving(true);
    try {
      const { error } = await supabase.from("skills_library").insert({ label });
      if (error) throw error;
      setNewSkill("");
      toast({ title: "Compétence ajoutée", description: label });
      fetchSkills();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSkillSaving(false);
    }
  };

  const handleDeleteSkill = async (id: string, label: string) => {
    try {
      const { error } = await supabase.from("skills_library").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Compétence supprimée", description: label });
      fetchSkills();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  // ─── Asset Handlers ───────────────────────────────────────────────────────

  const openAddAsset = () => {
    setEditingAsset(null);
    setAssetForm({ nom: "", type: "", statut: "Neuf", description: "" });
    setAssetDialog(true);
  };
  const openEditAsset = (a: Asset) => {
    setEditingAsset(a);
    setAssetForm({ nom: a.nom, type: a.type, statut: a.statut, description: a.description || "" });
    setAssetDialog(true);
  };
  const handleSaveAsset = async () => {
    if (!assetForm.nom.trim()) return;
    setAssetSaving(true);
    const payload = {
      nom: assetForm.nom.trim(),
      type: assetForm.type.trim() || "Matériel",
      statut: assetForm.statut,
      description: assetForm.description.trim() || null,
      ...(orgId ? { org_id: orgId } : {}),
    };
    try {
      if (editingAsset) {
        const { error } = await supabase.from("assets").update(payload).eq("id", editingAsset.id);
        if (error) throw error;
        toast({ title: "Matériel mis à jour" });
      } else {
        const { error } = await supabase.from("assets").insert(payload);
        if (error) throw error;
        toast({ title: "Matériel ajouté", description: payload.nom });
      }
      setAssetDialog(false);
      fetchAssets();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setAssetSaving(false);
    }
  };

  const ASSET_STATUT_STYLES: Record<string, string> = {
    "Neuf":     "bg-green-500/10 text-green-700 border-green-400/30",
    "Usagé":    "bg-accent/10 text-accent border-accent/30",
    "En panne": "bg-destructive/10 text-destructive border-destructive/30",
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <div>
            <h1 className="text-xl font-bold text-foreground">Configuration</h1>
            <p className="text-sm text-muted-foreground">Espaces, compétences et inventaire du complexe</p>
          </div>
        </div>

        <Tabs defaultValue="poles" className="space-y-4">
          <TabsList className={`grid w-full max-w-2xl ${showMadrassa ? "grid-cols-5" : "grid-cols-4"}`}>
            <TabsTrigger value="poles" className="gap-1.5 text-xs">
              <Zap className="h-3.5 w-3.5" />Plan & Modules
            </TabsTrigger>
            <TabsTrigger value="espaces" className="gap-1.5 text-xs">
              <Layers className="h-3.5 w-3.5" />Espaces
            </TabsTrigger>
            <TabsTrigger value="competences" className="gap-1.5 text-xs">
              <Tag className="h-3.5 w-3.5" />Compétences
            </TabsTrigger>
            <TabsTrigger value="inventaire" className="gap-1.5 text-xs">
              <Package className="h-3.5 w-3.5" />Inventaire
            </TabsTrigger>
            {showMadrassa && (
              <TabsTrigger value="madrassa" className="gap-1.5 text-xs">
                <GraduationCap className="h-3.5 w-3.5" />Madrassa
              </TabsTrigger>
            )}
          </TabsList>

          {/* ═══════════ PLAN & MODULES ═══════════ */}
          <TabsContent value="poles" className="space-y-6">

            {/* ── Cartes de Plan ── */}
            <div>
              <h2 className="text-sm font-semibold mb-1">Abonnement</h2>
              <p className="text-xs text-muted-foreground mb-4">Comparez les plans et les modules métier inclus.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLAN_IDS.map((plan) => {
                  const isCurrent = currentPlan === plan;
                  const planMeta = PLAN_META[plan];
                  const PlanIcon = planMeta.icon;
                  const modules = getModulesForPlan(plan);
                  const isUpgrade = PLAN_META[plan].order > PLAN_META[currentPlan].order;

                  return (
                    <Card
                      key={plan}
                      className={`relative transition-all ${
                        isCurrent
                          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                          : "border-border"
                      }`}
                    >
                      {isCurrent && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                          <Badge className="bg-primary text-primary-foreground text-[10px] px-2.5 py-0.5 shadow-sm">
                            Plan Actuel
                          </Badge>
                        </div>
                      )}
                      <CardHeader className="pb-3 pt-5 text-center">
                        <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${
                          isCurrent ? "gradient-emerald" : "bg-muted"
                        }`}>
                          <PlanIcon className={`h-5 w-5 ${isCurrent ? "text-primary-foreground" : "text-muted-foreground"}`} />
                        </div>
                        <CardTitle className="text-base mt-2">{planMeta.label}</CardTitle>
                      </CardHeader>
                      <CardContent className="pb-4 px-4">
                        <ul className="space-y-2">
                          {modules.map((mod) => (
                            <li key={mod.id} className="flex items-center gap-2 text-xs">
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="text-foreground">{mod.label}</span>
                            </li>
                          ))}
                        </ul>
                        {isUpgrade && (
                          <Button size="sm" className="w-full mt-4 gap-1.5" variant="default">
                            Passer à {planMeta.label}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {isCurrent && (
                          <p className="text-center text-[11px] text-muted-foreground mt-4">
                            Votre plan actif
                          </p>
                        )}
                        {!isCurrent && !isUpgrade && (
                          <p className="text-center text-[11px] text-muted-foreground mt-4">
                            Inclus dans votre plan
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* ── Gestion des Modules Métier ── */}

            <div>
              <h2 className="text-sm font-semibold mb-1">Gestion des Modules Métier</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Activez ou désactivez les modules inclus dans votre abonnement.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BUSINESS_MODULES.map((mod) => {
                  const isActive = activePoles.includes(mod.id);
                  const included = isPlanAtLeast(currentPlan, mod.minPlan);
                  const PoleIcon = mod.icon;
                  const badgePlan = PLAN_META[mod.minPlan];
                  const BadgeIcon = badgePlan.icon;

                  return (
                    <div
                      key={mod.id}
                      className={`relative flex items-start gap-4 rounded-xl border p-4 transition-colors ${
                        included
                          ? isActive
                            ? "bg-primary/5 border-primary/25"
                            : "bg-card border-border"
                          : "bg-muted/30 border-border opacity-70"
                      }`}
                    >
                      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        included && isActive ? "gradient-emerald" : "bg-muted"
                      }`}>
                        {included ? (
                          <PoleIcon className={`h-4 w-4 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                        ) : (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{mod.label}</p>
                          {!included && (
                            <Badge
                              variant="outline"
                              className={`gap-1 text-[10px] px-1.5 py-0 h-4 ${badgePlan.badgeCls}`}
                            >
                              <Lock className="h-2.5 w-2.5" />
                              Plan {badgePlan.label}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                          {mod.description}
                        </p>
                        {!included && (
                          <button className="mt-1.5 text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1">
                            <ArrowRight className="h-3 w-3" />
                            Débloquer avec le plan {badgePlan.label}
                          </button>
                        )}
                      </div>

                      {included ? (
                        <Switch
                          checked={isActive}
                          disabled={!canManageModules || polesLoading}
                          onCheckedChange={() => togglePole(mod.id)}
                          className="mt-0.5 shrink-0"
                        />
                      ) : (
                        <Lock className="h-4 w-4 text-muted-foreground/40 mt-1.5 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>

              {!canManageModules && (
                <p className="text-xs text-muted-foreground text-center pt-3">
                  Seul un administrateur ou responsable peut gérer les modules métier.
                </p>
              )}
            </div>
          </TabsContent>

          {/* ═══════════ ESPACES ═══════════ */}

          <TabsContent value="espaces" className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{rooms.length} espace{rooms.length !== 1 ? "s" : ""} configuré{rooms.length !== 1 ? "s" : ""}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchRooms} disabled={roomsLoading}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${roomsLoading ? "animate-spin" : ""}`} />Actualiser
                </Button>
                {isAdmin && (
                  <Button size="sm" onClick={openAddRoom}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Ajouter un espace
                  </Button>
                )}
              </div>
            </div>

            {roomsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              FLOORS.map((fl) => {
                const flRooms = rooms.filter((r) => r.floor === fl.value);
                if (flRooms.length === 0) return null;
                return (
                  <Card key={fl.value}>
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        {fl.label}
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 ml-1">{flRooms.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-4 w-[200px]">Nom</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="w-[80px]">Capacité</TableHead>
                            <TableHead>Features</TableHead>
                            <TableHead>Statut</TableHead>
                            {isAdmin && <TableHead className="w-[80px]" />}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {flRooms.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell className="pl-4 font-medium text-sm">{r.name}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{r.type}</TableCell>
                              <TableCell className="text-xs">{r.capacity} pl.</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {r.features.map((f) => {
                                    const info = ALL_FEATURES.find((x) => x.key === f);
                                    if (!info) return null;
                                    return (
                                      <span key={f} className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                        <info.icon className="h-2.5 w-2.5" />{info.label}
                                      </span>
                                    );
                                  })}
                                  {r.features.length === 0 && <span className="text-[11px] text-muted-foreground">—</span>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-[10px] capitalize ${STATUT_STYLES[r.statut] || ""}`}>
                                  {r.statut}
                                </Badge>
                              </TableCell>
                              {isAdmin && (
                                <TableCell>
                                  <div className="flex gap-1 justify-end">
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditRoom(r)}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive/70 hover:text-destructive" onClick={() => handleDeleteRoom(r.id, r.name)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* ═══════════ COMPÉTENCES ═══════════ */}
          <TabsContent value="competences" className="space-y-4">
            {isAdmin && (
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nouvelle compétence (ex: Premiers secours)…"
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddSkill()}
                      className="h-9 flex-1"
                    />
                    <Button size="sm" onClick={handleAddSkill} disabled={skillSaving || !newSkill.trim()}>
                      {skillSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                      Ajouter
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">Ces tags apparaîtront dans le profil de chaque bénévole lors de l'affectation.</p>
                </CardContent>
              </Card>
            )}

            {skillsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    Dictionnaire officiel
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">{skills.length} tags</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {skills.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucune compétence définie</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {skills.map((s) => (
                        <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/50 px-3 py-1 text-xs font-medium text-secondary-foreground group">
                          <CheckCircle2 className="h-3 w-3 text-primary" />
                          {s.label}
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteSkill(s.id, s.label)}
                              className="ml-1 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══════════ INVENTAIRE ═══════════ */}
          <TabsContent value="inventaire" className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{assets.length} article{assets.length !== 1 ? "s" : ""}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchAssets} disabled={assetsLoading}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${assetsLoading ? "animate-spin" : ""}`} />Actualiser
                </Button>
                {isAdmin && (
                  <Button size="sm" onClick={openAddAsset}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Ajouter du matériel
                  </Button>
                )}
              </div>
            </div>

            {assetsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4 w-[220px]">Nom</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>État</TableHead>
                        <TableHead>Description</TableHead>
                        {isAdmin && <TableHead className="w-[80px]" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assets.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Aucun matériel enregistré</TableCell></TableRow>
                      ) : assets.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="pl-4 font-medium text-sm">{a.nom}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{a.type}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${ASSET_STATUT_STYLES[a.statut] || "bg-muted text-muted-foreground"}`}>
                              {a.statut}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{a.description || "—"}</TableCell>
                          {isAdmin && (
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditAsset(a)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══════════ MADRASSA ═══════════ */}
          {showMadrassa && (
            <TabsContent value="madrassa">
              <MadrasaSettingsPanel />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* ─── Room Dialog ─────────────────────────────────────────────── */}
      <Dialog open={roomDialog} onOpenChange={setRoomDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRoom ? "Modifier l'espace" : "Ajouter un espace"}</DialogTitle>
            <DialogDescription>{editingRoom ? `"${editingRoom.name}"` : "Nouvel espace dans le complexe"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Étage</Label>
                <Select value={roomForm.floor} onValueChange={(v) => setRoomForm((f) => ({ ...f, floor: v as Floor }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{FLOORS.map((fl) => <SelectItem key={fl.value} value={fl.value}>{fl.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={roomForm.type} onValueChange={(v) => setRoomForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{ROOM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nom de l'espace *</Label>
              <Input value={roomForm.name} onChange={(e) => setRoomForm((f) => ({ ...f, name: e.target.value }))} className="h-9" placeholder="Ex: Salle de Prière Principale" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Capacité (places)</Label>
                <Input type="number" min={0} value={roomForm.capacity} onChange={(e) => setRoomForm((f) => ({ ...f, capacity: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Statut</Label>
                <Select value={roomForm.statut} onValueChange={(v) => setRoomForm((f) => ({ ...f, statut: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disponible">Disponible</SelectItem>
                    <SelectItem value="occupée">Occupée</SelectItem>
                    <SelectItem value="réservée">Réservée</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pôle responsable <span className="text-muted-foreground">(optionnel)</span></Label>
              <Input value={roomForm.pole} onChange={(e) => setRoomForm((f) => ({ ...f, pole: e.target.value }))} className="h-9" placeholder="Imam, Accueil…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Équipements / Features</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {ALL_FEATURES.map(({ key, icon: Icon, label }) => {
                  const active = roomForm.features.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleFeature(key)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:border-primary/50"}`}
                    >
                      <Icon className="h-3 w-3" />{label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomDialog(false)}>Annuler</Button>
            <Button onClick={handleSaveRoom} disabled={roomSaving || !roomForm.name.trim()}>
              {roomSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {editingRoom ? "Enregistrer" : "Créer l'espace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Asset Dialog ─────────────────────────────────────────────── */}
      <Dialog open={assetDialog} onOpenChange={setAssetDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingAsset ? "Modifier le matériel" : "Ajouter du matériel"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Nom *</Label>
              <Input value={assetForm.nom} onChange={(e) => setAssetForm((f) => ({ ...f, nom: e.target.value }))} className="h-9" placeholder="Ex: Sono portable" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Catégorie / Type</Label>
              <Input value={assetForm.type} onChange={(e) => setAssetForm((f) => ({ ...f, type: e.target.value }))} className="h-9" placeholder="Sono, Tables, Chaises…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">État</Label>
              <Select value={assetForm.statut} onValueChange={(v) => setAssetForm((f) => ({ ...f, statut: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{ASSET_STATUTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description <span className="text-muted-foreground">(optionnel)</span></Label>
              <Input value={assetForm.description} onChange={(e) => setAssetForm((f) => ({ ...f, description: e.target.value }))} className="h-9" placeholder="Notes complémentaires…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetDialog(false)}>Annuler</Button>
            <Button onClick={handleSaveAsset} disabled={assetSaving || !assetForm.nom.trim()}>
              {assetSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
