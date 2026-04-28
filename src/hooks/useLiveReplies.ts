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
  patchReplyAfterSend: (replyUuid: string, sentReply: SentReplyRow) => void;
}

export function useLiveReplies(): UseLiveRepliesReturn {
  const [replies, setReplies] = useState<LiveReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newReplyCount, setNewReplyCount] = useState(0);
  // Ref so the sent_replies realtime handler can call the latest fetchReplies
  const fetchRepliesRef = useRef<() => void>(() => {});
  // Track whether the initial load has completed — refetches don't flash
  // the loading spinner; only the very first fetch does.
  const hasLoadedOnceRef = useRef(false);

  const fetchReplies = useCallback(async () => {
    try {
      // Only show loading screen on initial load. Refetches happen in
      // the background so the dashboard doesn't blink to a spinner every
      // time a sent_replies INSERT/UPDATE fires.
      if (!hasLoadedOnceRef.current) {
        setLoading(true);
      }
      setError(null);

      // Load replies from the last 7 days — two separate fast queries then merged in JS
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);

      const [{ data, error: fetchError }, { data: sentRepliesRaw }, { data: conversationStats }] = await Promise.all([
        supabase
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
            created_at
          `)
          .eq('is_interested', true)
          .gte('reply_date', cutoff.toISOString())
          .order('reply_date', { ascending: false })
          .limit(5000),
        supabase
          .from('sent_replies')
          .select('id, reply_uuid, sent_at, status, sent_by, verified_at, error_message, retry_count, last_retry_at') as any,
        supabase
          .from('lead_conversation_stats')
          .select('lead_email, workspace_name, reply_count, first_reply_date, latest_reply_date, replies_last_7_days, conversation_status') as any,
      ]);

      if (fetchError) throw fetchError;

      // Build lookup maps
      const sentRepliesMap = new Map<string, SentReplyRow>();
      ((sentRepliesRaw as any[]) || []).forEach((sr: any) => {
        if (sr.reply_uuid) sentRepliesMap.set(sr.reply_uuid, sr as SentReplyRow);
      });

      const statsMap = new Map<string, any>();
      ((conversationStats as any[]) || []).forEach((stat: any) => {
        statsMap.set(`${stat.lead_email}|${stat.workspace_name}`, stat);
      });

      // Merge everything together
      const repliesWithConversation: LiveReply[] = (data || []).map(reply => {
        const stats = statsMap.get(`${reply.lead_email}|${reply.workspace_name}`);
        return {
          ...(reply as any),
          sent_replies: sentRepliesMap.get(reply.id) || undefined,
          conversation_reply_count: stats?.reply_count || 1,
          conversation_first_reply_date: stats?.first_reply_date || null,
          conversation_latest_reply_date: stats?.latest_reply_date || null,
          conversation_replies_last_7_days: stats?.replies_last_7_days || 1,
          conversation_status: stats?.conversation_status || 'single_reply',
        };
      });

      console.log('🔍 useLiveReplies - Fetched', repliesWithConversation.length, 'leads');

      setReplies(repliesWithConversation);
      hasLoadedOnceRef.current = true;
    } catch (err) {
      console.error('Error fetching replies:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch replies');
    } finally {
      setLoading(false);
    }
  }, []);

  // Optimistic patch: applied locally when the user clicks Send so the card
  // flips to PENDING immediately, without waiting for realtime or refetch.
  // The matching reply in state gets a placeholder sent_replies row with
  // status='sent' and verified_at=null. A subsequent refetch (or realtime
  // event) will replace this with the canonical row.
  const patchReplyAfterSend = useCallback((replyUuid: string, sentReply: SentReplyRow) => {
    setReplies((current) =>
      current.map((r) => (r.id === replyUuid ? { ...r, sent_replies: sentReply } : r))
    );
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

            // Only show interested leads on this board.
            // If the webhook hasn't flipped is_interested yet, skip — the
            // subsequent UPDATE event (or a refetch) will add it then.
            if (!newReply.is_interested) return;

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
            event: 'UPDATE',
            schema: 'public',
            table: 'lead_replies',
          },
          (payload) => {
            const updated = payload.new as LiveReply;
            // When is_interested flips to true, add this lead to the board
            // (the INSERT event may have been skipped since it wasn't interested yet).
            if (updated.is_interested) {
              setReplies((current) => {
                const exists = current.some((r) => r.id === updated.id);
                if (exists) {
                  // Merge in updated fields (e.g. is_interested just flipped)
                  return current.map((r) => r.id === updated.id ? { ...r, ...updated } : r);
                }
                // New to the board — insert at top
                return [updated, ...current];
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
    patchReplyAfterSend,
  };
}
