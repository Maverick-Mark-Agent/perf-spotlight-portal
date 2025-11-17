import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Producer {
  user_id: string;
  full_name: string;
  email: string;
}

// Internal team members to exclude from producer lists
const INTERNAL_TEAM_IDS = [
  '09322929-6078-4b08-bd55-e3e1ff773028', // Tommy Chavez
  // Add other internal team member UUIDs here as needed
];

// Internal team email patterns to exclude
const INTERNAL_EMAIL_PATTERNS = [
  '@maverickmarketing',
  'maverick',
];

export const useWorkspaceProducers = (workspaceName: string | null) => {
  const [producers, setProducers] = useState<Producer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceName) {
      setProducers([]);
      return;
    }

    fetchProducers();
  }, [workspaceName]);

  const fetchProducers = async () => {
    if (!workspaceName) return;

    try {
      setLoading(true);
      setError(null);

      // Get all users with access to this workspace
      const { data: workspaceUsers, error: accessError } = await supabase
        .from('user_workspace_access')
        .select('user_id, role')
        .eq('workspace_name', workspaceName);

      if (accessError) {
        console.error('[useWorkspaceProducers] Error fetching workspace users:', accessError);
        throw accessError;
      }

      if (!workspaceUsers || workspaceUsers.length === 0) {
        setProducers([]);
        return;
      }

      // Get user profiles for these users
      const userIds = workspaceUsers.map((u: any) => u.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) {
        console.error('[useWorkspaceProducers] Error fetching profiles:', profilesError);
        throw profilesError;
      }

      // Create a map of user_id to profile
      const profileMap = new Map<string, { full_name: string; email: string }>();
      (profiles || []).forEach((p: any) => {
        profileMap.set(p.id, {
          full_name: p.full_name || '',
          email: p.email || ''
        });
      });

      // Filter out admins and internal team
      const filteredProducers = (workspaceUsers || [])
        .filter((access: any) => {
          // Exclude admin role users
          if (access.role === 'admin') return false;

          // Exclude internal team by user ID
          if (INTERNAL_TEAM_IDS.includes(access.user_id)) return false;

          // Exclude internal team by email pattern
          const profile = profileMap.get(access.user_id);
          const userEmail = profile?.email?.toLowerCase() || '';
          const isInternal = INTERNAL_EMAIL_PATTERNS.some(pattern =>
            userEmail.includes(pattern.toLowerCase())
          );
          if (isInternal) return false;

          return true;
        })
        .map((access: any) => {
          const profile = profileMap.get(access.user_id);
          // Use email username as fallback name if full_name is empty
          const emailUsername = profile?.email?.split('@')[0] || '';
          const displayName = profile?.full_name || emailUsername || 'Unknown User';

          return {
            user_id: access.user_id,
            full_name: displayName,
            email: profile?.email || '',
          };
        })
        .sort((a: Producer, b: Producer) =>
          a.full_name.localeCompare(b.full_name)
        );

      setProducers(filteredProducers);
    } catch (err: any) {
      console.error('[useWorkspaceProducers] Error:', err);
      setError(err.message || 'Failed to fetch producers');
      setProducers([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshProducers = () => {
    fetchProducers();
  };

  return {
    producers,
    loading,
    error,
    refreshProducers,
  };
};
