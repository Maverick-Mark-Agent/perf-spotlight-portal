import { supabase } from '@/integrations/supabase/client';

export interface User {
  id: string;
  email: string;
  created_at: string;
  workspaces: {
    workspace_name: string;
    role: string;
  }[];
}

/**
 * List all users with their workspace access
 * Requires admin authentication
 */
export async function listUsers(): Promise<User[]> {
  const { data, error } = await supabase.functions.invoke('manage-users', {
    body: {
      action: 'list_users',
    },
  });

  if (error) {
    console.error('Error listing users:', error);
    throw new Error(error.message || 'Failed to list users');
  }

  return data.users;
}

/**
 * Add workspace access for a user
 * Requires admin authentication
 */
export async function addWorkspaceAccess(
  userId: string,
  workspaceName: string,
  role: 'client' | 'admin'
): Promise<void> {
  const { error } = await supabase.functions.invoke('manage-users', {
    body: {
      action: 'add_workspace_access',
      user_id: userId,
      workspace_name: workspaceName,
      role,
    },
  });

  if (error) {
    console.error('Error adding workspace access:', error);
    throw new Error(error.message || 'Failed to add workspace access');
  }
}

/**
 * Remove workspace access for a user
 * Requires admin authentication
 */
export async function removeWorkspaceAccess(
  userId: string,
  workspaceName: string
): Promise<void> {
  const { error } = await supabase.functions.invoke('manage-users', {
    body: {
      action: 'remove_workspace_access',
      user_id: userId,
      workspace_name: workspaceName,
    },
  });

  if (error) {
    console.error('Error removing workspace access:', error);
    throw new Error(error.message || 'Failed to remove workspace access');
  }
}
