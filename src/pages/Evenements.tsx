import { useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  MapPin,
  Users,
  Package,
  HandCoins,
  CheckCircle2,
  Circle,
  ChevronRight,
} from "lucide-react";
import { evenementsMock, sallesMock, materielMock } from "@/data/mock-data";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

export default function EvenementsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(evenementsMock[0]?.id ?? null);
  const selected = evenementsMock.find((e) => e.id === selectedId);

  return (
    <div className="flex-1 overflow-auto">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 backdrop-blur-sm px-6 py-4">
        <SidebarTrigger />
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Événements</h2>
          <p className="text-sm text-muted-foreground">
            {evenementsMock.length} événement{evenementsMock.length > 1 ? "s" : ""} planifié{evenementsMock.length > 1 ? "s" : ""}
          </p>
        </div>
      </header>

      <main className="p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Event list */}
          <div className="space-y-3">
            {evenementsMock.map((evt, i) => {
              const salle = sallesMock.find((s) => s.id === evt.salleId);
              const benevolesOk = evt.benevoles.filter((b) => b.confirme).length;
              return (
                <motion.button
                  key={evt.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => setSelectedId(evt.id)}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                    selectedId === evt.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{evt.titre}</p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(evt.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                      </p>
                    </div>
                    <ChevronRight className={`h-4 w-4 transition-colors ${selectedId === evt.id ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {salle?.nom ?? "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {benevolesOk}/{evt.benevoles.length}
                    </span>
                  </div>
                  <Badge variant="secondary" className="mt-2 text-[10px]">{evt.pole}</Badge>
                </motion.button>
              );
            })}
          </div>

          {/* Event detail */}
          {selected && (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 space-y-5"
            >
              <div className="bento-card">
                <h3 className="text-lg font-semibold">{selected.titre}</h3>
                <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-4 w-4" />
                    {new Date(selected.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {sallesMock.find((s) => s.id === selected.salleId)?.nom}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Budget */}
                <div className="bento-card">
                  <div className="flex items-center gap-2 mb-3">
                    <HandCoins className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold">Budget</h4>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="text-2xl font-bold">{selected.budgetDepense.toLocaleString("fr-FR")} €</span>
                    <span className="text-sm text-muted-foreground mb-0.5">/ {selected.budget.toLocaleString("fr-FR")} €</span>
                  </div>
                  <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.round((selected.budgetDepense / selected.budget) * 100))}%` }}
                      transition={{ duration: 0.6 }}
                      className={`h-full rounded-full ${
                        selected.budgetDepense / selected.budget > 0.9 ? "bg-destructive" : "bg-primary"
                      }`}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.round((selected.budgetDepense / selected.budget) * 100)}% utilisé
                  </p>
                </div>

                {/* Bénévoles */}
                <div className="bento-card">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold">Bénévoles</h4>
                  </div>
                  <div className="space-y-2">
                    {selected.benevoles.map((b, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          {b.confirme ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          {b.nom}
                        </span>
                        <Badge variant={b.confirme ? "default" : "outline"} className="text-[10px]">
                          {b.confirme ? "Confirmé" : "En attente"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Matériel réservé */}
              <div className="bento-card">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">Matériel réservé</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selected.materiel.map((m) => {
                    const mat = materielMock.find((x) => x.id === m.materielId);
                    if (!mat) return null;
                    const enoughStock = mat.quantiteDisponible >= m.quantite;
                    return (
                      <div key={m.materielId} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">{mat.nom}</p>
                          <p className="text-xs text-muted-foreground">Quantité : {m.quantite}</p>
                        </div>
                        <Badge variant={enoughStock ? "default" : "destructive"} className="text-[10px]">
                          {enoughStock ? "Stock OK" : "Insuffisant"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
