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
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import PendingAffectation from "@/pages/PendingAffectation";
import { RequireActivePole } from "@/components/RequireActivePole";
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
import ElevesPage from "./pages/Eleves";
import ClassesPage from "./pages/Classes";
import InscriptionsPage from "./pages/Inscriptions";
import ContratsStaffPage from "./pages/ContratsStaff";
import DocumentsPage from "./pages/Documents";
import DonateursPage from "./pages/Donateurs";
import RecusFiscauxPage from "./pages/RecusFiscaux";
import NotFound from "./pages/NotFound";
import JoinPage from "./pages/JoinPage";
import WelcomePage from "./pages/Welcome";
import LandingPage from "./pages/Landing";
import SetupIdentityPage from "./pages/SetupIdentity";
import SetupPlanPage from "./pages/SetupPlan";
import SetupSuccessPage from "./pages/SetupSuccess";
import { Loader2 } from "lucide-react";
import { isVitrineDomain } from "@/lib/domain";

const queryClient = new QueryClient();

function RequireAuthWithOrgGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, dbRoles } = useAuth();
  const { loading: orgLoading, pendingAffectation, org } = useOrganization();
  const isSuperAdmin = dbRoles.includes("super_admin");

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

  // If org exists but is pending → redirect to waiting page (super_admin bypasses)
  if (org && org.status === "pending" && !isSuperAdmin) {
    return <Navigate to="/setup/success" replace />;
  }

  if (pendingAffectation) {
    return <PendingAffectation />;
  }

  return <>{children}</>;
}

const AppLayoutOrPending = () => {
  const { dbRoles } = useAuth();
  const { org } = useOrganization();
  const isSuperAdmin = dbRoles.includes("super_admin");
  const isPending = org && org.status === "pending" && !isSuperAdmin;

  if (isPending) {
    return <Navigate to="/setup/success" replace />;
  }

  return <AppLayout />;
};

const AppLayout = () => {
  return (
    <SidebarProvider>
      <ImpersonationBanner />
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <RequireActivePole>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Index />} />
            <Route path="/profil" element={<Index />} />
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
            <Route path="/eleves" element={<ElevesPage />} />
            <Route path="/classes" element={<ClassesPage />} />
            <Route path="/inscriptions" element={<InscriptionsPage />} />
            <Route path="/contrats-staff" element={<ContratsStaffPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/donateurs" element={<DonateursPage />} />
            <Route path="/recus-fiscaux" element={<RecusFiscauxPage />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </RequireActivePole>
      </div>
    </SidebarProvider>
  );
};

const App = () => {
  const vitrine = isVitrineDomain();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {vitrine ? (
            <Routes>
              <Route path="*" element={<LandingPage />} />
            </Routes>
          ) : (
            <AuthProvider>
              <OrganizationProvider>
                <RoleProvider>
                  <NotificationProvider>
                    <Routes>
                      <Route path="/vitrine" element={<LandingPage />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/set-password" element={<SetPasswordPage />} />
                      <Route path="/onboarding" element={<OnboardingPage />} />
                      <Route path="/welcome" element={<WelcomePage />} />
                      {/* Setup wizard — requires auth but NOT full org guard */}
                      <Route path="/setup/identity" element={<SetupIdentityPage />} />
                      <Route path="/setup/plan" element={<SetupPlanPage />} />
                      <Route path="/setup/success" element={<SetupSuccessPage />} />
                      <Route path="/join/:id" element={<JoinPage />} />
                      <Route
                        path="/*"
                        element={
                          <RequireAuthWithOrgGuard>
                            <AppLayoutOrPending />
                          </RequireAuthWithOrgGuard>
                        }
                      />
                    </Routes>
                  </NotificationProvider>
                </RoleProvider>
              </OrganizationProvider>
            </AuthProvider>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
