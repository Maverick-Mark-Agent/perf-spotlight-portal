import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    initializeAuth();

    // Listen for auth changes (single listener for entire app)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('[AuthContext] Auth state changed:', _event);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await checkAdminRole(session.user.id);
        } else {
          setIsAdmin(false);
        }

        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const initializeAuth = async () => {
    try {
      console.log('[AuthContext] Initializing auth...');

      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[AuthContext] Session error:', error);
        throw error;
      }

      console.log('[AuthContext] Session retrieved:', session ? 'User logged in' : 'No session');

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        console.log('[AuthContext] User found, checking admin role...');
        await checkAdminRole(session.user.id);
      }

      console.log('[AuthContext] Initialization complete');
    } catch (error) {
      console.error('[AuthContext] Initialize auth error:', error);
      setSession(null);
      setUser(null);
      setIsAdmin(false);
    } finally {
      console.log('[AuthContext] Setting loading to false');
      setLoading(false);
    }
  };

  const checkAdminRole = async (userId: string) => {
    try {
      console.log('[AuthContext] Checking admin role for user:', userId);

      // Add timeout to prevent infinite hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Admin check timeout')), 5000)
      );

      const queryPromise = supabase
        .from('user_workspace_access')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      console.log('[AuthContext] Admin check result:', { data, error });

      if (error && error.code !== 'PGRST116') {
        console.error('[AuthContext] Admin check error:', error);
        // Don't throw - just set to false and continue
        setIsAdmin(false);
        return;
      }

      const adminStatus = !!data;
      console.log('[AuthContext] Setting isAdmin to:', adminStatus);
      setIsAdmin(adminStatus);
    } catch (error) {
      console.error('[AuthContext] Admin role check failed:', error);
      setIsAdmin(false);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setSession(null);
      setIsAdmin(false);
    } catch (error) {
      console.error('[AuthContext] Sign out error:', error);
      throw error;
    }
  };

  const refreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) throw error;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await checkAdminRole(session.user.id);
      }
    } catch (error) {
      console.error('[AuthContext] Refresh session error:', error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    isAdmin,
    loading,
    signOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
