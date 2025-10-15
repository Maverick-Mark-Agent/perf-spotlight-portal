import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Secure hook for fetching workspace data via Edge Function
 * This keeps API keys hidden on the server-side
 */
export const useSecureWorkspaceData = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  /**
   * Get all workspaces the current user has access to
   */
  const getUserWorkspaces = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('get-workspace-data', {
        body: {
          action: 'get_user_workspaces',
        },
      });

      if (error) throw error;

      return data.data || [];
    } catch (error: any) {
      console.error('Error fetching user workspaces:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch workspaces',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get all workspaces from Email Bison (filtered to user's access)
   */
  const listWorkspaces = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('get-workspace-data', {
        body: {
          action: 'list_workspaces',
        },
      });

      if (error) throw error;

      return data.data || [];
    } catch (error: any) {
      console.error('Error listing workspaces:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to list workspaces',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get details for a specific workspace
   */
  const getWorkspaceDetails = async (workspaceName: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('get-workspace-data', {
        body: {
          action: 'get_workspace_details',
          workspace_name: workspaceName,
        },
      });

      if (error) throw error;

      return data.data || null;
    } catch (error: any) {
      console.error('Error fetching workspace details:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch workspace details',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    getUserWorkspaces,
    listWorkspaces,
    getWorkspaceDetails,
    loading,
  };
};
