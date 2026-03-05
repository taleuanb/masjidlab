import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  UserCheck,
  AlertTriangle,
  Clock,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useToast } from "@/hooks/use-toast";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ReplacementRow {
  id: string;
  event_id: string;
  requester_id: string;
  replacement_id: string | null;
  status: string;
  note: string | null;
  created_at: string;
  event_titre?: string;
  requester_name?: string;
  replacement_name?: string;
}

export default function ApprobationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { push: pushNotification } = useNotifications();

  const [requests, setRequests] = useState<ReplacementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("replacement_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Enrich with names
      const enriched: ReplacementRow[] = [];
      for (const row of data || []) {
        let event_titre = "";
        let requester_name = "";
        let replacement_name = "";

        const { data: ev } = await supabase
          .from("events")
          .select("titre")
          .eq("id", row.event_id)
          .maybeSingle();
        event_titre = ev?.titre || "Événement inconnu";

        const { data: req } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", row.requester_id)
          .maybeSingle();
        requester_name = req?.display_name || "Utilisateur";

        if (row.replacement_id) {
          const { data: rep } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", row.replacement_id)
            .maybeSingle();
          replacement_name = rep?.display_name || "Utilisateur";
        }

        enriched.push({ ...row, event_titre, requester_name, replacement_name });
      }

      setRequests(enriched);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (req: ReplacementRow) => {
    if (!req.replacement_id) return;
    setActionLoading(req.id);

    try {
      // 1. Update replacement_request status
      const { error: reqErr } = await supabase
        .from("replacement_requests")
        .update({ status: "approved" })
        .eq("id", req.id);
      if (reqErr) throw reqErr;

      // 2. Update the event: assign to replacement + add note
      const { data: currentEvent } = await supabase
        .from("events")
        .select("description, created_by")
        .eq("id", req.event_id)
        .maybeSingle();

      const newDesc = [
        currentEvent?.description || "",
        `\n[Remplaçant de ${req.requester_name}]`,
      ].join("").trim();

      const { error: evErr } = await supabase
        .from("events")
        .update({
          created_by: req.replacement_id,
          description: newDesc,
        })
        .eq("id", req.event_id);
      if (evErr) throw evErr;

      // 3. Resolve any urgent_alert for this event
      await supabase
        .from("urgent_alerts")
        .update({ resolved: true })
        .eq("event_id", req.event_id);

      // 4. Notify the replacement
      pushNotification({
        type: "presence",
        titre: "✅ Remplacement validé",
        description: `Le remplacement pour "${req.event_titre}" a été validé. Il est désormais dans votre agenda.`,
        destinataire: "Bénévole",
      });

      // 5. Notify the requester
      pushNotification({
        type: "changement",
        titre: "🔄 Remplacement approuvé",
        description: `Votre demande de remplacement pour "${req.event_titre}" a été approuvée. ${req.replacement_name} vous remplace.`,
        destinataire: "Bénévole",
      });

      toast({ title: "Approuvé", description: `${req.replacement_name} est maintenant assigné à "${req.event_titre}".` });
      fetchRequests();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (req: ReplacementRow) => {
    setActionLoading(req.id);

    try {
      // 1. Update replacement_request status
      const { error: reqErr } = await supabase
        .from("replacement_requests")
        .update({ status: "rejected" })
        .eq("id", req.id);
      if (reqErr) throw reqErr;

      // 2. Create urgent_alert (uncovered absence)
      await supabase.from("urgent_alerts").insert({
        event_id: req.event_id,
        event_titre: req.event_titre || "Événement",
        requester_id: req.requester_id,
        requester_name: req.requester_name || "Utilisateur",
        message: `Remplacement refusé pour "${req.event_titre}". Absence non couverte.`,
      });

      // 3. Notify requester
      pushNotification({
        type: "panne",
        titre: "❌ Remplacement refusé",
        description: `Votre demande de remplacement pour "${req.event_titre}" a été refusée. L'événement est marqué ⚠️ Besoin de remplaçant.`,
        destinataire: "Bénévole",
      });

      // 4. Notify Admin
      pushNotification({
        type: "panne",
        titre: "⚠️ Absence non couverte",
        description: `Le remplacement pour "${req.event_titre}" a été refusé. Action requise.`,
        destinataire: "Admin Mosquée",
      });

      toast({ title: "Refusé", description: `La demande a été refusée. Alerte créée.`, variant: "destructive" });
      fetchRequests();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const pending = requests.filter((r) => r.status === "En attente");
  const processed = requests.filter((r) => r.status !== "En attente");

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />Approuvé</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="h-3 w-3 mr-1" />Refusé</Badge>;
      default:
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
    }
  };

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div>
              <h1 className="text-xl font-bold text-foreground">Approbations</h1>
              <p className="text-sm text-muted-foreground">
                Validez ou refusez les demandes de remplacement
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Pending */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                En attente ({pending.length})
              </h2>
              {pending.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>Aucune demande en attente</p>
                  </CardContent>
                </Card>
              ) : (
                <AnimatePresence>
                  {pending.map((req) => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <Card className="border-amber-500/20">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1 min-w-0 flex-1">
                              <p className="font-semibold text-foreground truncate">
                                {req.event_titre}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                <UserCheck className="h-3.5 w-3.5 inline mr-1" />
                                <span className="font-medium">{req.requester_name}</span> demande à être remplacé par{" "}
                                <span className="font-medium text-primary">{req.replacement_name}</span>
                              </p>
                              {req.note && (
                                <p className="text-xs text-muted-foreground italic mt-1">{req.note}</p>
                              )}
                              <p className="text-xs text-muted-foreground/60 mt-1">
                                {format(new Date(req.created_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                                onClick={() => handleReject(req)}
                                disabled={actionLoading === req.id}
                              >
                                {actionLoading === req.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Refuser
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                className="gradient-positive hover:opacity-90"
                                onClick={() => handleApprove(req)}
                                disabled={actionLoading === req.id || !req.replacement_id}
                              >
                                {actionLoading === req.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                    Approuver
                                  </>
                                )}
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

            {/* Processed */}
            {processed.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Historique ({processed.length})
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {processed.map((req) => (
                    <Card key={req.id} className="opacity-70">
                      <CardContent className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{req.event_titre}</p>
                          <p className="text-xs text-muted-foreground">
                            {req.requester_name} → {req.replacement_name || "—"}
                          </p>
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
    </main>
  );
}
