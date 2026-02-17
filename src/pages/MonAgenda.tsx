import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Package,
  Ban,
  CalendarDays,
  AlertTriangle,
  UserX,
  Users,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  addDays,
  startOfWeek,
  format,
  isSameDay,
  isToday,
  parseISO,
  isBefore,
} from "date-fns";
import { fr } from "date-fns/locale";
import { reservationsMock, sallesMock } from "@/data/mock-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRole } from "@/contexts/RoleContext";
import { useToast } from "@/hooks/use-toast";
import { Pole, Reservation } from "@/types/amm";

const HEURES = Array.from({ length: 17 }, (_, i) => i + 6);

interface Indisponibilite {
  id: string;
  jour: string;
  heure: number;
}

const POLE_COLORS: Record<string, string> = {
  Imam: "bg-primary/15 border-primary/30 text-primary",
  "École (Avenir)": "bg-blue-500/15 border-blue-500/30 text-blue-700",
  "Social (ABD)": "bg-amber-500/15 border-amber-500/30 text-amber-700",
  Accueil: "bg-violet-500/15 border-violet-500/30 text-violet-700",
  Récolte: "bg-emerald-500/15 border-emerald-500/30 text-emerald-700",
  Digital: "bg-cyan-500/15 border-cyan-500/30 text-cyan-700",
  Com: "bg-pink-500/15 border-pink-500/30 text-pink-700",
  Parking: "bg-slate-500/15 border-slate-500/30 text-slate-700",
};

export default function MonAgendaPage() {
  const { pole } = useRole();
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date(2026, 1, 17));
  const [reservations, setReservations] = useState(reservationsMock);
  const [indisponibilites, setIndisponibilites] = useState<Indisponibilite[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);
  const [absenceTarget, setAbsenceTarget] = useState<Reservation | null>(null);
  const [absenceLoading, setAbsenceLoading] = useState(false);
  const [absenceMarked, setAbsenceMarked] = useState<Set<string>>(new Set());
  const [absenceStep, setAbsenceStep] = useState<"confirm" | "matching">("confirm");
  const [matchResults, setMatchResults] = useState<{ user_id: string; display_name: string; competences: string[] }[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [selectedReplacement, setSelectedReplacement] = useState<string | null>(null);
  const [newRes, setNewRes] = useState({
    titre: "",
    salleId: "",
    pole: pole,
    heureDebut: "09:00",
    heureFin: "11:00",
    selectedDay: "",
  });

  const weekStart = useMemo(
    () => startOfWeek(currentDate, { weekStartsOn: 1 }),
    [currentDate]
  );
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const naviguer = (dir: number) => setCurrentDate((d) => addDays(d, dir * 7));

  const getResForDayHour = useCallback(
    (day: Date, hour: number) =>
      reservations.filter((r) => {
        const d = parseISO(r.debut);
        return isSameDay(d, day) && d.getHours() === hour;
      }),
    [reservations]
  );

  const isIndisponible = useCallback(
    (day: Date, hour: number) =>
      indisponibilites.some(
        (ind) => ind.jour === format(day, "yyyy-MM-dd") && ind.heure === hour
      ),
    [indisponibilites]
  );

  const toggleIndisponibilite = (day: Date, hour: number) => {
    const jourStr = format(day, "yyyy-MM-dd");
    const existing = indisponibilites.find(
      (ind) => ind.jour === jourStr && ind.heure === hour
    );
    if (existing) {
      setIndisponibilites((prev) => prev.filter((i) => i.id !== existing.id));
    } else {
      setIndisponibilites((prev) => [
        ...prev,
        { id: `ind-${Date.now()}`, jour: jourStr, heure: hour },
      ]);
    }
  };

  const openReservation = (day?: Date) => {
    setNewRes({
      titre: "",
      salleId: "",
      pole: pole,
      heureDebut: "09:00",
      heureFin: "11:00",
      selectedDay: day ? format(day, "yyyy-MM-dd") : format(currentDate, "yyyy-MM-dd"),
    });
    setDialogOpen(true);
  };

  const handleCreate = () => {
    if (!newRes.titre || !newRes.salleId || !newRes.selectedDay) return;
    setReservations((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        salleId: newRes.salleId,
        titre: newRes.titre,
        debut: `${newRes.selectedDay}T${newRes.heureDebut}`,
        fin: `${newRes.selectedDay}T${newRes.heureFin}`,
        pole: newRes.pole as Pole,
      },
    ]);
    setDialogOpen(false);
  };

  const openAbsenceDialog = (res: Reservation) => {
    setAbsenceTarget(res);
    setAbsenceStep("confirm");
    setMatchResults([]);
    setSelectedReplacement(null);
    setAbsenceDialogOpen(true);
  };

  const handleConfirmAbsence = async () => {
    if (!absenceTarget || !user) return;
    setAbsenceLoading(true);

    try {
      const { error } = await supabase.from("user_availability").insert({
        user_id: user.id,
        start_time: absenceTarget.debut,
        end_time: absenceTarget.fin,
        type: "Indisponibilité",
      });

      if (error) throw error;

      setAbsenceMarked((prev) => new Set(prev).add(absenceTarget.id));
      toast({
        title: "Absence signalée",
        description: "Recherche de remplaçants en cours…",
      });

      // Move to matching step
      setAbsenceStep("matching");
      setMatchLoading(true);

      // Determine required_skill from the event pole
      const skillMap: Record<string, string> = {
        Imam: "Imam",
        "École (Avenir)": "Enseignant",
        Parking: "Parking",
        "Social (ABD)": "Gestion Sociale",
      };
      const requiredSkill = skillMap[absenceTarget.pole] || absenceTarget.pole;

      const { data, error: fnError } = await supabase.functions.invoke("find-replacements", {
        body: {
          required_skill: requiredSkill,
          start_time: absenceTarget.debut,
          end_time: absenceTarget.fin,
          exclude_user_id: user.id,
        },
      });

      if (fnError) throw fnError;
      setMatchResults(data?.replacements || []);
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message || "Impossible de signaler l'absence.",
        variant: "destructive",
      });
    } finally {
      setAbsenceLoading(false);
      setMatchLoading(false);
    }
  };

  const handleSelectReplacement = async (replacementUserId: string) => {
    if (!absenceTarget || !user) return;
    setSelectedReplacement(replacementUserId);

    try {
      // We need an event_id in Supabase. Since current events are mock, we'll create a replacement_request
      // by first finding or using the event title as reference
      const { data: matchingEvents } = await supabase
        .from("events")
        .select("id")
        .eq("titre", absenceTarget.titre)
        .limit(1);

      const eventId = matchingEvents?.[0]?.id;

      if (eventId) {
        const { error } = await supabase.from("replacement_requests").insert({
          event_id: eventId,
          requester_id: user.id,
          replacement_id: replacementUserId,
          status: "En attente",
          note: `Demande automatique pour "${absenceTarget.titre}"`,
        });
        if (error) throw error;
      }

      const selected = matchResults.find((r) => r.user_id === replacementUserId);
      toast({
        title: "Remplaçant sélectionné",
        description: `${selected?.display_name || "Utilisateur"} a été proposé comme remplaçant. En attente de validation.`,
      });
      setAbsenceDialogOpen(false);
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message || "Impossible de sélectionner le remplaçant.",
        variant: "destructive",
      });
      setSelectedReplacement(null);
    }
  };

  const now = new Date();

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 backdrop-blur-sm px-6 py-4">
        <SidebarTrigger />
        <div className="flex-1">
          <h2 className="text-lg font-semibold tracking-tight">Mon Agenda</h2>
          <p className="text-sm text-muted-foreground">
            Pôle {pole} — Semaine du{" "}
            {format(weekStart, "d MMM", { locale: fr })} au{" "}
            {format(addDays(weekStart, 6), "d MMM yyyy", { locale: fr })}
          </p>
        </div>
        <Button size="sm" onClick={() => openReservation()}>
          <Plus className="h-4 w-4 mr-1" />
          Réserver un créneau
        </Button>
      </header>

      <main className="p-6 space-y-4">
        {/* Week navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => naviguer(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-base font-semibold min-w-[260px] text-center">
              Semaine du{" "}
              {format(weekStart, "d MMMM", { locale: fr })} au{" "}
              {format(addDays(weekStart, 6), "d MMMM yyyy", { locale: fr })}
            </h3>
            <Button variant="outline" size="icon" onClick={() => naviguer(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-muted border" style={{
                backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 2px, hsl(var(--muted-foreground) / 0.15) 2px, hsl(var(--muted-foreground) / 0.15) 4px)",
              }} />
              <span>Indisponible</span>
            </div>
            <span className="text-border">·</span>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-orange-500/20 border border-orange-500/30" />
              <span>Besoin remplaçant</span>
            </div>
          </div>
        </div>

        {/* Weekly calendar grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bento-card !p-0 overflow-x-auto"
        >
          <div className="min-w-[900px]">
            {/* Day headers */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30">
              <div className="p-2" />
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`text-center py-3 border-l border-border/50 ${
                    isToday(day) ? "bg-primary/5" : ""
                  }`}
                >
                  <p className={`text-xs font-medium uppercase tracking-wider ${
                    isToday(day) ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {format(day, "EEE", { locale: fr })}
                  </p>
                  <p className={`text-lg font-bold mt-0.5 ${
                    isToday(day)
                      ? "bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto"
                      : "text-foreground"
                  }`}>
                    {format(day, "d")}
                  </p>
                </div>
              ))}
            </div>

            {/* Time slots */}
            <div className="relative">
              {HEURES.map((hour) => (
                <div
                  key={hour}
                  className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/30 last:border-0"
                >
                  <div className="p-2 text-right pr-3 border-r border-border/50">
                    <span className="text-[11px] text-muted-foreground tabular-nums font-medium">
                      {hour.toString().padStart(2, "0")}:00
                    </span>
                  </div>

                  {weekDays.map((day) => {
                    const cellRes = getResForDayHour(day, hour);
                    const unavailable = isIndisponible(day, hour);
                    const isPast = isBefore(
                      new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour + 1),
                      now
                    );

                    return (
                      <div
                        key={day.toISOString() + hour}
                        className={`min-h-[56px] border-l border-border/50 p-1 transition-colors relative group ${
                          isToday(day) ? "bg-primary/[0.02]" : ""
                        } ${isPast ? "opacity-50" : ""} ${
                          unavailable
                            ? "cursor-pointer"
                            : cellRes.length === 0
                            ? "cursor-pointer hover:bg-muted/40"
                            : ""
                        }`}
                        style={
                          unavailable
                            ? {
                                backgroundImage:
                                  "repeating-linear-gradient(45deg, transparent, transparent 3px, hsl(var(--muted-foreground) / 0.08) 3px, hsl(var(--muted-foreground) / 0.08) 6px)",
                                backgroundColor: "hsl(var(--muted) / 0.6)",
                              }
                            : undefined
                        }
                        onClick={() => {
                          if (cellRes.length === 0 && !isPast) {
                            toggleIndisponibilite(day, hour);
                          }
                        }}
                      >
                        {unavailable && cellRes.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Ban className="h-3.5 w-3.5 text-muted-foreground/40" />
                              </TooltipTrigger>
                              <TooltipContent>Créneau indisponible — cliquer pour débloquer</TooltipContent>
                            </Tooltip>
                          </div>
                        )}

                        {cellRes.map((r) => {
                          const salle = sallesMock.find((s) => s.id === r.salleId);
                          const hasMateriel = r.materiel && r.materiel.length > 0;
                          const needsReplacement = absenceMarked.has(r.id);
                          const colorClass = needsReplacement
                            ? "bg-orange-500/15 border-orange-500/30 text-orange-700"
                            : POLE_COLORS[r.pole] || "bg-muted border-border text-foreground";

                          return (
                            <motion.div
                              key={r.id}
                              initial={{ scale: 0.95, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className={`rounded-md border px-2 py-1.5 text-left ${colorClass} mb-1`}
                            >
                              <p className="text-[11px] font-semibold truncate leading-tight">
                                {r.titre}
                              </p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Clock className="h-2.5 w-2.5 opacity-60" />
                                <span className="text-[10px] opacity-70">
                                  {format(parseISO(r.debut), "HH:mm")}–
                                  {format(parseISO(r.fin), "HH:mm")}
                                </span>
                              </div>
                              {salle && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-2.5 w-2.5 opacity-60" />
                                  <span className="text-[10px] opacity-70 truncate">
                                    {salle.nom}
                                  </span>
                                </div>
                              )}
                              <div className="mt-1 flex items-center gap-1 flex-wrap">
                                {needsReplacement ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] h-4 px-1.5 bg-orange-500/10 border-orange-500/20 text-orange-600"
                                  >
                                    <AlertTriangle className="h-2 w-2 mr-0.5" />
                                    Besoin de remplaçant
                                  </Badge>
                                ) : (
                                  <>
                                    {hasMateriel ? (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] h-4 px-1.5 bg-primary/10 border-primary/20 text-primary"
                                      >
                                        <Package className="h-2 w-2 mr-0.5" />
                                        Confirmé
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] h-4 px-1.5 bg-amber-500/10 border-amber-500/20 text-amber-600"
                                      >
                                        <Package className="h-2 w-2 mr-0.5" />
                                        En attente
                                      </Badge>
                                    )}
                                    {!isPast && r.pole === pole && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openAbsenceDialog(r);
                                        }}
                                        className="inline-flex items-center gap-0.5 text-[9px] h-4 px-1.5 rounded-full border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10 transition-colors"
                                      >
                                        <UserX className="h-2 w-2" />
                                        Absence
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}

                        {cellRes.length === 0 && !unavailable && !isPast && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openReservation(day);
                            }}
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <div className="rounded-full bg-primary/10 p-1">
                              <Plus className="h-3 w-3 text-primary" />
                            </div>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </main>

      {/* Reservation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Réserver un créneau
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Input
              placeholder="Titre de l'activité"
              value={newRes.titre}
              onChange={(e) => setNewRes({ ...newRes, titre: e.target.value })}
            />
            <Select
              value={newRes.salleId}
              onValueChange={(v) => setNewRes({ ...newRes, salleId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir une salle" />
              </SelectTrigger>
              <SelectContent>
                {sallesMock
                  .filter((s) => s.statut !== "maintenance")
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nom} — Étage {s.etage}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <div className="rounded-md bg-muted/50 border px-3 py-2">
              <p className="text-xs text-muted-foreground">Pôle</p>
              <p className="text-sm font-medium">{newRes.pole}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Début</label>
                <Input
                  type="time"
                  value={newRes.heureDebut}
                  onChange={(e) => setNewRes({ ...newRes, heureDebut: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fin</label>
                <Input
                  type="time"
                  value={newRes.heureFin}
                  onChange={(e) => setNewRes({ ...newRes, heureFin: e.target.value })}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Date :{" "}
              {newRes.selectedDay &&
                format(parseISO(newRes.selectedDay), "EEEE d MMMM yyyy", {
                  locale: fr,
                })}
            </p>

            <Button onClick={handleCreate} className="w-full">
              Réserver
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Absence + Matching Dialog */}
      <Dialog open={absenceDialogOpen} onOpenChange={setAbsenceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {absenceStep === "confirm" ? (
                <>
                  <UserX className="h-5 w-5 text-destructive" />
                  <span className="text-destructive">Signaler une absence</span>
                </>
              ) : (
                <>
                  <Users className="h-5 w-5 text-primary" />
                  Collègues disponibles
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {absenceStep === "confirm"
                ? "Confirmez votre indisponibilité. Un remplaçant sera recherché automatiquement."
                : "Sélectionnez un remplaçant parmi les profils disponibles ayant la compétence requise."}
            </DialogDescription>
          </DialogHeader>

          {absenceTarget && absenceStep === "confirm" && (
            <div className="space-y-3 mt-2">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-semibold">{absenceTarget.titre}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {format(parseISO(absenceTarget.debut), "EEEE d MMMM yyyy — HH:mm", { locale: fr })}
                  {" → "}
                  {format(parseISO(absenceTarget.fin), "HH:mm")}
                </div>
                {(() => {
                  const salle = sallesMock.find(s => s.id === absenceTarget.salleId);
                  return salle ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {salle.nom}
                    </div>
                  ) : null;
                })()}
                <Badge variant="outline" className="text-[10px]">
                  Pôle {absenceTarget.pole}
                </Badge>
              </div>

              <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    L'événement sera marqué <strong className="text-orange-600">"Besoin de remplaçant"</strong> et visible par les responsables de pôle.
                  </p>
                </div>
              </div>
            </div>
          )}

          {absenceStep === "matching" && (
            <div className="space-y-3 mt-2">
              {/* Event summary compact */}
              {absenceTarget && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs font-medium">{absenceTarget.titre}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Absence enregistrée — Recherche de remplaçants
                    </p>
                  </div>
                </div>
              )}

              {matchLoading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Recherche en cours…</p>
                </div>
              ) : matchResults.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {matchResults.length} remplaçant{matchResults.length > 1 ? "s" : ""} disponible{matchResults.length > 1 ? "s" : ""}
                  </p>
                  {matchResults.map((candidate) => (
                    <motion.div
                      key={candidate.user_id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between rounded-lg border bg-card p-3 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">
                            {candidate.display_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{candidate.display_name}</p>
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {candidate.competences?.map((c) => (
                              <Badge key={c} variant="secondary" className="text-[9px] h-4 px-1.5">
                                {c}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={selectedReplacement === candidate.user_id ? "default" : "outline"}
                        onClick={() => handleSelectReplacement(candidate.user_id)}
                        disabled={selectedReplacement !== null}
                        className="shrink-0"
                      >
                        {selectedReplacement === candidate.user_id ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Sélectionné
                          </>
                        ) : (
                          "Sélectionner"
                        )}
                      </Button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Users className="h-8 w-8 opacity-40" />
                  <p className="text-sm font-medium">Aucun remplaçant disponible</p>
                  <p className="text-xs text-center">
                    Aucun profil avec la compétence requise n'est disponible sur ce créneau.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAbsenceDialogOpen(false)}>
              {absenceStep === "matching" ? "Fermer" : "Annuler"}
            </Button>
            {absenceStep === "confirm" && (
              <Button
                variant="destructive"
                onClick={handleConfirmAbsence}
                disabled={absenceLoading}
              >
                {absenceLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Enregistrement…
                  </>
                ) : (
                  "Confirmer l'absence"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
