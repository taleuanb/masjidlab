import { useState } from "react";
import { motion } from "framer-motion";
import { Car, UserCheck, UserX, MapPin } from "lucide-react";
import { parkingPlacesMock, benevolesParkingMock } from "@/data/mock-data";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

export default function ParkingPage() {
  const [places] = useState(parkingPlacesMock);
  const [benevoles, setBenevoles] = useState(benevolesParkingMock);

  const totalPlaces = places.length;
  const occupees = places.filter((p) => p.occupee).length;
  const libres = totalPlaces - occupees;
  const tauxOccupation = Math.round((occupees / totalPlaces) * 100);

  const zones = ["A", "B", "C"] as const;

  const togglePresence = (id: string) => {
    setBenevoles((prev) =>
      prev.map((b) => (b.id === id ? { ...b, present: !b.present } : b))
    );
  };

  return (
    <div className="flex-1 overflow-auto">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 backdrop-blur-sm px-6 py-4">
        <SidebarTrigger />
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Gestion Parking</h2>
          <p className="text-sm text-muted-foreground">
            {totalPlaces} places · {libres} disponibles
          </p>
        </div>
      </header>

      <main className="p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bento-card">
            <p className="text-sm text-muted-foreground">Places libres</p>
            <p className="text-3xl font-bold mt-1">{libres}</p>
            <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${tauxOccupation}%` }}
                transition={{ duration: 0.6 }}
                className={`h-full rounded-full ${tauxOccupation > 85 ? "bg-destructive" : tauxOccupation > 60 ? "bg-amber-500" : "bg-primary"}`}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{tauxOccupation}% occupé</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="bento-card">
            <p className="text-sm text-muted-foreground">Bénévoles présents</p>
            <p className="text-3xl font-bold mt-1">
              {benevoles.filter((b) => b.present).length}/{benevoles.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Postes couverts</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="bento-card">
            <p className="text-sm text-muted-foreground">Zones</p>
            <div className="flex gap-2 mt-2">
              {zones.map((z) => {
                const zPlaces = places.filter((p) => p.zone === z);
                const zLibres = zPlaces.filter((p) => !p.occupee).length;
                return (
                  <div key={z} className="flex-1 rounded-lg border p-2 text-center">
                    <p className="text-xs font-medium">Zone {z}</p>
                    <p className="text-lg font-bold">{zLibres}</p>
                    <p className="text-[10px] text-muted-foreground">/{zPlaces.length}</p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Parking grid */}
          <div className="bento-card">
            <h3 className="text-base font-semibold mb-4">Plan du parking</h3>
            {zones.map((z) => {
              const zPlaces = places.filter((p) => p.zone === z);
              return (
                <div key={z} className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Zone {z} — {zPlaces.filter((p) => !p.occupee).length} libres
                  </p>
                  <div className="grid grid-cols-9 gap-1.5">
                    {zPlaces.map((p) => (
                      <motion.div
                        key={p.id}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`aspect-square rounded-md flex items-center justify-center text-[10px] font-medium border transition-colors ${
                          p.occupee
                            ? "bg-destructive/10 border-destructive/25 text-destructive"
                            : "bg-primary/10 border-primary/25 text-primary"
                        }`}
                      >
                        {p.numero}
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-primary/10 border border-primary/25" /> Libre
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-destructive/10 border border-destructive/25" /> Occupée
              </span>
            </div>
          </div>

          {/* Bénévoles parking */}
          <div className="bento-card">
            <h3 className="text-base font-semibold mb-4">Équipe Parking</h3>
            <div className="space-y-3">
              {benevoles.map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-full p-1.5 ${b.present ? "bg-primary/10" : "bg-muted"}`}>
                      {b.present ? (
                        <UserCheck className="h-4 w-4 text-primary" />
                      ) : (
                        <UserX className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{b.nom}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {b.poste}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => togglePresence(b.id)}
                    className="text-xs"
                  >
                    <Badge variant={b.present ? "default" : "outline"}>
                      {b.present ? "Présent" : "Absent"}
                    </Badge>
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
