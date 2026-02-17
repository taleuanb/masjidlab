import { motion } from "framer-motion";
import { materielMock } from "@/data/mock-data";
import { Package, AlertTriangle, CheckCircle2 } from "lucide-react";

function getHealthColor(pct: number) {
  if (pct < 10) return { bar: "bg-destructive", text: "text-destructive", label: "Critique", icon: AlertTriangle };
  if (pct < 30) return { bar: "bg-amber-500", text: "text-amber-600", label: "Bas", icon: AlertTriangle };
  return { bar: "bg-primary", text: "text-primary", label: "OK", icon: CheckCircle2 };
}

export function InventaireSummary() {
  return (
    <div className="bento-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">Inventaire</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Santé des stocks critiques</p>
        </div>
        <Package className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="space-y-4">
        {materielMock.map((item, i) => {
          const pct = Math.round((item.quantiteDisponible / item.quantiteTotal) * 100);
          const health = getHealthColor(pct);
          const HealthIcon = health.icon;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.08 }}
            >
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <HealthIcon className={`h-3.5 w-3.5 ${health.text}`} />
                  <span className="font-medium truncate">{item.nom}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    pct < 10 ? 'bg-destructive/10 text-destructive' :
                    pct < 30 ? 'bg-amber-500/10 text-amber-600' :
                    'bg-primary/10 text-primary'
                  }`}>
                    {health.label}
                  </span>
                  <span className={`text-xs tabular-nums font-medium ${health.text}`}>
                    {item.quantiteDisponible}/{item.quantiteTotal}
                  </span>
                </div>
              </div>
              <div className="mt-1.5 h-2 w-full rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }}
                  className={`h-full rounded-full transition-colors ${health.bar}`}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{item.emplacement}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
