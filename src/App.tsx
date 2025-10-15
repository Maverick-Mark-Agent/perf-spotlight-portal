import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Public pages
import MarketingHomePage from "./pages/MarketingHomePage";
import LoginPage from "./pages/LoginPage";

// Protected client portal pages
import ClientPortalPage from "./pages/ClientPortalPage";
import ClientPortalHub from "./pages/ClientPortalHub";

// Admin dashboard pages (currently unauthenticated, will migrate later)
import HomePage from "./pages/HomePage";
import KPIDashboard from "./pages/KPIDashboard";
import KPITestPage from "./pages/KPITestPage";
import EmailAccountsPage from "./pages/EmailAccountsPage";
import VolumeDashboard from "./pages/VolumeDashboard";
import BillingPage from "./pages/BillingPage";
import RevenueDashboard from "./pages/RevenueDashboard";
import ZipDashboard from "./pages/ZipDashboard";
import ROIDashboard from "./pages/ROIDashboard";
import RolloutProgress from "./pages/RolloutProgress";
import ContactPipelineDashboard from "./pages/ContactPipelineDashboard";
import ClientManagement from "./pages/ClientManagement";
import ClientProfile from "./pages/ClientProfile";

// Error pages
import NotFoundPage from "./pages/NotFoundPage";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <DashboardProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* ========================================= */}
              {/* PUBLIC ROUTES (No authentication needed) */}
              {/* ========================================= */}

              {/* Marketing landing page - HOME PAGE - shown to all visitors */}
              <Route path="/" element={<MarketingHomePage />} />

              {/* Login page */}
              <Route path="/login" element={<LoginPage />} />

              {/* ========================================= */}
              {/* PROTECTED CLIENT PORTAL ROUTES */}
              {/* ========================================= */}

              {/* Client portal hub - requires authentication */}
              <Route
                path="/client-portal"
                element={
                  <ProtectedRoute>
                    <ClientPortalHub />
                  </ProtectedRoute>
                }
              />

              {/* Individual client portal workspace - requires authentication */}
              <Route
                path="/client-portal/:workspace"
                element={
                  <ProtectedRoute>
                    <ClientPortalPage />
                  </ProtectedRoute>
                }
              />

              {/* ========================================= */}
              {/* ADMIN DASHBOARD ROUTES */}
              {/* ========================================= */}
              {/* These are currently unauthenticated (internal use) */}
              {/* TODO: Add admin authentication in future */}

              <Route
                path="/admin"
                element={
                  <MainLayout>
                    <HomePage />
                  </MainLayout>
                }
              />
              <Route
                path="/kpi-dashboard"
                element={
                  <MainLayout>
                    <KPIDashboard />
                  </MainLayout>
                }
              />
              <Route
                path="/kpi-test"
                element={
                  <MainLayout>
                    <KPITestPage />
                  </MainLayout>
                }
              />
              <Route
                path="/email-accounts"
                element={
                  <MainLayout>
                    <EmailAccountsPage />
                  </MainLayout>
                }
              />
              <Route
                path="/volume-dashboard"
                element={
                  <MainLayout>
                    <VolumeDashboard />
                  </MainLayout>
                }
              />
              <Route
                path="/billing"
                element={<Navigate to="/revenue-dashboard" replace />}
              />
              <Route
                path="/revenue-dashboard"
                element={
                  <MainLayout>
                    <RevenueDashboard />
                  </MainLayout>
                }
              />
              <Route
                path="/zip-dashboard"
                element={
                  <MainLayout>
                    <ZipDashboard />
                  </MainLayout>
                }
              />
              <Route
                path="/roi-dashboard"
                element={
                  <MainLayout>
                    <ROIDashboard />
                  </MainLayout>
                }
              />
              <Route
                path="/rollout-progress"
                element={
                  <MainLayout>
                    <RolloutProgress />
                  </MainLayout>
                }
              />
              <Route
                path="/contact-pipeline"
                element={
                  <MainLayout>
                    <ContactPipelineDashboard />
                  </MainLayout>
                }
              />
              <Route
                path="/client-management"
                element={
                  <MainLayout>
                    <ClientManagement />
                  </MainLayout>
                }
              />
              <Route
                path="/client-management/:workspaceId"
                element={
                  <MainLayout>
                    <ClientProfile />
                  </MainLayout>
                }
              />

              {/* ========================================= */}
              {/* ERROR ROUTES */}
              {/* ========================================= */}

              {/* 404 - Catch all unknown routes */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </DashboardProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
