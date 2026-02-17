import { motion } from "framer-motion";
import { recoltesMock } from "@/data/mock-data";
import { HandCoins, TrendingUp } from "lucide-react";

export function RecolteSummary() {
  const total = recoltesMock.reduce((sum, r) => sum + r.montant, 0);
  const derniere = recoltesMock[0];

  return (
    <div className="bento-card gradient-emerald-subtle">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">Récoltes</h3>
        <HandCoins className="h-4 w-4 text-primary" />
      </div>

      <div className="mb-4">
        <p className="text-3xl font-bold tracking-tight text-gradient-emerald">
          {total.toLocaleString('fr-FR')} €
        </p>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-primary" />
          Total du mois de février
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Dernières entrées
        </p>
        {recoltesMock.slice(0, 3).map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center justify-between text-sm"
          >
            <div>
              <span className="font-medium">{r.type}</span>
              <span className="text-muted-foreground ml-2 text-xs">
                {new Date(r.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            <span className="font-semibold tabular-nums">
              +{r.montant.toLocaleString('fr-FR')} €
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
