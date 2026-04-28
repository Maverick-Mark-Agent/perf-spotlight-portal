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
  // Count of auto_sent rows updated today (NOT filtered by verification — includes
  // rows already removed from `rows` because the lead has a verified sent_replies row).
  autoSentTodayCount: number;
}

const DEFAULT_STATUSES: AutoReplyQueueStatus[] = ['review_required', 'auto_sent'];

export function useAutoReplyQueue(opts: UseAutoReplyQueueOptions = {}): UseAutoReplyQueueReturn {
  const { statuses = DEFAULT_STATUSES, workspaceName = null, limit = 200 } = opts;

  const [rows, setRows] = useState<AutoReplyQueueRow[]>([]);
  const [autoSentTodayCount, setAutoSentTodayCount] = useState(0);
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

      // For each queue row, check if the reply_uuid already has a verified
      // sent_replies row — if so, filter it out (already handled).
      // Fetch only the reply_uuids we actually need rather than all verified rows.
      const replyUuids = (data || []).map((r: any) => r.reply_uuid).filter(Boolean);

      let verifiedUuids = new Set<string>();
      if (replyUuids.length > 0) {
        const { data: sentRepliesRaw } = await supabase
          .from('sent_replies')
          .select('reply_uuid')
          .in('reply_uuid', replyUuids)
          .not('verified_at', 'is', null) as any;
        ((sentRepliesRaw as any[]) || []).forEach((sr: any) => {
          if (sr.reply_uuid) verifiedUuids.add(sr.reply_uuid);
        });
      }

      // Normalize lead join and filter out already-replied leads
      const normalized: AutoReplyQueueRow[] = (data || [])
        .filter((r: any) => !verifiedUuids.has(r.reply_uuid))
        .map((r: any) => ({
          ...r,
          lead: Array.isArray(r.lead) ? r.lead[0] ?? null : r.lead ?? null,
        }));

      // Auto-sent today: count from raw (unfiltered) data using local midnight
      // so the counter reflects the viewer's timezone, not UTC day boundary.
      const todayStartMs = new Date().setHours(0, 0, 0, 0);
      const rawAutoSentToday = (data || []).filter(
        (r: any) => r.status === 'auto_sent' && new Date(r.updated_at).getTime() >= todayStartMs
      ).length;
      setAutoSentTodayCount(rawAutoSentToday);

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

  // Realtime: refetch on auto_reply_queue changes AND when a sent_replies row
  // gets verified — that's the signal a review_required lead was replied to
  // and should disappear from the Awaiting Review section.
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
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sent_replies' },
        (payload) => {
          const row = payload.new as any;
          if (row.verified_at) fetchRef.current();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sent_replies' },
        (payload) => {
          const row = payload.new as any;
          if (row.verified_at) fetchRef.current();
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

  return { rows, loading, error, refresh: fetch, patchRow, removeRow, autoSentTodayCount };
}
