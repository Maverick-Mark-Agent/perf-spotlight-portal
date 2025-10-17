import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminProtectedRoute } from "@/components/auth/AdminProtectedRoute";

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
import UserManagement from "./pages/UserManagement";

// Error pages
import NotFoundPage from "./pages/NotFoundPage";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
              {/* Protected routes for internal team with admin role */}

              <Route
                path="/admin"
                element={
                  <AdminProtectedRoute>
                    <MainLayout>
                      <HomePage />
                    </MainLayout>
                  </AdminProtectedRoute>
                }
              />
              <Route
                path="/kpi-dashboard"
                element={
                  <AdminProtectedRoute>
                    <MainLayout>
                      <KPIDashboard />
                    </MainLayout>
                  </AdminProtectedRoute>
                }
              />
              <Route
                path="/kpi-test"
                element={
                  <AdminProtectedRoute>
                    <MainLayout>
                      <KPITestPage />
                    </MainLayout>
                  </AdminProtectedRoute>
                }
              />
              <Route
                path="/email-accounts"
                element={
                  <AdminProtectedRoute>
                    <MainLayout>
                      <EmailAccountsPage />
                    </MainLayout>
                  </AdminProtectedRoute>
                }
              />
              <Route
                path="/volume-dashboard"
                element={
                  <AdminProtectedRoute>
                    <MainLayout>
                      <VolumeDashboard />
                    </MainLayout>
                  </AdminProtectedRoute>
                }
              />
              <Route
                path="/billing"
                element={<Navigate to="/revenue-dashboard" replace />}
              />
              <Route
                path="/revenue-dashboard"
                element={
                  <AdminProtectedRoute>
                    <MainLayout>
                      <RevenueDashboard />
                    </MainLayout>
                  </AdminProtectedRoute>
                }
              />
              <Route
                path="/zip-dashboard"
                element={
                  <AdminProtectedRoute>
                    <MainLayout>
                      <ZipDashboard />
                    </MainLayout>
                  </AdminProtectedRoute>
                }
              />
              <Route
                path="/roi-dashboard"
                element={
                  <AdminProtectedRoute>
                    <MainLayout>
                      <ROIDashboard />
                    </MainLayout>
                  </AdminProtectedRoute>
                }
              />
              <Route
                path="/rollout-progress"
                element={
                  <AdminProtectedRoute>
                    <MainLayout>
                      <RolloutProgress />
                    </MainLayout>
                  </AdminProtectedRoute>
                }
              />
              <Route
                path="/contact-pipeline"
                element={
                  <AdminProtectedRoute>
                    <MainLayout>
                      <ContactPipelineDashboard />
                    </MainLayout>
                  </AdminProtectedRoute>
                }
              />
              <Route
                path="/client-management"
                element={
                  <AdminProtectedRoute>
                    <MainLayout>
                      <ClientManagement />
                    </MainLayout>
                  </AdminProtectedRoute>
                }
              />
              <Route
                path="/client-management/:workspaceId"
                element={
                  <AdminProtectedRoute>
                    <MainLayout>
                      <ClientProfile />
                    </MainLayout>
                  </AdminProtectedRoute>
                }
              />
              <Route
                path="/user-management"
                element={
                  <AdminProtectedRoute>
                    <MainLayout>
                      <UserManagement />
                    </MainLayout>
                  </AdminProtectedRoute>
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
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
