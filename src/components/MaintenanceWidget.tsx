import { useState } from "react";
import { motion } from "framer-motion";
import { Wrench, AlertTriangle, Plus, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ticketsMock, sallesMock } from "@/data/mock-data";
import { PrioriteTicket } from "@/types/amm";
import { toast } from "@/hooks/use-toast";
import { useNotifications } from "@/contexts/NotificationContext";

const prioriteConfig: Record<PrioriteTicket, { label: string; class: string }> = {
  basse: { label: "Basse", class: "bg-muted text-muted-foreground" },
  moyenne: { label: "Moyenne", class: "bg-amber-500/15 text-amber-700 border-amber-500/20" },
  haute: { label: "Haute", class: "bg-orange-500/15 text-orange-700 border-orange-500/20" },
  urgente: { label: "Critique", class: "bg-destructive/15 text-destructive border-destructive/20" },
};

const typesMateriels = [
  "Plomberie", "Électricité", "Climatisation", "Mobilier",
  "Serrurerie", "Informatique", "Autre",
];

export function MaintenanceWidget() {
  const [open, setOpen] = useState(false);
  const [salle, setSalle] = useState("");
  const [type, setType] = useState("");
  const [priorite, setPriorite] = useState("");
  const [desc, setDesc] = useState("");
  const { push } = useNotifications();

  const lastTickets = [...ticketsMock]
    .filter(t => t.statut !== "résolu")
    .sort((a, b) => new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime())
    .slice(0, 3);

  const handleSubmit = () => {
    if (!salle || !type || !priorite) return;
    const salleName = sallesMock.find(s => s.id === salle)?.nom ?? salle;
    toast({
      title: "Incident signalé",
      description: `${type} — ${salleName}`,
    });
    push({
      type: "panne",
      titre: `Panne signalée : ${type}`,
      description: `${type} en ${salleName}. Priorité : ${prioriteConfig[priorite as PrioriteTicket]?.label ?? priorite}.`,
      destinataire: "Admin Mosquée",
    });
    setSalle(""); setType(""); setPriorite(""); setDesc("");
    setOpen(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bento-card"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
            <Wrench className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Maintenance & Signalements</h3>
            <p className="text-[11px] text-muted-foreground">Derniers incidents ouverts</p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10">
              <Plus className="h-3.5 w-3.5" />
              Signaler un bris
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Signaler un incident
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Salle concernée</Label>
                <Select value={salle} onValueChange={setSalle}>
                  <SelectTrigger><SelectValue placeholder="Choisir une salle" /></SelectTrigger>
                  <SelectContent>
                    {sallesMock.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nom} ({s.etage})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type de matériel</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue placeholder="Type de problème" /></SelectTrigger>
                  <SelectContent>
                    {typesMateriels.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Niveau d'urgence</Label>
                <Select value={priorite} onValueChange={setPriorite}>
                  <SelectTrigger><SelectValue placeholder="Priorité" /></SelectTrigger>
                  <SelectContent>
                    {(["basse", "moyenne", "haute", "urgente"] as PrioriteTicket[]).map(p => (
                      <SelectItem key={p} value={p}>{prioriteConfig[p].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description (optionnel)</Label>
                <Textarea
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="Décrivez le problème…"
                  className="resize-none h-20 text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost" size="sm">Annuler</Button>
              </DialogClose>
              <Button size="sm" onClick={handleSubmit} disabled={!salle || !type || !priorite} className="gradient-emerald text-primary-foreground">
                Envoyer le signalement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Last 3 tickets */}
      <div className="space-y-2">
        {lastTickets.map((ticket, i) => {
          const cfg = prioriteConfig[ticket.priorite];
          return (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
            >
              <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${
                ticket.priorite === "urgente" ? "text-destructive" :
                ticket.priorite === "haute" ? "text-orange-500" :
                "text-muted-foreground"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-medium truncate">{ticket.titre}</p>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${cfg.class}`}>
                    {cfg.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  {ticket.localisation}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
