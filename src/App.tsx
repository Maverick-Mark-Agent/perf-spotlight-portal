import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { DashboardProvider } from "@/contexts/DashboardContext";
import HomePage from "./pages/HomePage";
import KPIDashboard from "./pages/KPIDashboard";
import KPITestPage from "./pages/KPITestPage";
import EmailAccountsPage from "./pages/EmailAccountsPage";
import VolumeDashboard from "./pages/VolumeDashboard";
import BillingPage from "./pages/BillingPage";
import ClientPortalPage from "./pages/ClientPortalPage";
import ClientPortalHub from "./pages/ClientPortalHub";
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
              <Route path="/" element={<HomePage />} />
              <Route path="/kpi-dashboard" element={<KPIDashboard />} />
              <Route path="/kpi-test" element={<KPITestPage />} />
              <Route path="/email-accounts" element={<EmailAccountsPage />} />
              <Route path="/volume-dashboard" element={<VolumeDashboard />} />
              <Route path="/billing" element={<BillingPage />} />
              <Route path="/client-portal" element={<ClientPortalHub />} />
              <Route path="/client-portal/:workspace" element={<ClientPortalPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </DashboardProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
