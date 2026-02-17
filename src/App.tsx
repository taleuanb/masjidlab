import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { RoleProvider } from "@/contexts/RoleContext";
import { AppSidebar } from "@/components/AppSidebar";
import Index from "./pages/Index";
import PlanningPage from "./pages/Planning";
import EvenementsPage from "./pages/Evenements";
import ParkingPage from "./pages/Parking";
import MaintenancePage from "./pages/Maintenance";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppLayout = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/evenements" element={<EvenementsPage />} />
          <Route path="/parking" element={<ParkingPage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </SidebarProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <RoleProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </RoleProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
