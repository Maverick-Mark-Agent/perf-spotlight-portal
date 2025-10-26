import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean; // If false, allows both authenticated and unauthenticated access
}

/**
 * ProtectedRoute component that checks authentication status
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
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Initial check first
    checkAuth();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setAuthenticated(!!session);
        setLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[ProtectedRoute] Session error:', error);
        throw error;
      }

      setAuthenticated(!!session);
    } catch (error) {
      console.error("[ProtectedRoute] Auth check error:", error);
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-white/70">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // If auth is required but user is not authenticated, redirect to login
  if (requireAuth && !authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If auth is NOT required (public route), render children
  // If authenticated, render children
  return <>{children}</>;
};

/**
 * Hook to get current user and authentication state
 */
export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
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

      // Call the PostgreSQL function we created
      const { data, error } = await (supabase as any).rpc('get_user_workspaces', {
        p_user_id: user.id
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
