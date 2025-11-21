/**
 * Real-time Replies Hook
 *
 * Subscribes to live updates from the lead_replies table
 * Displays ALL replies (positive and negative) from Email Bison workspaces
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface LeadReply {
  id: string;
  workspace_name: string;
  lead_email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  phone: string | null;
  reply_text: string | null;
  reply_date: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  is_interested: boolean;
  bison_lead_id: string | null;
  bison_reply_id: string | null;
  bison_conversation_url: string | null;
  bison_workspace_id: number | null;
  is_handled: boolean;
  assigned_to: string | null;
  handler_notes: string | null;
  handled_at: string | null;
  created_at: string;
  updated_at: string;
  // PostgREST returns object for one-to-one (UNIQUE constraint), array for one-to-many
  sent_replies?: {
    id: number;
    sent_at: string;
    status: string;
    sent_by: string | null;
  } | Array<{
    id: number;
    sent_at: string;
    status: string;
    sent_by: string | null;
  }>;
}

interface UseRealtimeRepliesOptions {
  workspaceName?: string | null; // Filter by specific workspace, null = all workspaces
  sentiment?: 'positive' | 'negative' | 'neutral' | 'all'; // Filter by sentiment
  limit?: number; // Max number of replies to load initially
}

export function useRealtimeReplies(options: UseRealtimeRepliesOptions = {}) {
  const { workspaceName = null, sentiment = 'all', limit = 100 } = options;

  const [data, setData] = useState<LeadReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newReplyCount, setNewReplyCount] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Separate effect for initial data fetch (runs when filters change)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        setError(null);

        let query = supabase
          .from('lead_replies')
          .select(`
            *,
            sent_replies (
              id,
              sent_at,
              status,
              sent_by
            )
          `)
          .order('reply_date', { ascending: false })
          .limit(limit);

        // Apply workspace filter
        if (workspaceName) {
          query = query.eq('workspace_name', workspaceName);
        }

        // Apply sentiment filter
        if (sentiment !== 'all') {
          query = query.eq('sentiment', sentiment);
        }

        const { data: replies, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        setData(replies || []);
        console.log(`[Realtime Replies] Loaded ${replies?.length || 0} initial replies`);

        // Debug: Check for sent_replies data
        const repliesWithSentReplies = replies?.filter(r => r.sent_replies) || [];
        console.log(`[Realtime Replies] ${repliesWithSentReplies.length} replies have sent_replies data`);
        if (repliesWithSentReplies.length > 0) {
          console.log('[Realtime Replies] First reply with sent_replies:', {
            email: repliesWithSentReplies[0].lead_email,
            sent_replies: repliesWithSentReplies[0].sent_replies,
            isArray: Array.isArray(repliesWithSentReplies[0].sent_replies)
          });
        }
      } catch (err: any) {
        console.error('[Realtime Replies] Error fetching initial data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [workspaceName, sentiment, limit]);

  // Separate effect for realtime subscription (only runs once on mount)
  useEffect(() => {
    // Setup real-time subscription for ALL replies (filtering happens client-side)
    const channelName = 'lead-replies-global';
    console.log(`[Realtime Replies] Setting up global subscription: ${channelName}`);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lead_replies',
        },
        (payload) => {
          const newReply = payload.new as LeadReply;
          console.log('[Realtime Replies] New reply received:', newReply.lead_email);

          // Apply filters client-side
          const matchesWorkspace = !workspaceName || newReply.workspace_name === workspaceName;
          const matchesSentiment = sentiment === 'all' || newReply.sentiment === sentiment;

          if (!matchesWorkspace || !matchesSentiment) {
            console.log(`[Realtime Replies] Filtered out reply (workspace: ${matchesWorkspace}, sentiment: ${matchesSentiment})`);
            return;
          }

          // Add to top of list
          setData((current) => [newReply, ...current]);
          setNewReplyCount((count) => count + 1);

          // Show browser notification if permitted
          if ('Notification' in window && Notification.permission === 'granted') {
            const leadName = [newReply.first_name, newReply.last_name].filter(Boolean).join(' ') || 'Lead';
            const sentimentEmoji = newReply.sentiment === 'positive' ? '✅' : newReply.sentiment === 'negative' ? '❌' : '💬';

            new Notification(`${sentimentEmoji} New Reply from ${leadName}`, {
              body: `${newReply.lead_email} - ${newReply.reply_text?.substring(0, 100) || 'No preview'}`,
              icon: '/favicon.ico',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lead_replies',
        },
        (payload) => {
          const updatedReply = payload.new as LeadReply;
          console.log('[Realtime Replies] Reply updated:', updatedReply.id);

          // Update the reply in the list if it's currently visible
          setData((current) =>
            current.map((reply) =>
              reply.id === updatedReply.id ? updatedReply : reply
            )
          );
        }
      )
      .subscribe((status) => {
        console.log('[Realtime Replies] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime Replies] ✅ Successfully subscribed to real-time updates');
          setError(null); // Clear any previous errors
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime Replies] ❌ Channel error - subscription failed');
          setError('Real-time updates unavailable');
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      console.log(`[Realtime Replies] Cleaning up subscription: ${channelName}`);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []); // Empty deps - only subscribe once on mount

  const clearNewReplyCount = () => {
    setNewReplyCount(0);
  };

  const markAsHandled = async (replyId: string, assignedTo: string, notes?: string) => {
    const { error: updateError } = await supabase
      .from('lead_replies')
      .update({
        is_handled: true,
        assigned_to: assignedTo,
        handler_notes: notes || null,
        handled_at: new Date().toISOString(),
      })
      .eq('id', replyId);

    if (updateError) {
      console.error('[Realtime Replies] Error marking reply as handled:', updateError);
      throw updateError;
    }

    console.log(`[Realtime Replies] Marked reply ${replyId} as handled by ${assignedTo}`);
  };

  const refreshData = async () => {
    console.log('[Realtime Replies] Manually refreshing data...');
    setLoading(true);

    try {
      let query = supabase
        .from('lead_replies')
        .select(`
          *,
          sent_replies (
            id,
            sent_at,
            status,
            sent_by
          )
        `)
        .order('reply_date', { ascending: false })
        .limit(limit);

      if (workspaceName) {
        query = query.eq('workspace_name', workspaceName);
      }

      if (sentiment !== 'all') {
        query = query.eq('sentiment', sentiment);
      }

      const { data: replies, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setData(replies || []);
      console.log(`[Realtime Replies] Refreshed with ${replies?.length || 0} replies`);
    } catch (err: any) {
      console.error('[Realtime Replies] Error refreshing data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    loading,
    error,
    newReplyCount,
    clearNewReplyCount,
    markAsHandled,
    refreshData,
  };
}

// Helper hook to get unique workspace names from replies
export function useReplyWorkspaces() {
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const { data, error } = await supabase
          .from('lead_replies')
          .select('workspace_name')
          .order('workspace_name');

        if (error) throw error;

        // Get unique workspace names
        const uniqueWorkspaces = Array.from(
          new Set(data?.map((r) => r.workspace_name) || [])
        );

        setWorkspaces(uniqueWorkspaces);
      } catch (err) {
        console.error('[Reply Workspaces] Error fetching workspaces:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaces();
  }, []);

  return { workspaces, loading };
}
