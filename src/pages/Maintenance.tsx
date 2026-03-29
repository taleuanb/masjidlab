import { useState } from "react";
import { motion } from "framer-motion";
import {
  Wrench, AlertTriangle, CircleDot, CheckCircle2, Plus, ArrowUpDown,
} from "lucide-react";
import { ticketsMock } from "@/data/mock-data";
import { TicketMaintenance, PrioriteTicket, StatutTicket } from "@/types/amm";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/* Amber-based priority — no red-vif for urgente, use warm amber */
const prioriteConfig: Record<PrioriteTicket, { color: string; label: string }> = {
  basse: { color: "bg-muted text-muted-foreground", label: "Basse" },
  moyenne: { color: "bg-[hsl(38,92%,50%)]/10 text-[hsl(38,92%,30%)]", label: "Moyenne" },
  haute: { color: "bg-[hsl(38,92%,50%)]/20 text-[hsl(25,90%,35%)]", label: "Haute" },
  urgente: { color: "bg-[hsl(25,90%,50%)]/15 text-[hsl(25,90%,30%)] font-semibold", label: "Urgente" },
};

const statutConfig: Record<StatutTicket, { icon: typeof CircleDot; color: string; label: string }> = {
  ouvert: { icon: CircleDot, color: "text-[hsl(38,92%,40%)]", label: "Ouvert" },
  en_cours: { icon: ArrowUpDown, color: "text-accent", label: "En cours" },
  résolu: { icon: CheckCircle2, color: "text-secondary", label: "Résolu" },
};

export default function MaintenancePage() {
  const [tickets, setTickets] = useState<TicketMaintenance[]>(ticketsMock);
  const [filterStatut, setFilterStatut] = useState<StatutTicket | "tous">("tous");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({ titre: "", description: "", localisation: "", priorite: "moyenne" as PrioriteTicket });

  const filtered = filterStatut === "tous" ? tickets : tickets.filter((t) => t.statut === filterStatut);
  const sortedTickets = [...filtered].sort((a, b) => {
    const order: PrioriteTicket[] = ["urgente", "haute", "moyenne", "basse"];
    return order.indexOf(a.priorite) - order.indexOf(b.priorite);
  });

  const handleCreate = () => {
    if (!newTicket.titre) return;
    const ticket: TicketMaintenance = {
      id: `new-${Date.now()}`, ...newTicket,
      statut: "ouvert", signalePar: "Accueil", dateCreation: new Date().toISOString(),
    };
    setTickets((prev) => [ticket, ...prev]);
    setNewTicket({ titre: "", description: "", localisation: "", priorite: "moyenne" });
    setDialogOpen(false);
  };

  const updateStatut = (id: string, statut: StatutTicket) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, statut } : t)));
  };

  const ouverts = tickets.filter((t) => t.statut === "ouvert").length;
  const enCours = tickets.filter((t) => t.statut === "en_cours").length;
  const resolus = tickets.filter((t) => t.statut === "résolu").length;

  return (
    <div className="flex-1 overflow-auto">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 backdrop-blur-sm px-6 py-4">
        <SidebarTrigger />
        <div className="flex-1">
          <h2 className="text-lg font-semibold tracking-tight">Maintenance</h2>
          <p className="text-sm text-muted-foreground">Système de ticketing</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gradient-positive border-0">
              <Plus className="h-4 w-4 mr-1" /> Nouveau ticket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Signaler un problème</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <Input placeholder="Titre (ex: Fuite d'eau)" value={newTicket.titre} onChange={(e) => setNewTicket({ ...newTicket, titre: e.target.value })} />
              <Textarea placeholder="Description détaillée…" value={newTicket.description} onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })} />
              <Input placeholder="Localisation (ex: RDC - Toilettes)" value={newTicket.localisation} onChange={(e) => setNewTicket({ ...newTicket, localisation: e.target.value })} />
              <Select value={newTicket.priorite} onValueChange={(v) => setNewTicket({ ...newTicket, priorite: v as PrioriteTicket })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basse">Basse</SelectItem>
                  <SelectItem value="moyenne">Moyenne</SelectItem>
                  <SelectItem value="haute">Haute</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-muted-foreground">Annuler</Button>
              <Button onClick={handleCreate} className="gradient-positive border-0">Créer le ticket</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <main className="p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
        {/* KPIs — Amber for open, Cyan for in progress, Emerald for resolved */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Ouverts", value: ouverts, color: "text-[hsl(38,92%,40%)]" },
            { label: "En cours", value: enCours, color: "text-accent" },
            { label: "Résolus", value: resolus, color: "text-secondary" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bento-card text-center">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(["tous", "ouvert", "en_cours", "résolu"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatut(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filterStatut === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s === "tous" ? "Tous" : s === "en_cours" ? "En cours" : s === "ouvert" ? "Ouverts" : "Résolus"}
            </button>
          ))}
        </div>

        {/* Tickets */}
        <div className="space-y-3">
          {sortedTickets.map((ticket, i) => {
            const statut = statutConfig[ticket.statut];
            const StatutIcon = statut.icon;
            return (
              <motion.div key={ticket.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="bento-card !p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`mt-0.5 rounded-lg p-1.5 ${ticket.priorite === "urgente" ? "bg-[hsl(25,90%,50%)]/10" : "bg-muted"}`}>
                      <Wrench className={`h-4 w-4 ${ticket.priorite === "urgente" ? "text-[hsl(25,90%,40%)]" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{ticket.titre}</p>
                        <Badge className={`text-[10px] ${prioriteConfig[ticket.priorite].color}`}>
                          {prioriteConfig[ticket.priorite].label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{ticket.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{ticket.localisation}</span>
                        <span>Signalé par {ticket.signalePar}</span>
                        <span>{new Date(ticket.dateCreation).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                      </div>
                    </div>
                  </div>
                  <Select value={ticket.statut} onValueChange={(v) => updateStatut(ticket.id, v as StatutTicket)}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <div className="flex items-center gap-1.5">
                        <StatutIcon className={`h-3 w-3 ${statut.color}`} />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ouvert">Ouvert</SelectItem>
                      <SelectItem value="en_cours">En cours</SelectItem>
                      <SelectItem value="résolu">Résolu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>
            );
          })}
        </div>
        </div>
      </main>
    </div>
  );
}
