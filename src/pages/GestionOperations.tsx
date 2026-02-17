import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  UserCheck,
  Users,
  Clock,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Zap,
  Filter,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { format, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/contexts/RoleContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useToast } from "@/hooks/use-toast";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { reservationsMock } from "@/data/mock-data";
import type { Pole } from "@/types/amm";

const POLES: Pole[] = ["Imam", "École (Avenir)", "Social (ABD)", "Accueil", "Récolte", "Digital", "Com", "Parking"];

// ─── Types ───────────────────────────────────────────────────────────
interface UrgentAlert {
  id: string;
  event_id: string | null;
  event_titre: string;
  requester_id: string;
  requester_name: string;
  pole: string | null;
  message: string;
  resolved: boolean;
  created_at: string;
}

interface ReplacementRow {
  id: string;
  event_id: string;
  requester_id: string;
  replacement_id: string | null;
  status: string;
  note: string | null;
  created_at: string;
  event_titre: string;
  event_date: string | null;
  requester_name: string;
  replacement_name: string;
  pole: string | null;
}

interface MatchCandidate {
  user_id: string;
  display_name: string;
  competences: string[];
}

// ─── Component ───────────────────────────────────────────────────────
export default function GestionOperationsPage() {
  const { user } = useAuth();
  const { role, pole: userPole } = useRole();
  const { toast } = useToast();
  const { push: pushNotification } = useNotifications();

  const [alerts, setAlerts] = useState<UrgentAlert[]>([]);
  const [requests, setRequests] = useState<ReplacementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [poleFilter, setPoleFilter] = useState<string>("all");

  // Urgent assign dialog
  const [assignTarget, setAssignTarget] = useState<UrgentAlert | null>(null);
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState<string | null>(null);

  // ─── Fetch ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch alerts
      const { data: alertData } = await supabase
        .from("urgent_alerts")
        .select("*")
        .eq("resolved", false)
        .order("created_at", { ascending: false });
      setAlerts(alertData || []);

      // Fetch replacement requests
      const { data: reqData } = await supabase
        .from("replacement_requests")
        .select("*")
        .order("created_at", { ascending: false });

      const enriched: ReplacementRow[] = [];
      for (const row of reqData || []) {
        const { data: ev } = await supabase
          .from("events")
          .select("titre, date, pole")
          .eq("id", row.event_id)
          .maybeSingle();

        const { data: reqProfile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", row.requester_id)
          .maybeSingle();

        let replacement_name = "";
        if (row.replacement_id) {
          const { data: repProfile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", row.replacement_id)
            .maybeSingle();
          replacement_name = repProfile?.display_name || "Utilisateur";
        }

        enriched.push({
          ...row,
          event_titre: ev?.titre || "Événement inconnu",
          event_date: ev?.date || null,
          requester_name: reqProfile?.display_name || "Utilisateur",
          replacement_name,
          pole: ev?.pole || null,
        });
      }
      setRequests(enriched);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── Filtering ─────────────────────────────────────────────────────
  const effectiveFilter = role === "Imam/Chef de Pôle" && poleFilter === "all" ? userPole : poleFilter;

  const filteredAlerts = useMemo(() =>
    effectiveFilter === "all" ? alerts : alerts.filter((a) => a.pole === effectiveFilter),
    [alerts, effectiveFilter]
  );

  const pendingRequests = useMemo(() => {
    const pending = requests.filter((r) => r.status === "En attente");
    return effectiveFilter === "all" ? pending : pending.filter((r) => r.pole === effectiveFilter);
  }, [requests, effectiveFilter]);

  const processedRequests = useMemo(() => {
    const processed = requests.filter((r) => r.status !== "En attente");
    return effectiveFilter === "all" ? processed : processed.filter((r) => r.pole === effectiveFilter);
  }, [requests, effectiveFilter]);

  // ─── Staffing indicator ────────────────────────────────────────────
  const staffingStats = useMemo(() => {
    const todayEvents = reservationsMock.filter((r) => isToday(parseISO(r.debut)));
    const filtered = effectiveFilter === "all" ? todayEvents : todayEvents.filter((r) => r.pole === effectiveFilter);
    const total = filtered.length;
    const uncoveredCount = filteredAlerts.length;
    const covered = Math.max(0, total - uncoveredCount);
    const percentage = total > 0 ? Math.round((covered / total) * 100) : 100;
    return { total, covered, uncoveredCount, percentage };
  }, [filteredAlerts, effectiveFilter]);

  // ─── Approve / Reject ──────────────────────────────────────────────
  const handleApprove = async (req: ReplacementRow) => {
    if (!req.replacement_id) return;
    setActionLoading(req.id);
    try {
      await supabase.from("replacement_requests").update({ status: "approved" }).eq("id", req.id);

      const { data: ev } = await supabase
        .from("events")
        .select("description")
        .eq("id", req.event_id)
        .maybeSingle();

      const newDesc = [ev?.description || "", `\n[Remplaçant de ${req.requester_name}]`].join("").trim();
      await supabase.from("events").update({ created_by: req.replacement_id, description: newDesc }).eq("id", req.event_id);
      await supabase.from("urgent_alerts").update({ resolved: true }).eq("event_id", req.event_id);

      pushNotification({
        type: "presence",
        titre: "✅ Remplacement validé",
        description: `Le remplacement pour "${req.event_titre}" a été validé. Il est désormais dans votre agenda.`,
        destinataire: "Bénévole",
      });
      pushNotification({
        type: "changement",
        titre: "🔄 Remplacement approuvé",
        description: `Votre demande pour "${req.event_titre}" a été approuvée. ${req.replacement_name} vous remplace.`,
        destinataire: "Bénévole",
      });

      toast({ title: "Approuvé", description: `${req.replacement_name} assigné à "${req.event_titre}".` });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (req: ReplacementRow) => {
    setActionLoading(req.id);
    try {
      await supabase.from("replacement_requests").update({ status: "rejected" }).eq("id", req.id);
      await supabase.from("urgent_alerts").insert({
        event_id: req.event_id,
        event_titre: req.event_titre,
        requester_id: req.requester_id,
        requester_name: req.requester_name,
        message: `Remplacement refusé pour "${req.event_titre}". Absence non couverte.`,
        pole: req.pole,
      });

      pushNotification({
        type: "panne",
        titre: "❌ Remplacement refusé",
        description: `Votre demande pour "${req.event_titre}" a été refusée. ⚠️ Besoin de remplaçant.`,
        destinataire: "Bénévole",
      });
      pushNotification({
        type: "panne",
        titre: "⚠️ Absence non couverte",
        description: `"${req.event_titre}" — remplacement refusé. Action requise.`,
        destinataire: "Admin",
      });

      toast({ title: "Refusé", description: "Alerte créée.", variant: "destructive" });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Urgent Assign ─────────────────────────────────────────────────
  const openUrgentAssign = async (alert: UrgentAlert) => {
    setAssignTarget(alert);
    setCandidates([]);
    setMatchLoading(true);

    try {
      // Fetch event to get required_skill and date
      let required_skill = "general";
      let start_time = new Date().toISOString();
      let end_time = new Date().toISOString();

      if (alert.event_id) {
        const { data: ev } = await supabase
          .from("events")
          .select("required_skill, date")
          .eq("id", alert.event_id)
          .maybeSingle();
        if (ev?.required_skill) required_skill = ev.required_skill;
        if (ev?.date) {
          start_time = `${ev.date}T08:00:00`;
          end_time = `${ev.date}T22:00:00`;
        }
      }

      const { data } = await supabase.functions.invoke("find-replacements", {
        body: { required_skill, start_time, end_time, exclude_user_id: alert.requester_id },
      });
      setCandidates(data?.replacements || []);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les bénévoles.", variant: "destructive" });
    } finally {
      setMatchLoading(false);
    }
  };

  const handleUrgentAssign = async (candidateId: string) => {
    if (!assignTarget) return;
    setAssignLoading(candidateId);

    try {
      const selected = candidates.find((c) => c.user_id === candidateId);

      if (assignTarget.event_id) {
        // Create replacement_request as approved directly
        await supabase.from("replacement_requests").insert({
          event_id: assignTarget.event_id,
          requester_id: assignTarget.requester_id,
          replacement_id: candidateId,
          status: "approved",
          note: "Assignation d'urgence par le responsable",
        });

        // Update event
        const { data: ev } = await supabase.from("events").select("description").eq("id", assignTarget.event_id).maybeSingle();
        const newDesc = [ev?.description || "", `\n[Remplaçant de ${assignTarget.requester_name} — Urgence]`].join("").trim();
        await supabase.from("events").update({ created_by: candidateId, description: newDesc }).eq("id", assignTarget.event_id);
      }

      // Resolve alert
      await supabase.from("urgent_alerts").update({ resolved: true }).eq("id", assignTarget.id);

      pushNotification({
        type: "presence",
        titre: "✅ Assignation d'urgence",
        description: `${selected?.display_name || "Bénévole"} a été assigné en urgence à "${assignTarget.event_titre}".`,
        destinataire: "Bénévole",
      });

      toast({ title: "Assigné", description: `${selected?.display_name} assigné à "${assignTarget.event_titre}".` });
      setAssignTarget(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setAssignLoading(null);
    }
  };

  // ─── Helpers ───────────────────────────────────────────────────────
  const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20"><CheckCircle2 className="h-3 w-3 mr-1" />Approuvé</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="h-3 w-3 mr-1" />Refusé</Badge>;
      default:
        return <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
    }
  };

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div>
              <h1 className="text-xl font-bold text-foreground">Gestion des Opérations</h1>
              <p className="text-sm text-muted-foreground">Urgences, approbations et couverture staffing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={poleFilter} onValueChange={setPoleFilter}>
              <SelectTrigger className="h-9 w-[180px] text-xs">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Filtrer par pôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les pôles</SelectItem>
                {POLES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ─── Staffing Widget ─────────────────────────────── */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Couverture Staffing du jour</span>
                  </div>
                  <span className={`text-2xl font-bold ${staffingStats.percentage >= 90 ? "text-primary" : staffingStats.percentage >= 70 ? "text-accent" : "text-destructive"}`}>
                    {staffingStats.percentage}%
                  </span>
                </div>
                <Progress value={staffingStats.percentage} className="h-2.5" />
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{staffingStats.covered}/{staffingStats.total} créneaux staffés</span>
                  {staffingStats.uncoveredCount > 0 && (
                    <span className="text-destructive font-medium">
                      {staffingStats.uncoveredCount} non couvert{staffingStats.uncoveredCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ─── Urgences & Alertes ─────────────────────────── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Urgences & Alertes
                </h2>
                {filteredAlerts.length > 0 && (
                  <Badge variant="destructive" className="text-[10px] h-5">
                    {filteredAlerts.length}
                  </Badge>
                )}
              </div>

              {filteredAlerts.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Aucune alerte en cours</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {filteredAlerts.map((alert) => (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                      >
                        <Card className="border-destructive/20 bg-destructive/[0.03]">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                                  <p className="font-semibold text-foreground truncate">
                                    ⚠️ {alert.event_titre}
                                  </p>
                                </div>
                                <p className="text-sm text-muted-foreground">{alert.message}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground/60">
                                  <span>Signalé par {alert.requester_name}</span>
                                  {alert.pole && <Badge variant="outline" className="text-[10px] h-4 px-1.5">{alert.pole}</Badge>}
                                  <span>{format(new Date(alert.created_at), "dd MMM HH:mm", { locale: fr })}</span>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => openUrgentAssign(alert)}
                                className="shrink-0"
                              >
                                <Zap className="h-4 w-4 mr-1" />
                                Assigner en urgence
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>

            <Separator />

            {/* ─── Approbations ────────────────────────────────── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Approbations de Remplacements
                </h2>
                {pendingRequests.length > 0 && (
                  <Badge className="bg-accent/10 text-accent border-accent/20 text-[10px] h-5">
                    {pendingRequests.length}
                  </Badge>
                )}
              </div>

              {pendingRequests.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Aucune demande en attente</p>
                  </CardContent>
                </Card>
              ) : (
                <AnimatePresence>
                  {pendingRequests.map((req) => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                    >
                      <Card className="border-border">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            {/* Avatars row */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-9 w-9 bg-muted">
                                  <AvatarFallback className="text-xs font-semibold bg-destructive/10 text-destructive">
                                    {initials(req.requester_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="text-xs text-center">
                                  <p className="font-medium text-foreground truncate max-w-[80px]">{req.requester_name}</p>
                                  <p className="text-muted-foreground">absent</p>
                                </div>
                              </div>

                              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

                              <div className="flex items-center gap-2">
                                <Avatar className="h-9 w-9 bg-muted">
                                  <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                                    {req.replacement_name ? initials(req.replacement_name) : "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="text-xs text-center">
                                  <p className="font-medium text-primary truncate max-w-[80px]">{req.replacement_name || "—"}</p>
                                  <p className="text-muted-foreground">remplaçant</p>
                                </div>
                              </div>

                              <Separator orientation="vertical" className="h-8 mx-2" />

                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{req.event_titre}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {req.event_date && <span>{format(new Date(req.event_date), "dd MMM", { locale: fr })}</span>}
                                  {req.pole && <Badge variant="outline" className="text-[10px] h-4 px-1.5">{req.pole}</Badge>}
                                </div>
                                {req.note && <p className="text-[11px] text-muted-foreground/60 italic mt-0.5 truncate">{req.note}</p>}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                                onClick={() => handleReject(req)}
                                disabled={actionLoading === req.id}
                              >
                                {actionLoading === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-4 w-4 mr-1" />Refuser</>}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(req)}
                                disabled={actionLoading === req.id || !req.replacement_id}
                              >
                                {actionLoading === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-1" />Approuver</>}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </section>

            {/* ─── Historique ──────────────────────────────────── */}
            {processedRequests.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Historique ({processedRequests.length})
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {processedRequests.map((req) => (
                    <Card key={req.id} className="opacity-60">
                      <CardContent className="p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px]">{initials(req.requester_name)}</AvatarFallback>
                          </Avatar>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px]">{req.replacement_name ? initials(req.replacement_name) : "?"}</AvatarFallback>
                          </Avatar>
                          <p className="text-sm font-medium truncate ml-2">{req.event_titre}</p>
                        </div>
                        {statusBadge(req.status)}
                      </CardContent>
                    </Card>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </div>

      {/* ─── Urgent Assign Dialog ──────────────────────────────── */}
      <Dialog open={!!assignTarget} onOpenChange={(open) => !open && setAssignTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Assignation d'urgence
            </DialogTitle>
            <DialogDescription>
              Sélectionnez un bénévole pour couvrir «&nbsp;{assignTarget?.event_titre}&nbsp;»
            </DialogDescription>
          </DialogHeader>

          {matchLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Recherche des bénévoles…</span>
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun bénévole disponible avec les compétences requises</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {candidates.map((c) => (
                <div
                  key={c.user_id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                        {initials(c.display_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.display_name}</p>
                      <div className="flex gap-1 mt-0.5">
                        {(c.competences || []).slice(0, 3).map((comp) => (
                          <Badge key={comp} variant="outline" className="text-[9px] h-4 px-1.5">
                            {comp}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleUrgentAssign(c.user_id)}
                    disabled={assignLoading === c.user_id}
                  >
                    {assignLoading === c.user_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Assigner"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
