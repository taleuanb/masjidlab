import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { toast } from "sonner";

export type NotifType = "stock" | "message" | "presence" | "changement" | "panne";

export interface AppNotification {
  id: string;
  type: NotifType;
  titre: string;
  description: string;
  date: string;
  lu: boolean;
  destinataire: "Admin" | "Chef de Pôle" | "Bénévole" | "all";
  pole?: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: (role: string, pole?: string) => number;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  push: (notif: Omit<AppNotification, "id" | "date" | "lu">, showToast?: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const INITIAL: AppNotification[] = [
  { id: "1", type: "stock", titre: "Stock critique : Sono portable", description: "Plus que 1 sono portable disponible sur 3.", date: "2026-02-17T10:30", lu: false, destinataire: "Admin" },
  { id: "2", type: "stock", titre: "Stock bas : Chapiteaux", description: "Plus que 2 chapiteaux disponibles sur 4.", date: "2026-02-17T09:15", lu: false, destinataire: "Admin" },
  { id: "3", type: "message", titre: "Réunion du Conseil", description: "Prochaine réunion du Conseil de la Mosquée le 20/02 à 20h.", date: "2026-02-16T18:00", lu: false, destinataire: "all" },
  { id: "4", type: "message", titre: "Ramadan : Organisation", description: "Veuillez confirmer les bénévoles pour les Iftars.", date: "2026-02-15T14:00", lu: true, destinataire: "all" },
  { id: "5", type: "stock", titre: "Chaises pliantes", description: "Plus que 145 chaises disponibles. 55 réservées pour la distribution.", date: "2026-02-15T08:00", lu: true, destinataire: "Admin" },
];

const TOAST_ICONS: Record<NotifType, string> = {
  stock: "📦",
  message: "💬",
  presence: "✅",
  changement: "🔄",
  panne: "🔧",
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL);

  const push = useCallback(
    (notif: Omit<AppNotification, "id" | "date" | "lu">, showToast = true) => {
      const full: AppNotification = {
        ...notif,
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: new Date().toISOString(),
        lu: false,
      };
      setNotifications((prev) => [full, ...prev]);

      if (showToast) {
        toast(notif.titre, {
          description: notif.description,
          icon: TOAST_ICONS[notif.type] || "🔔",
        });
      }
    },
    []
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, lu: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, lu: true })));
  }, []);

  const unreadCount = useCallback(
    (role: string, pole?: string) =>
      notifications.filter((n) => {
        if (n.lu) return false;
        if (n.destinataire === "all") return true;
        if (n.destinataire === role) {
          if (role === "Chef de Pôle" && n.pole) return n.pole === pole;
          return true;
        }
        return false;
      }).length,
    [notifications]
  );

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllRead, push }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
