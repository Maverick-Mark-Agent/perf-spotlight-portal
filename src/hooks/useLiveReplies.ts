import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
            sent_by
          )
        `)
        .order('reply_date', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;

      // Debug logging for reply tracking
      console.log('🔍 useLiveReplies - Fetched', data?.length || 0, 'leads');
      const repliedLeads = data?.filter(lead => lead.sent_replies) || [];
      console.log('🔍 useLiveReplies - Leads with sent_replies:', repliedLeads.length);
      if (repliedLeads.length > 0) {
        console.log('🔍 First replied lead:', {
          email: repliedLeads[0].lead_email,
          sent_replies: repliedLeads[0].sent_replies,
          isArray: Array.isArray(repliedLeads[0].sent_replies),
          type: typeof repliedLeads[0].sent_replies
        });
      }

      setReplies(data || []);
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
