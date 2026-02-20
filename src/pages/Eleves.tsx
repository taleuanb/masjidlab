import { SidebarTrigger } from "@/components/ui/sidebar";
import { GraduationCap } from "lucide-react";

const Eleves = () => (
  <main className="flex-1 p-6">
    <div className="flex items-center gap-3 mb-6">
      <SidebarTrigger />
      <GraduationCap className="h-6 w-6 text-primary" />
      <h1 className="text-2xl font-bold text-foreground">Élèves</h1>
    </div>
    <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
      Module Élèves — en cours de développement
    </div>
  </main>
);

export default Eleves;
