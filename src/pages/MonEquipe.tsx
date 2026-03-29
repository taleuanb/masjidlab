import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Loader2,
  RefreshCw,
  CalendarCheck,
  CalendarX2,
  Package,
  ClipboardList,
  Tag,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { format, isToday, isFuture, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useToast } from "@/hooks/use-toast";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ───────────────────────────────────────────────────────────
interface TeamMember {
  user_id: string;
  display_name: string;
  email: string | null;
  competences: string[] | null;
  availabilities: { id: string; type: string; start_time: string; end_time: string }[];
}

interface PoleAsset {
  id: string;
  nom: string;
  type: string;
  statut: string;
  description: string | null;
}

interface PoleEvent {
  id: string;
  titre: string;
  date: string;
  description: string | null;
}

const STATUT_STYLES: Record<string, string> = {
  Disponible: "bg-primary/10 text-primary border-primary/20",
  Réservé: "bg-accent/10 text-accent border-accent/20",
  Maintenance: "bg-destructive/10 text-destructive border-destructive/20",
};

// ─── Component ───────────────────────────────────────────────────────
export default function MonEquipePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { push: pushNotification } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [myPoleId, setMyPoleId] = useState<string | null>(null);
  const [myPoleName, setMyPoleName] = useState<string>("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [assets, setAssets] = useState<PoleAsset[]>([]);
  const [poleEvents, setPoleEvents] = useState<PoleEvent[]>([]);

  // Assign dialog
  const [assignTarget, setAssignTarget] = useState<TeamMember | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  // ─── Fetch ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Get my profile's pole_id
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("pole_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const poleId = (myProfile as any)?.pole_id;
      setMyPoleId(poleId);

      if (!poleId) {
        setMembers([]);
        setAssets([]);
        setPoleEvents([]);
        setLoading(false);
        return;
      }

      // 2. Get pole name
      const { data: poleRow } = await supabase
        .from("poles")
        .select("nom")
        .eq("id", poleId)
        .maybeSingle();
      setMyPoleName(poleRow?.nom || "Mon Pôle");

      // 3. Get team members with same pole_id
      const { data: teamProfiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, email, competences, pole_id")
        .eq("pole_id", poleId);

      // 4. Get availability for each member
      const memberIds = (teamProfiles || []).map((p: any) => p.user_id);
      const { data: allAvail } = memberIds.length > 0
        ? await supabase
            .from("user_availability")
            .select("id, user_id, type, start_time, end_time")
            .in("user_id", memberIds)
        : { data: [] };

      const availMap = new Map<string, typeof allAvail>();
      for (const a of allAvail || []) {
        const existing = availMap.get(a.user_id) || [];
        existing.push(a);
        availMap.set(a.user_id, existing);
      }

      setMembers(
        (teamProfiles || []).map((p: any) => ({
          user_id: p.user_id,
          display_name: p.display_name,
          email: p.email,
          competences: p.competences,
          availabilities: availMap.get(p.user_id) || [],
        }))
      );

      // 5. Get assets for this pole
      const { data: assetsData } = await supabase
        .from("assets")
        .select("id, nom, type, statut, description")
        .eq("pole_id", poleId)
        .order("nom");
      setAssets(assetsData || []);

      // 6. Get pole events (from events table matching pole name)
      const { data: eventsData } = await supabase
        .from("events")
        .select("id, titre, date, description")
        .eq("pole", poleRow?.nom || "")
        .gte("date", new Date().toISOString().slice(0, 10))
        .order("date")
        .limit(20);
      setPoleEvents(eventsData || []);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── Assign handler ────────────────────────────────────────────────
  const handleAssign = async () => {
    if (!assignTarget || !selectedEventId) return;
    setAssigning(true);
    try {
      // Update event's created_by to the assigned member
      const ev = poleEvents.find((e) => e.id === selectedEventId);
      const { data: currentEv } = await supabase
        .from("events")
        .select("description")
        .eq("id", selectedEventId)
        .maybeSingle();

      const newDesc = [
        currentEv?.description || "",
        `\n[Assigné : ${assignTarget.display_name}]`,
      ].join("").trim();

      await supabase
        .from("events")
        .update({ created_by: assignTarget.user_id, description: newDesc })
        .eq("id", selectedEventId);

      pushNotification({
        type: "presence",
        titre: "📋 Nouvelle tâche assignée",
        description: `Vous avez été assigné(e) à "${ev?.titre || "Événement"}" par votre responsable de pôle.`,
        destinataire: "Bénévole",
      });

      toast({
        title: "Membre assigné",
        description: `${assignTarget.display_name} a été assigné à "${ev?.titre}".`,
      });
      setAssignTarget(null);
      setSelectedEventId("");
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  // ─── Helpers ───────────────────────────────────────────────────────
  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const availSummary = (member: TeamMember) => {
    const upcoming = member.availabilities.filter((a) => {
      try { return isFuture(parseISO(a.end_time)) || isToday(parseISO(a.start_time)); } catch { return false; }
    });
    if (upcoming.length === 0) return { label: "Disponible", variant: "available" as const };
    return { label: `${upcoming.length} indispo.`, variant: "busy" as const };
  };

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div>
              <h1 className="text-xl font-bold text-foreground">Mon Équipe</h1>
              <p className="text-sm text-muted-foreground">
                {myPoleName ? `Pôle ${myPoleName}` : "Aucun pôle assigné"} — {members.length} membre{members.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !myPoleId ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-lg font-medium">Aucun pôle assigné</p>
              <p className="text-sm mt-1">
                Demandez à un administrateur de vous affecter à un pôle via la page Membres.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ─── Team Members ──────────────────────────────── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Membres de l'équipe
                </h2>
              </div>

              {members.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <p className="text-sm">Aucun membre dans ce pôle</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <AnimatePresence>
                    {members.map((m) => {
                      const avail = availSummary(m);
                      return (
                        <motion.div
                          key={m.user_id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <Card className="h-full">
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                                      {initials(m.display_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">{m.display_name}</p>
                                    <p className="text-xs text-muted-foreground">{m.email || "—"}</p>
                                  </div>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] h-5 ${
                                    avail.variant === "available"
                                      ? "bg-primary/10 text-primary border-primary/20"
                                      : "bg-destructive/10 text-destructive border-destructive/20"
                                  }`}
                                >
                                  {avail.variant === "available" ? (
                                    <CalendarCheck className="h-2.5 w-2.5 mr-0.5" />
                                  ) : (
                                    <CalendarX2 className="h-2.5 w-2.5 mr-0.5" />
                                  )}
                                  {avail.label}
                                </Badge>
                              </div>

                              {/* Availability details */}
                              {m.availabilities.length > 0 && (
                                <div className="space-y-1">
                                  {m.availabilities.slice(0, 2).map((a) => (
                                    <div key={a.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                      <CalendarX2 className="h-3 w-3 text-destructive/60" />
                                      <span className="capitalize">{a.type}</span>
                                      <span>·</span>
                                      <span>
                                        {format(parseISO(a.start_time), "dd/MM HH:mm", { locale: fr })}
                                        {" → "}
                                        {format(parseISO(a.end_time), "dd/MM HH:mm", { locale: fr })}
                                      </span>
                                    </div>
                                  ))}
                                  {m.availabilities.length > 2 && (
                                    <p className="text-[10px] text-muted-foreground/50">
                                      +{m.availabilities.length - 2} autre(s)
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Competences */}
                              <div className="flex flex-wrap gap-1">
                                {(m.competences || []).slice(0, 3).map((c) => (
                                  <Badge key={c} variant="outline" className="text-[9px] h-4 px-1.5 bg-secondary/50">
                                    <Tag className="h-2 w-2 mr-0.5" />{c}
                                  </Badge>
                                ))}
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-xs"
                                onClick={() => { setAssignTarget(m); setSelectedEventId(""); }}
                                disabled={poleEvents.length === 0}
                              >
                                <ClipboardList className="h-3.5 w-3.5 mr-1" />
                                Assigner à une tâche
                              </Button>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </section>

            <Separator />

            {/* ─── Pole Assets ───────────────────────────────── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Inventaire du pôle
                </h2>
                <Badge variant="outline" className="text-[10px] h-5">{assets.length}</Badge>
              </div>

              {assets.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <p className="text-sm">Aucun asset dans ce pôle</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {assets.map((a) => (
                    <Card key={a.id}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{a.nom}</p>
                            <p className="text-xs text-muted-foreground">{a.type}</p>
                            {a.description && (
                              <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">{a.description}</p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-5 shrink-0 ${STATUT_STYLES[a.statut] || ""}`}
                          >
                            {a.statut}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* ─── Assign Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!assignTarget} onOpenChange={(open) => !open && setAssignTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Assigner une tâche
            </DialogTitle>
            <DialogDescription>
              Assignez {assignTarget?.display_name} à un événement de votre pôle
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                  {assignTarget ? initials(assignTarget.display_name) : ""}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-foreground">{assignTarget?.display_name}</p>
                <div className="flex gap-1 mt-0.5">
                  {(assignTarget?.competences || []).slice(0, 2).map((c) => (
                    <Badge key={c} variant="outline" className="text-[9px] h-4 px-1">{c}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choisir un événement…" />
              </SelectTrigger>
              <SelectContent>
                {poleEvents.map((ev) => (
                  <SelectItem key={ev.id} value={ev.id}>
                    {ev.titre} — {format(new Date(ev.date), "dd MMM", { locale: fr })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)}>Annuler</Button>
            <Button onClick={handleAssign} disabled={assigning || !selectedEventId}>
              {assigning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Assigner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
