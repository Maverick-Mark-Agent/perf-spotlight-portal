import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type TerminalState =
  | 'audit_auto_sent'
  | 'human_approved_as_is'
  | 'human_approved_with_edits'
  | 'human_rejected'
  | 'audit_rejected'
  | 'system_error'
  | 'cancelled_other'
  | 'pending_review'
  | 'in_progress';

export interface OverallStat {
  terminal_state: TerminalState;
  count: number;
}

export interface IssuePattern {
  issue_type: string;
  severity: 'low' | 'medium' | 'high' | string;
  times_flagged: number;
  audit_auto_sent: number;
  human_approved_as_is: number;
  human_approved_with_edits: number;
  human_rejected: number;
  audit_rejected: number;
  pending_review: number;
  // Null when there's not enough human-action data yet to compute a rate.
  human_approval_rate: number | null;
}

export type TimeWindow = '7d' | '30d' | 'all';

function sinceFor(window: TimeWindow): string | null {
  if (window === 'all') return null;
  const days = window === '7d' ? 7 : 30;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

interface UseAutoReplyAnalyticsReturn {
  overall: OverallStat[];
  patterns: IssuePattern[];
  loading: boolean;
  error: string | null;
  window: TimeWindow;
  setWindow: (w: TimeWindow) => void;
  refresh: () => void;
}

export function useAutoReplyAnalytics(initialWindow: TimeWindow = '30d'): UseAutoReplyAnalyticsReturn {
  const [overall, setOverall] = useState<OverallStat[]>([]);
  const [patterns, setPatterns] = useState<IssuePattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [window, setWindow] = useState<TimeWindow>(initialWindow);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const since = sinceFor(window);

      const [overallRes, patternRes] = await Promise.all([
        supabase.rpc('auto_reply_overall_stats', { p_since: since }),
        supabase.rpc('auto_reply_issue_patterns', { p_since: since }),
      ]);

      if (overallRes.error) throw overallRes.error;
      if (patternRes.error) throw patternRes.error;

      setOverall((overallRes.data ?? []) as OverallStat[]);
      setPatterns((patternRes.data ?? []) as IssuePattern[]);
    } catch (err) {
      console.error('useAutoReplyAnalytics fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [window]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { overall, patterns, loading, error, window, setWindow, refresh: fetch };
}
