import { SidebarTrigger } from "@/components/ui/sidebar";
import { FileText } from "lucide-react";

const Documents = () => (
  <main className="flex-1 overflow-y-auto">
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
    <div className="flex items-center gap-3 mb-6">
      <SidebarTrigger />
      <FileText className="h-6 w-6 text-primary" />
      <h1 className="text-2xl font-bold text-foreground">Documents</h1>
    </div>
    <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
      Module Documents — en cours de développement
    </div>
    </div>
  </main>
);

export default Documents;
