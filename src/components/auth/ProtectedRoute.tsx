import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

/**
 * ProtectedRoute component that checks authentication status using AuthContext
 * and redirects to login if user is not authenticated.
 *
 * Usage:
 * <ProtectedRoute>
 *   <ClientPortalPage />
 * </ProtectedRoute>
 */
export const ProtectedRoute = ({
  children,
  requireAuth = true
}: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-white/70">Loading...</p>
        </div>
      </div>
    );
  }

  // If auth is required but user is not authenticated, redirect to login
  if (requireAuth && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User is authenticated or auth is not required, render children
  return <>{children}</>;
};

/**
 * Hook to get user's accessible workspaces
 */
export const useUserWorkspaces = () => {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }

    fetchUserWorkspaces();
  }, [user]);

  const fetchUserWorkspaces = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('get_user_workspaces', {
        p_user_id: user!.id
      });

      if (error) throw error;

      setWorkspaces(data || []);
    } catch (error) {
      console.error("Error fetching user workspaces:", error);
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  };

  return { workspaces, loading, refetch: fetchUserWorkspaces };
};
