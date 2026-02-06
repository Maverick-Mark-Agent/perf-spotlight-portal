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
  bison_reply_numeric_id: number | null;
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
  // Conversation tracking fields (from view, optional for backward compatibility)
  conversation_reply_count?: number;
  conversation_first_reply_date?: string;
  conversation_latest_reply_date?: string;
  conversation_replies_last_7_days?: number;
  conversation_status?: 'single_reply' | 'in_conversation' | 'hot';
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

        // Query the original table (preserves sent_replies FK relationship)
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

        // Fetch conversation stats separately from the view
        let statsQuery = supabase
          .from('lead_conversation_stats')
          .select('lead_email, workspace_name, reply_count, first_reply_date, latest_reply_date, replies_last_7_days, conversation_status');

        if (workspaceName) {
          statsQuery = statsQuery.eq('workspace_name', workspaceName);
        }

        const { data: conversationStats } = await statsQuery;

        // Create a lookup map for conversation stats
        const statsMap = new Map<string, any>();
        if (conversationStats) {
          conversationStats.forEach(stat => {
            const key = `${stat.lead_email}|${stat.workspace_name}`;
            statsMap.set(key, stat);
          });
        }

        // Merge conversation stats into replies
        const repliesWithConversation = (replies || []).map(reply => {
          const key = `${reply.lead_email}|${reply.workspace_name}`;
          const stats = statsMap.get(key);
          return {
            ...reply,
            conversation_reply_count: stats?.reply_count || 1,
            conversation_first_reply_date: stats?.first_reply_date || null,
            conversation_latest_reply_date: stats?.latest_reply_date || null,
            conversation_replies_last_7_days: stats?.replies_last_7_days || 1,
            conversation_status: stats?.conversation_status || 'single_reply',
          };
        });

        setData(repliesWithConversation);
        console.log(`[Realtime Replies] Loaded ${repliesWithConversation.length} initial replies`);

        // Debug: Check for conversation data
        const inConversation = repliesWithConversation.filter(r => r.conversation_reply_count > 1);
        console.log(`[Realtime Replies] ${inConversation.length} replies are part of conversations`);

        // Debug: Check for sent_replies data
        const repliesWithSentReplies = repliesWithConversation.filter(r => r.sent_replies);
        console.log(`[Realtime Replies] ${repliesWithSentReplies.length} replies have sent_replies data`);
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
      // Query the original table (preserves sent_replies FK relationship)
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

      // Fetch conversation stats separately from the view
      let statsQuery = supabase
        .from('lead_conversation_stats')
        .select('lead_email, workspace_name, reply_count, first_reply_date, latest_reply_date, replies_last_7_days, conversation_status');

      if (workspaceName) {
        statsQuery = statsQuery.eq('workspace_name', workspaceName);
      }

      const { data: conversationStats } = await statsQuery;

      // Create a lookup map for conversation stats
      const statsMap = new Map<string, any>();
      if (conversationStats) {
        conversationStats.forEach(stat => {
          const key = `${stat.lead_email}|${stat.workspace_name}`;
          statsMap.set(key, stat);
        });
      }

      // Merge conversation stats into replies
      const repliesWithConversation = (replies || []).map(reply => {
        const key = `${reply.lead_email}|${reply.workspace_name}`;
        const stats = statsMap.get(key);
        return {
          ...reply,
          conversation_reply_count: stats?.reply_count || 1,
          conversation_first_reply_date: stats?.first_reply_date || null,
          conversation_latest_reply_date: stats?.latest_reply_date || null,
          conversation_replies_last_7_days: stats?.replies_last_7_days || 1,
          conversation_status: stats?.conversation_status || 'single_reply',
        };
      });

      setData(repliesWithConversation);
      console.log(`[Realtime Replies] Refreshed with ${repliesWithConversation.length} replies`);
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
          .from('client_registry')
          .select('workspace_name')
          .eq('is_active', true)
          .order('workspace_name');

        if (error) throw error;

        // Extract workspace names
        const workspaceNames = data?.map((r) => r.workspace_name) || [];

        setWorkspaces(workspaceNames);
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
