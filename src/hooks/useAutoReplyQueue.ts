import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type AutoReplyQueueStatus =
  | 'pending'
  | 'processing'
  | 'review_required'
  | 'auto_sent'
  | 'failed'
  | 'cancelled';

export type AutoReplyVerdict = 'auto_send' | 'review' | 'reject';

export interface AutoReplyAuditIssue {
  type?: string;
  severity?: 'low' | 'medium' | 'high';
  detail?: string;
}

// Joined lead context the review card needs to render without a second
// fetch. Comes from the auto_reply_queue → lead_replies FK.
export interface AutoReplyQueueLeadContext {
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
  bison_conversation_url: string | null;
  bison_reply_numeric_id: number | null;
}

export interface AutoReplyQueueRow {
  id: string;
  reply_uuid: string;
  workspace_name: string;
  status: AutoReplyQueueStatus;
  scheduled_for: string;
  attempts: number;
  last_attempt_at: string | null;

  generated_reply_text: string | null;
  cc_emails: string[] | null;
  audit_score: number | null;
  audit_verdict: AutoReplyVerdict | null;
  audit_reasoning: string | null;
  audit_issues: AutoReplyAuditIssue[] | null;
  audit_model: string | null;
  generation_model: string | null;

  sent_reply_id: number | null;
  error_message: string | null;
  // AI-generated actionable redraft suggestion. Pre-fills the redraft
  // textarea so reviewers can one-click submit instead of typing feedback.
  // null until first generated; cleared when a redraft replaces the draft.
  suggested_feedback: string | null;
  created_at: string;
  updated_at: string;

  // joined from lead_replies
  lead: AutoReplyQueueLeadContext | null;
}

interface UseAutoReplyQueueOptions {
  // Limit to specific statuses. Defaults to ['review_required', 'auto_sent'].
  statuses?: AutoReplyQueueStatus[];
  // If set, restrict to one workspace (matches LiveRepliesBoard's filter).
  workspaceName?: string | null;
  // Cap returned rows. Default 200.
  limit?: number;
}

interface UseAutoReplyQueueReturn {
  rows: AutoReplyQueueRow[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  // Optimistic local mutators so the UI flips instantly when an action button
  // is clicked, without waiting for realtime.
  patchRow: (id: string, patch: Partial<AutoReplyQueueRow>) => void;
  removeRow: (id: string) => void;
}

const DEFAULT_STATUSES: AutoReplyQueueStatus[] = ['review_required', 'auto_sent'];

export function useAutoReplyQueue(opts: UseAutoReplyQueueOptions = {}): UseAutoReplyQueueReturn {
  const { statuses = DEFAULT_STATUSES, workspaceName = null, limit = 200 } = opts;

  const [rows, setRows] = useState<AutoReplyQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef<() => void>(() => {});
  const hasLoadedOnceRef = useRef(false);

  const fetch = useCallback(async () => {
    try {
      if (!hasLoadedOnceRef.current) setLoading(true);
      setError(null);

      let query = supabase
        .from('auto_reply_queue')
        .select(`
          id,
          reply_uuid,
          workspace_name,
          status,
          scheduled_for,
          attempts,
          last_attempt_at,
          generated_reply_text,
          cc_emails,
          audit_score,
          audit_verdict,
          audit_reasoning,
          audit_issues,
          audit_model,
          generation_model,
          sent_reply_id,
          error_message,
          suggested_feedback,
          created_at,
          updated_at,
          lead:lead_replies!auto_reply_queue_reply_uuid_fkey (
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
            bison_conversation_url,
            bison_reply_numeric_id
          ),
          sent_reply:sent_replies!sent_replies_reply_uuid_fkey (
            id,
            verified_at,
            status
          )
        `)
        .in('status', statuses)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (workspaceName) {
        query = query.eq('workspace_name', workspaceName);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      // PostgREST returns the joined row as an object for one-to-one (UNIQUE FK)
      // or as an array. Normalize to a single object since reply_uuid is UNIQUE.
      // Also filter out any review_required rows where a reply was already sent
      // and verified in Bison — those should not appear as "Awaiting Review".
      const normalized: AutoReplyQueueRow[] = (data || [])
        .filter((r: any) => {
          const sr = Array.isArray(r.sent_reply) ? r.sent_reply[0] : r.sent_reply;
          if (!sr) return true;
          // If a verified reply exists, this lead is already handled — drop it
          // from the review queue regardless of the queue row's status.
          return !sr.verified_at;
        })
        .map((r: any) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { sent_reply, ...rest } = r;
          return {
            ...rest,
            lead: Array.isArray(r.lead) ? r.lead[0] ?? null : r.lead ?? null,
          };
        });

      setRows(normalized);
      hasLoadedOnceRef.current = true;
    } catch (err) {
      console.error('Error fetching auto_reply_queue:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch queue');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(statuses), workspaceName, limit]);

  // Keep ref fresh so realtime handlers always call the latest fetcher.
  useEffect(() => {
    fetchRef.current = fetch;
  }, [fetch]);

  // Initial load.
  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime: any INSERT/UPDATE on auto_reply_queue refetches.
  // Listening narrowly to the table is simpler and safer than maintaining
  // a delta-merge that has to know our filter logic.
  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    channel = supabase
      .channel('auto-reply-queue-board')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auto_reply_queue' },
        (_payload) => {
          fetchRef.current();
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const patchRow = useCallback((id: string, patch: Partial<AutoReplyQueueRow>) => {
    setRows((current) => current.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((current) => current.filter((r) => r.id !== id));
  }, []);

  return { rows, loading, error, refresh: fetch, patchRow, removeRow };
}
