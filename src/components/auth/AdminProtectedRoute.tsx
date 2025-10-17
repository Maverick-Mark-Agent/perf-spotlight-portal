import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * AdminProtectedRoute component that checks if user is authenticated AND has admin role.
 * Redirects to login if not authenticated, shows access denied if not admin.
 *
 * Uses centralized AuthContext to avoid duplicate auth checks and infinite loading.
 *
 * Usage:
 * <AdminProtectedRoute>
 *   <AdminDashboard />
 * </AdminProtectedRoute>
 */
export const AdminProtectedRoute = ({ children }: AdminProtectedRouteProps) => {
  const { user, isAdmin, loading, signOut } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#5B8FF9] animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If authenticated but not admin, show access denied
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Access Denied
          </h1>
          <p className="text-muted-foreground mb-6">
            You don't have permission to access the admin dashboard.
            This area is restricted to team members only.
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/client-portal">
              <Button variant="outline">
                Go to Client Portal
              </Button>
            </Link>
            <Button
              variant="default"
              onClick={async () => {
                await signOut();
                window.location.href = "/login";
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // User is authenticated AND is admin, render children
  return <>{children}</>;
};

/**
 * Hook to check if current user is admin
 * Uses centralized AuthContext to avoid duplicate admin checks
 */
export const useIsAdmin = () => {
  const { isAdmin, loading } = useAuth();
  return { isAdmin, loading };
};
