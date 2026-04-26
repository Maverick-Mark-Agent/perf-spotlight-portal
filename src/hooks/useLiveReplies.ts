import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface SentReplyRow {
  id: number;
  sent_at: string;
  status: string;
  sent_by: string | null;
  verified_at: string | null;
  error_message: string | null;
  retry_count: number;
  last_retry_at: string | null;
}

export type ReplyState = 'none' | 'pending' | 'replied' | 'failed';

export function getReplyState(reply: { sent_replies?: SentReplyRow | Array<SentReplyRow> }): ReplyState {
  const sr = Array.isArray(reply.sent_replies)
    ? reply.sent_replies[0]
    : reply.sent_replies;
  if (!sr) return 'none';
  if (sr.status === 'failed') return 'failed';
  if (sr.verified_at) return 'replied';
  return 'pending';
}

export function getSentReply(reply: { sent_replies?: SentReplyRow | Array<SentReplyRow> }): SentReplyRow | null {
  const sr = Array.isArray(reply.sent_replies) ? reply.sent_replies[0] : reply.sent_replies;
  return sr ?? null;
}

export interface LiveReply {
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
  sentiment: 'positive' | 'negative' | 'neutral' | null;
  is_interested: boolean;
  bison_conversation_url: string | null;
  bison_reply_numeric_id: number | null;
  created_at: string;
  // PostgREST returns object for one-to-one (UNIQUE constraint), array for one-to-many
  sent_replies?: SentReplyRow | Array<SentReplyRow>;
  // Conversation tracking fields (from view, optional for backward compatibility)
  conversation_reply_count?: number;
  conversation_first_reply_date?: string;
  conversation_latest_reply_date?: string;
  conversation_replies_last_7_days?: number;
  conversation_status?: 'single_reply' | 'in_conversation' | 'hot';
}

interface UseLiveRepliesReturn {
  replies: LiveReply[];
  loading: boolean;
  error: string | null;
  newReplyCount: number;
  clearNewReplyCount: () => void;
  refreshReplies: () => void;
}

export function useLiveReplies(): UseLiveRepliesReturn {
  const [replies, setReplies] = useState<LiveReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newReplyCount, setNewReplyCount] = useState(0);
  // Ref so the sent_replies realtime handler can call the latest fetchReplies
  const fetchRepliesRef = useRef<() => void>(() => {});

  const fetchReplies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Query the original table (preserves sent_replies FK relationship)
      const { data, error: fetchError } = await supabase
        .from('lead_replies')
        .select(`
          id,
          workspace_name,
          lead_email,
          first_name,
          last_name,
          company,
          title,
          phone,
          reply_text,
          reply_date,
          sentiment,
          is_interested,
          bison_conversation_url,
          bison_reply_numeric_id,
          created_at,
          sent_replies (
            id,
            sent_at,
            status,
            sent_by,
            verified_at,
            error_message,
            retry_count,
            last_retry_at
          )
        `)
        .order('reply_date', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;

      // Fetch conversation stats separately from the view
      const { data: conversationStats } = await supabase
        .from('lead_conversation_stats')
        .select('lead_email, workspace_name, reply_count, first_reply_date, latest_reply_date, replies_last_7_days, conversation_status');

      // Create a lookup map for conversation stats
      const statsMap = new Map<string, any>();
      if (conversationStats) {
        conversationStats.forEach(stat => {
          const key = `${stat.lead_email}|${stat.workspace_name}`;
          statsMap.set(key, stat);
        });
      }

      // Merge conversation stats into replies
      const repliesWithConversation = (data || []).map(reply => {
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

      // Debug logging for reply tracking
      console.log('🔍 useLiveReplies - Fetched', repliesWithConversation.length, 'leads');
      const repliedLeads = repliesWithConversation.filter(lead => lead.sent_replies);
      console.log('🔍 useLiveReplies - Leads with sent_replies:', repliedLeads.length);
      if (repliedLeads.length > 0) {
        console.log('🔍 First replied lead:', {
          email: repliedLeads[0].lead_email,
          sent_replies: repliedLeads[0].sent_replies,
          isArray: Array.isArray(repliedLeads[0].sent_replies),
          type: typeof repliedLeads[0].sent_replies
        });
      }

      // Log conversation data
      const conversationLeads = repliesWithConversation.filter(lead => (lead.conversation_reply_count || 0) > 1);
      console.log('🔍 useLiveReplies - Leads in conversation:', conversationLeads.length);

      setReplies(repliesWithConversation);
    } catch (err) {
      console.error('Error fetching replies:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch replies');
    } finally {
      setLoading(false);
    }
  }, []);

  // Keep ref in sync so realtime handlers always call the latest version
  useEffect(() => {
    fetchRepliesRef.current = fetchReplies;
  }, [fetchReplies]);

  // Initial fetch
  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  // Real-time subscription — watches both lead_replies (new incoming) and sent_replies (we replied)
  useEffect(() => {
    let channel: RealtimeChannel;

    const setupRealtimeSubscription = () => {
      channel = supabase
        .channel('live-replies-board')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'lead_replies',
          },
          (payload) => {
            console.log('New reply received:', payload);
            const newReply = payload.new as LiveReply;

            // Add to top of list
            setReplies((current) => [newReply, ...current]);

            // Increment new reply count
            setNewReplyCount((count) => count + 1);

            // Browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
              const leadName = newReply.first_name && newReply.last_name
                ? `${newReply.first_name} ${newReply.last_name}`
                : newReply.lead_email;

              new Notification('New Reply Received', {
                body: `${leadName} from ${newReply.workspace_name}`,
                icon: '/favicon.ico',
                tag: newReply.id,
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'sent_replies',
          },
          (payload) => {
            // When we send a reply, refresh the full list so the card flips to "REPLIED"
            console.log('sent_replies INSERT — refreshing list:', payload);
            fetchRepliesRef.current();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'sent_replies',
          },
          (payload) => {
            console.log('sent_replies UPDATE — refreshing list:', payload);
            fetchRepliesRef.current();
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
        });
    };

    setupRealtimeSubscription();

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  function clearNewReplyCount() {
    setNewReplyCount(0);
  }

  return {
    replies,
    loading,
    error,
    newReplyCount,
    clearNewReplyCount,
    refreshReplies: fetchReplies,
  };
}
