import { SidebarTrigger } from "@/components/ui/sidebar";
import { Receipt } from "lucide-react";

const RecusFiscaux = () => (
  <main className="flex-1 p-6">
    <div className="flex items-center gap-3 mb-6">
      <SidebarTrigger />
      <Receipt className="h-6 w-6 text-primary" />
      <h1 className="text-2xl font-bold text-foreground">Reçus Fiscaux</h1>
    </div>
    <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
      Module Reçus Fiscaux — en cours de développement
    </div>
  </main>
);

export default RecusFiscaux;
