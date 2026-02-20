import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { RoleProvider } from "@/contexts/RoleContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OrganizationProvider, useOrganization } from "@/contexts/OrganizationContext";
import PendingAffectation from "@/pages/PendingAffectation";
import { AppSidebar } from "@/components/AppSidebar";
import Index from "./pages/Index";
import PlanningPage from "./pages/Planning";
import EvenementsPage from "./pages/Evenements";
import ParkingPage from "./pages/Parking";
import MaintenancePage from "./pages/Maintenance";
import MonAgendaPage from "./pages/MonAgenda";
import MesMissionsPage from "./pages/MesMissions";
import ApprobationsPage from "./pages/Approbations";
import GestionOperationsPage from "./pages/GestionOperations";
import MonEquipePage from "./pages/MonEquipe";
import StructureMembresPage from "./pages/StructureMembres";
import SaasAdminPage from "./pages/SaasAdmin";
import LoginPage from "./pages/Login";
import SetPasswordPage from "./pages/SetPassword";
import OnboardingPage from "./pages/Onboarding";
import SettingsPage from "./pages/Settings";
import FinancePage from "./pages/Finance";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { loading: orgLoading, pendingAffectation } = useOrganization();

  if (loading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (pendingAffectation) {
    return <PendingAffectation />;
  }

  return <>{children}</>;
}

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
          <Route path="/mon-agenda" element={<MonAgendaPage />} />
          <Route path="/missions" element={<MesMissionsPage />} />
          <Route path="/approbations" element={<ApprobationsPage />} />
          <Route path="/operations" element={<GestionOperationsPage />} />
          <Route path="/structure-membres" element={<StructureMembresPage />} />
          <Route path="/membres" element={<StructureMembresPage />} />
          <Route path="/organisation" element={<StructureMembresPage />} />
          <Route path="/mon-equipe" element={<MonEquipePage />} />
          <Route path="/configuration" element={<SettingsPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/saas-admin" element={<SaasAdminPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </SidebarProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <OrganizationProvider>
          <RoleProvider>
            <NotificationProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/set-password" element={<SetPasswordPage />} />
                  <Route path="/onboarding" element={<OnboardingPage />} />
                  <Route
                    path="/*"
                    element={
                      <RequireAuth>
                        <AppLayout />
                      </RequireAuth>
                    }
                  />
                </Routes>
              </BrowserRouter>
            </NotificationProvider>
          </RoleProvider>
        </OrganizationProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
