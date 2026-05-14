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
  generated_reply_text: string | null;
  cc_emails: string[] | null;
}

export type ReplyState = 'none' | 'queued' | 'pending' | 'replied' | 'failed';

export function getReplyState(reply: {
  sent_replies?: SentReplyRow | Array<SentReplyRow>;
  queue_status?: string | null;
}): ReplyState {
  const sr = Array.isArray(reply.sent_replies)
    ? reply.sent_replies[0]
    : reply.sent_replies;
  if (!sr) {
    // No sent_replies row yet — check if an auto-reply is scheduled/in-flight.
    // 'queued' = auto-reply scheduled but not sent yet (card still actionable).
    // 'pending' is reserved for actual in-flight sends (sent_replies exists).
    if (reply.queue_status && ['pending', 'processing', 'review_required'].includes(reply.queue_status)) {
      return 'queued';
    }
    return 'none';
  }
  if (sr.status === 'failed') return 'failed';
  if (sr.verified_at) return 'replied';
  // 'sending' = CAS lock held by send-reply-via-bison mid-flight; treat same as
  // unverified 'sent' — show PENDING, not silence. Reconcile flips it to 'failed'
  // after 5 min if the function crashed before completing.
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
  // Most recent auto_reply_queue status for this lead (if any), used to
  // prevent showing a lead as NEW/uncontacted when a draft is in-flight.
  queue_status?: string | null;
  queue_scheduled_for?: string | null;
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


export function useLiveReplies(workspaceName?: string | null): UseLiveRepliesReturn {
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

      // Load the most recent 5000 interested leads across all workspaces.
      // No date filter — every fresh lead that comes in should always appear.
      // The limit(5000) + order by reply_date DESC ensures the newest leads
      // are always visible without any time-based cutoff excluding recent activity.
      let leadQuery = supabase
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
        .order('reply_date', { ascending: false })
        .limit(5000);

      if (workspaceName) {
        // Workspace selected — filter to just that workspace (no date restriction)
        leadQuery = leadQuery.eq('workspace_name', workspaceName);
      }

      // Fetch leads first so we can scope sent_replies + queue to the time
      // window the dashboard actually shows. This avoids pulling the entire
      // sent_replies table (~4K rows and growing) on every page load.
      const { data, error: fetchError } = await leadQuery;
      if (fetchError) throw fetchError;

      const [{ data: sentRepliesRaw }, { data: conversationStats }, { data: queueRaw }] = await Promise.all([
        // Fetch all sent_replies without a time cutoff — the cutoff was causing
        // leads who replied multiple times over weeks to show as NEW because their
        // old sent_replies row fell outside the window and the lead-level fallback
        // lookup came up empty. The limit(5000) keeps the payload bounded.
        supabase
          .from('sent_replies')
          .select('id, reply_uuid, sent_at, status, sent_by, verified_at, error_message, retry_count, last_retry_at, generated_reply_text, cc_emails, lead_email, workspace_name')
          .order('created_at', { ascending: false })
          .limit(5000) as any,
        // Fetch only leads with reply_count > 1 (threads) — small result set, no URL-length issues.
        supabase
          .from('lead_conversation_stats')
          .select('lead_email, workspace_name, reply_count, first_reply_date, latest_reply_date, replies_last_7_days, conversation_status')
          .gt('reply_count', 1)
          .limit(5000) as any,
        // Fetch the most recent auto_reply_queue row per reply_uuid so we can
        // suppress the NEW badge and treat in-flight drafts as "pending".
        supabase
          .from('auto_reply_queue')
          .select('reply_uuid, status, scheduled_for')
          .in('status', ['pending', 'processing', 'review_required'])
          .order('created_at', { ascending: false }) as any,
      ]);


      // Two lookup maps for sent_replies:
      //   1. by reply_uuid — exact match for single-reply leads
      //   2. by lead_email|workspace_name — catches thread leads where the
      //      sent_replies row belongs to an earlier reply UUID than the card's id.
      //      Without this, a thread card's latest inbound has no sent_replies match
      //      and falls back to queue_status, showing "Sends X min ago" even though
      //      the lead was already replied to.
      // Rows are ordered created_at DESC so the first entry per key is the most recent.
      const sentRepliesMap = new Map<string, SentReplyRow>();
      const sentRepliesByLeadMap = new Map<string, SentReplyRow>();
      ((sentRepliesRaw as any[]) || []).forEach((sr: any) => {
        if (sr.reply_uuid && !sentRepliesMap.has(sr.reply_uuid)) {
          sentRepliesMap.set(sr.reply_uuid, sr as SentReplyRow);
        }
        if (sr.lead_email && sr.workspace_name) {
          const key = `${sr.lead_email}|${sr.workspace_name}`;
          // Keep the most recent non-failed row; failed rows are kept only if
          // there's no successful send for this lead.
          const existing = sentRepliesByLeadMap.get(key);
          if (!existing || (sr.status !== 'failed' && existing.status === 'failed')) {
            sentRepliesByLeadMap.set(key, sr as SentReplyRow);
          }
        }
      });

      const statsMap = new Map<string, any>();
      ((conversationStats as any[]) || []).forEach((stat: any) => {
        statsMap.set(`${stat.lead_email}|${stat.workspace_name}`, stat);
      });

      // Map reply_uuid → most urgent active queue status + scheduled_for
      // (pending > processing > review_required — all treated as in-flight)
      const queueStatusMap = new Map<string, string>();
      const queueScheduledForMap = new Map<string, string>();
      ((queueRaw as any[]) || []).forEach((q: any) => {
        if (q.reply_uuid) {
          queueStatusMap.set(q.reply_uuid, q.status);
          if (q.scheduled_for) queueScheduledForMap.set(q.reply_uuid, q.scheduled_for);
        }
      });

      // Merge everything together
      const repliesWithConversation: LiveReply[] = (data || []).map(reply => {
        const stats = statsMap.get(`${reply.lead_email}|${reply.workspace_name}`);
        // Prefer exact reply_uuid match; fall back to any sent reply for this
        // lead+workspace so thread cards correctly show REPLIED/FAILED instead
        // of falling through to the queue status badge.
        const sentReply = sentRepliesMap.get(reply.id)
          ?? sentRepliesByLeadMap.get(`${reply.lead_email}|${reply.workspace_name}`);
        return {
          ...(reply as any),
          sent_replies: sentReply || undefined,
          queue_status: queueStatusMap.get(reply.id) || null,
          queue_scheduled_for: queueScheduledForMap.get(reply.id) || null,
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
  // Re-run when workspace changes — workspace switch needs a fresh full fetch
  // (different date scope: all-time for a specific workspace, 7-day default).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceName]);

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

  // Reset loaded flag and refetch when workspace changes (different date scope)
  useEffect(() => {
    hasLoadedOnceRef.current = false;
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
            const row = payload.new as any;
            // Refetch on: verified (replied), failed, or sending (shows PENDING immediately
            // without relying on the optimistic patch, which only fires on manual sends).
            if (row.verified_at || row.status === 'failed' || row.status === 'sending' || row.status === 'sent') {
              console.log('sent_replies INSERT — refreshing list', row.status);
              fetchRepliesRef.current();
            }
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
            const row = payload.new as any;
            // Refetch on any meaningful status change — verified, failed, or any
            // status transition so the dashboard badge stays accurate.
            if (row.verified_at || row.status === 'failed' || row.status === 'sent' || row.status === 'sending') {
              console.log('sent_replies UPDATE — refreshing list', row.status);
              fetchRepliesRef.current();
            }
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
