import { Bell, AlertTriangle, MessageSquare, Check, UserCheck, RefreshCw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications, type NotifType } from "@/contexts/NotificationContext";
import { useRole } from "@/contexts/RoleContext";

const TYPE_CONFIG: Record<NotifType, { icon: typeof Bell; className: string }> = {
  stock: { icon: AlertTriangle, className: "bg-destructive/10 text-destructive" },
  message: { icon: MessageSquare, className: "bg-primary/10 text-primary" },
  presence: { icon: UserCheck, className: "bg-primary/10 text-primary" },
  changement: { icon: RefreshCw, className: "bg-amber-500/10 text-amber-600" },
  panne: { icon: Wrench, className: "bg-destructive/10 text-destructive" },
};

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications();
  const { role, pole } = useRole();

  const filtered = notifications.filter((n) => {
    if (n.destinataire === "all") return true;
    if (n.destinataire === role) {
      if (role === "Chef de Pôle" && n.pole) return n.pole === pole;
      return true;
    }
    return false;
  });

  const count = unreadCount(role, pole);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllRead}
              className="h-auto p-0 text-xs text-primary hover:text-primary/80"
            >
              <Check className="mr-1 h-3 w-3" />
              Tout marquer lu
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Aucune notification
            </p>
          ) : (
            filtered.map((n) => {
              const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.message;
              const Icon = config.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                    !n.lu ? "bg-primary/5" : ""
                  }`}
                >
                  <div className={`mt-0.5 rounded-lg p-1.5 ${config.className}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.lu ? "font-medium" : "text-muted-foreground"}`}>
                      {n.titre}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {n.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {new Date(n.date).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {!n.lu && (
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
