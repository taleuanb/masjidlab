import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Users,
} from "lucide-react";
import {
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  getDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import { reservationsMock, sallesMock } from "@/data/mock-data";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pole } from "@/types/amm";

type VuePlanning = "jour" | "semaine" | "mois";

const HEURES = Array.from({ length: 14 }, (_, i) => i + 7); // 7h-20h

export default function PlanningPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 1, 17));
  const [vue, setVue] = useState<VuePlanning>("semaine");
  const [reservations, setReservations] = useState(reservationsMock);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newRes, setNewRes] = useState({ titre: "", salleId: "", pole: "Accueil" as Pole, heureDebut: "09:00", heureFin: "11:00" });

  const naviguer = (dir: number) => {
    if (vue === "jour") setCurrentDate((d) => addDays(d, dir));
    else if (vue === "semaine") setCurrentDate((d) => addDays(d, dir * 7));
    else setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  };

  // Compute days for month view
  const monthDays = useMemo(() => {
    if (vue !== "mois") return [];
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const firstDay = startOfWeek(start, { weekStartsOn: 1 });
    const lastDay = endOfWeek(end, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: firstDay, end: lastDay });
  }, [currentDate, vue]);

  const weekDays = useMemo(() => {
    if (vue !== "semaine") return [];
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end: addDays(start, 6) });
  }, [currentDate, vue]);

  const getResForDay = (date: Date) =>
    reservations.filter((r) => isSameDay(parseISO(r.debut), date));

  const handleCreate = () => {
    if (!newRes.titre || !newRes.salleId) return;
    const dateStr = format(currentDate, "yyyy-MM-dd");
    setReservations((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        salleId: newRes.salleId,
        titre: newRes.titre,
        debut: `${dateStr}T${newRes.heureDebut}`,
        fin: `${dateStr}T${newRes.heureFin}`,
        pole: newRes.pole,
      },
    ]);
    setNewRes({ titre: "", salleId: "", pole: "Accueil", heureDebut: "09:00", heureFin: "11:00" });
    setDialogOpen(false);
  };

  return (
    <div className="flex-1 overflow-auto">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 backdrop-blur-sm px-6 py-4">
        <SidebarTrigger />
        <div className="flex-1">
          <h2 className="text-lg font-semibold tracking-tight">Planning</h2>
          <p className="text-sm text-muted-foreground">Calendrier des réservations</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Réserver
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle réservation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <Input placeholder="Titre de l'événement" value={newRes.titre} onChange={(e) => setNewRes({ ...newRes, titre: e.target.value })} />
              <Select value={newRes.salleId} onValueChange={(v) => setNewRes({ ...newRes, salleId: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir une salle" /></SelectTrigger>
                <SelectContent>
                  {sallesMock.filter((s) => s.statut !== "maintenance").map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={newRes.pole} onValueChange={(v) => setNewRes({ ...newRes, pole: v as Pole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["Imam", "École (Avenir)", "Social (ABD)", "Accueil", "Récolte", "Digital", "Com", "Parking"] as Pole[]).map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Début</label>
                  <Input type="time" value={newRes.heureDebut} onChange={(e) => setNewRes({ ...newRes, heureDebut: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Fin</label>
                  <Input type="time" value={newRes.heureFin} onChange={(e) => setNewRes({ ...newRes, heureFin: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Date : {format(currentDate, "EEEE d MMMM yyyy", { locale: fr })}</p>
              <Button onClick={handleCreate} className="w-full">Réserver</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <main className="p-6 space-y-4">
        {/* Navigation bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => naviguer(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-base font-semibold min-w-[200px] text-center">
              {vue === "jour" && format(currentDate, "EEEE d MMMM yyyy", { locale: fr })}
              {vue === "semaine" && `Semaine du ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM", { locale: fr })} au ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM yyyy", { locale: fr })}`}
              {vue === "mois" && format(currentDate, "MMMM yyyy", { locale: fr })}
            </h3>
            <Button variant="outline" size="icon" onClick={() => naviguer(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-1">
            {(["jour", "semaine", "mois"] as VuePlanning[]).map((v) => (
              <button
                key={v}
                onClick={() => setVue(v)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize ${
                  vue === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Day view */}
          {vue === "jour" && (
            <motion.div key="jour" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bento-card">
              <div className="space-y-1">
                {HEURES.map((h) => {
                  const hRes = reservations.filter((r) => {
                    const d = parseISO(r.debut);
                    return isSameDay(d, currentDate) && d.getHours() === h;
                  });
                  return (
                    <div key={h} className="flex gap-3 min-h-[3rem] border-b border-border/50 last:border-0">
                      <span className="text-xs text-muted-foreground w-12 pt-2 tabular-nums">{h}:00</span>
                      <div className="flex-1 py-1 space-y-1">
                        {hRes.map((r) => {
                          const salle = sallesMock.find((s) => s.id === r.salleId);
                          return (
                            <div key={r.id} className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
                              <p className="text-sm font-medium">{r.titre}</p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {format(parseISO(r.debut), "HH:mm")} - {format(parseISO(r.fin), "HH:mm")}
                                {salle && (
                                  <>
                                    <MapPin className="h-3 w-3 ml-1" />
                                    {salle.nom}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Week view */}
          {vue === "semaine" && (
            <motion.div key="semaine" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bento-card overflow-x-auto">
              <div className="grid grid-cols-7 gap-px min-w-[700px]">
                {weekDays.map((day) => (
                  <div key={day.toISOString()} className="text-center">
                    <p className={`text-xs font-medium py-2 ${isToday(day) ? "text-primary" : "text-muted-foreground"}`}>
                      {format(day, "EEE", { locale: fr })}
                    </p>
                    <p className={`text-sm font-semibold mb-2 ${isToday(day) ? "bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center mx-auto" : ""}`}>
                      {format(day, "d")}
                    </p>
                    <div className="space-y-1 px-1 min-h-[120px]">
                      {getResForDay(day).map((r) => {
                        const salle = sallesMock.find((s) => s.id === r.salleId);
                        return (
                          <button
                            key={r.id}
                            onClick={() => { setCurrentDate(day); setVue("jour"); }}
                            className="w-full rounded-md bg-primary/10 border border-primary/20 p-1.5 text-left hover:bg-primary/15 transition-colors"
                          >
                            <p className="text-[11px] font-medium truncate">{r.titre}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {format(parseISO(r.debut), "HH:mm")}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Month view */}
          {vue === "mois" && (
            <motion.div key="mois" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bento-card">
              <div className="grid grid-cols-7 gap-px">
                {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                ))}
                {monthDays.map((day) => {
                  const dayRes = getResForDay(day);
                  const inMonth = isSameMonth(day, currentDate);
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => { setCurrentDate(day); setVue("jour"); }}
                      className={`min-h-[80px] border border-border/30 p-1.5 text-left rounded-md transition-colors hover:bg-muted/50 ${
                        !inMonth ? "opacity-30" : ""
                      } ${isToday(day) ? "border-primary/50 bg-primary/5" : ""}`}
                    >
                      <p className={`text-xs font-medium ${isToday(day) ? "text-primary" : ""}`}>
                        {format(day, "d")}
                      </p>
                      {dayRes.slice(0, 2).map((r) => (
                        <div key={r.id} className="mt-0.5 rounded bg-primary/10 px-1 py-0.5">
                          <p className="text-[10px] truncate font-medium">{r.titre}</p>
                        </div>
                      ))}
                      {dayRes.length > 2 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">+{dayRes.length - 2} autres</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
