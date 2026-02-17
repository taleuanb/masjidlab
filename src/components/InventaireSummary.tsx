import { motion } from "framer-motion";
import { materielMock } from "@/data/mock-data";
import { Package } from "lucide-react";

export function InventaireSummary() {
  return (
    <div className="bento-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold">Inventaire</h3>
        <Package className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="space-y-3">
        {materielMock.slice(0, 5).map((item, i) => {
          const pct = Math.round((item.quantiteDisponible / item.quantiteTotal) * 100);
          const isLow = pct < 30;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.08 }}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium truncate">{item.nom}</span>
                <span className={`text-xs tabular-nums ${isLow ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                  {item.quantiteDisponible}/{item.quantiteTotal}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }}
                  className={`h-full rounded-full ${isLow ? 'bg-destructive' : 'bg-primary'}`}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
