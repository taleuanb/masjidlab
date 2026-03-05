import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DB_ROLE_TO_UI } from "@/contexts/RoleContext";

export function ImpersonationBanner() {
  const { impersonatedUser, stopImpersonating } = useAuth();

  if (!impersonatedUser) return null;

  const roleLabels = impersonatedUser.roles
    .map((r) => DB_ROLE_TO_UI[r] ?? r)
    .join(", ");

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-[hsl(var(--amber-warm))] text-primary-foreground px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shadow-md">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        Mode Ghost : Vous agissez en tant que{" "}
        <strong>{impersonatedUser.name}</strong> ({roleLabels})
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={stopImpersonating}
        className="h-7 px-2 text-primary-foreground hover:bg-[hsl(var(--amber-warm))]/80 ml-2"
      >
        <X className="h-3.5 w-3.5 mr-1" />
        Quitter
      </Button>
    </div>
  );
}
