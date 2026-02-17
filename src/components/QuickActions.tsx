import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, AlertTriangle, HandCoins, CalendarPlus, X } from "lucide-react";

const actions = [
  { label: "Nouvelle récolte", icon: HandCoins, color: "bg-primary text-primary-foreground" },
  { label: "Signaler un bris", icon: AlertTriangle, color: "bg-destructive text-destructive-foreground" },
  { label: "Réserver une salle", icon: CalendarPlus, color: "bg-accent text-accent-foreground" },
];

export function QuickActions() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && actions.map((action, i) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            transition={{ delay: i * 0.06 }}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg ${action.color} hover:opacity-90 transition-opacity`}
            onClick={() => setOpen(false)}
          >
            <action.icon className="h-4 w-4" />
            {action.label}
          </motion.button>
        ))}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen(!open)}
        className="flex h-14 w-14 items-center justify-center rounded-full gradient-emerald shadow-xl shadow-primary/25 transition-transform hover:shadow-2xl"
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}>
          {open ? (
            <X className="h-6 w-6 text-primary-foreground" />
          ) : (
            <Plus className="h-6 w-6 text-primary-foreground" />
          )}
        </motion.div>
      </motion.button>
    </div>
  );
}
