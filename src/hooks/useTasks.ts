import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Task,
  TaskCreateInput,
  TaskUpdateInput,
  TaskFilters,
  TeamMember,
  TaskStatus
} from '@/types/tasks';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

// Query keys
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: TaskFilters) => [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

export const teamKeys = {
  all: ['team_members'] as const,
};

/**
 * Fetch all tasks with optional filters
 */
export function useTasks(filters?: TaskFilters) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: taskKeys.list(filters || {}),
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      if (filters?.assignee) {
        if (Array.isArray(filters.assignee)) {
          query = query.in('assignee_name', filters.assignee);
        } else {
          query = query.eq('assignee_name', filters.assignee);
        }
      }

      if (filters?.category) {
        if (Array.isArray(filters.category)) {
          query = query.in('category', filters.category);
        } else {
          query = query.eq('category', filters.category);
        }
      }

      if (filters?.visibility) {
        query = query.eq('visibility', filters.visibility);
      }

      if (filters?.showCompleted === false) {
        query = query.neq('status', 'done');
      }

      const { data, error } = await query;

      if (error) throw error;

      // Client-side search filter (if needed)
      let filteredData = data || [];
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        filteredData = filteredData.filter(
          (task) =>
            task.title.toLowerCase().includes(searchLower) ||
            task.description?.toLowerCase().includes(searchLower)
        );
      }

      return filteredData as Task[];
    },
    staleTime: 30000, // 30 seconds
  });

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          // Invalidate and refetch when any task changes
          queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

/**
 * Fetch a single task by ID
 */
export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Task;
    },
    enabled: !!id,
  });
}

/**
 * Create a new task
 */
export function useCreateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: TaskCreateInput) => {
      // Get current user for assignee_id if visibility is private
      let assigneeId = input.assignee_id;

      if (input.visibility === 'private' && !assigneeId) {
        const { data: { user } } = await supabase.auth.getUser();
        assigneeId = user?.id;
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          ...input,
          assignee_id: assigneeId,
          source: input.source || { type: 'manual', date: new Date().toISOString().split('T')[0] },
        })
        .select()
        .single();

      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      toast({
        title: 'Task created',
        description: 'Your task has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error creating task',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Update an existing task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TaskUpdateInput }) => {
      // Handle task completion for recurring tasks
      const enrichedUpdates = { ...updates };

      if (updates.status === 'done' && !updates.completed_at) {
        enrichedUpdates.completed_at = new Date().toISOString();
      } else if (updates.status && updates.status !== 'done') {
        enrichedUpdates.completed_at = null;
      }

      const { data, error } = await supabase
        .from('tasks')
        .update(enrichedUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Task;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(data.id) });

      if (data.status === 'done') {
        toast({
          title: 'Task completed! 🎉',
          description: data.title,
        });
      } else {
        toast({
          title: 'Task updated',
          description: 'Your changes have been saved.',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating task',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Move a task to a different status (drag-and-drop)
 */
export function useMoveTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const updates: TaskUpdateInput = { status };

      // Handle completion
      if (status === 'done') {
        updates.completed_at = new Date().toISOString();

        // For recurring tasks, also update last_completed
        const { data: task } = await supabase
          .from('tasks')
          .select('is_recurring')
          .eq('id', id)
          .single();

        if (task?.is_recurring) {
          updates.last_completed = new Date().toISOString().split('T')[0];
        }
      } else {
        updates.completed_at = null;
      }

      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Task;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });

      if (data.status === 'done') {
        toast({
          title: 'Task completed! 🎉',
          description: data.title,
        });
      } else {
        toast({
          title: 'Task moved',
          description: `Moved to ${data.status.replace('_', ' ')}`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error moving task',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Delete a task
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      toast({
        title: 'Task deleted',
        description: 'The task has been removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error deleting task',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Fetch all team members
 */
export function useTeamMembers() {
  return useQuery({
    queryKey: teamKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as TeamMember[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (team members change rarely)
  });
}
