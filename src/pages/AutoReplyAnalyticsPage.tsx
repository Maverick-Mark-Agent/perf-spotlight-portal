/**
 * Auto-Reply Analytics
 *
 * Observability for the audit gate. Two parts:
 *
 *   1. Pipeline counters (top stat row) — auto_sent / approved / rejected /
 *      pending breakdown for the selected window.
 *   2. Issue-pattern table — per (issue_type, severity), how often the audit
 *      raised it AND what humans did when they got the chance to act.
 *
 * The action-suggestion column is the whole point: it surfaces "you over-flag
 * X 95% of the time" so prompt tuning becomes surgical instead of guesswork.
 *
 * Read-only page. No mutations. Just visibility.
 */

import { useMemo } from 'react';
import {
  useAutoReplyAnalytics,
  type IssuePattern,
  type OverallStat,
  type TerminalState,
  type TimeWindow,
} from '@/hooks/useAutoReplyAnalytics';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bot,
  CheckCircle,
  Eye,
  ThumbsUp,
  Pencil,
  ThumbsDown,
  Ban,
  AlertCircle,
  Clock,
  RefreshCw,
  Loader2,
  TrendingUp,
} from 'lucide-react';

const TERMINAL_STATE_META: Record<
  TerminalState,
  { label: string; tone: 'green' | 'blue' | 'orange' | 'red' | 'muted'; icon: React.ReactNode; help: string }
> = {
  audit_auto_sent: {
    label: 'Audit auto-sent',
    tone: 'green',
    icon: <Bot className="h-4 w-4" />,
    help: 'Audit cleared the draft and the system sent it without human involvement.',
  },
  human_approved_as_is: {
    label: 'Approved as-is',
    tone: 'green',
    icon: <ThumbsUp className="h-4 w-4" />,
    help: 'Audit flagged for review, human clicked Approve without editing.',
  },
  human_approved_with_edits: {
    label: 'Approved after edit',
    tone: 'blue',
    icon: <Pencil className="h-4 w-4" />,
    help: 'Audit flagged for review, human edited the draft and sent.',
  },
  human_rejected: {
    label: 'Human rejected',
    tone: 'red',
    icon: <ThumbsDown className="h-4 w-4" />,
    help: 'Audit flagged for review, human clicked Reject.',
  },
  audit_rejected: {
    label: 'Audit rejected',
    tone: 'red',
    icon: <Ban className="h-4 w-4" />,
    help: 'Audit verdict was reject (score below 65) — never reached a human.',
  },
  system_error: {
    label: 'System error',
    tone: 'red',
    icon: <AlertCircle className="h-4 w-4" />,
    help: 'Generation, audit, or Bison send errored. Not about audit quality.',
  },
  cancelled_other: {
    label: 'Cancelled',
    tone: 'muted',
    icon: <Ban className="h-4 w-4" />,
    help: 'Cancelled outside the standard reject path.',
  },
  pending_review: {
    label: 'Pending review',
    tone: 'orange',
    icon: <Eye className="h-4 w-4" />,
    help: 'In the Awaiting Review queue, waiting on a human.',
  },
  in_progress: {
    label: 'In progress',
    tone: 'muted',
    icon: <Clock className="h-4 w-4" />,
    help: 'Worker has not finished processing yet.',
  },
};

const TONE_CLASSES: Record<'green' | 'blue' | 'orange' | 'red' | 'muted', string> = {
  green: 'border-l-green-500',
  blue: 'border-l-blue-500',
  orange: 'border-l-orange-500',
  red: 'border-l-red-500',
  muted: 'border-l-muted-foreground/30',
};

export default function AutoReplyAnalyticsPage() {
  const { overall, patterns, loading, error, window, setWindow, refresh } = useAutoReplyAnalytics('30d');

  // Build a complete map of states (zero-fill missing ones for stable layout).
  const overallMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of overall) m[o.terminal_state] = o.count;
    return m;
  }, [overall]);

  const total = useMemo(
    () => overall.reduce((sum, o) => sum + Number(o.count || 0), 0),
    [overall]
  );

  // Headline auto-send rate: (audit_auto_sent + both human-approved categories) / total terminal
  // Excludes pending/in_progress from the denominator so the rate reflects actual outcomes.
  const headlineRate = useMemo(() => {
    const terminalCount =
      (overallMap.audit_auto_sent || 0) +
      (overallMap.human_approved_as_is || 0) +
      (overallMap.human_approved_with_edits || 0) +
      (overallMap.human_rejected || 0) +
      (overallMap.audit_rejected || 0) +
      (overallMap.system_error || 0) +
      (overallMap.cancelled_other || 0);
    if (terminalCount === 0) return null;
    const sent =
      (overallMap.audit_auto_sent || 0) +
      (overallMap.human_approved_as_is || 0) +
      (overallMap.human_approved_with_edits || 0);
    return Math.round((sent / terminalCount) * 1000) / 10;
  }, [overallMap]);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <TrendingUp className="h-7 w-7 text-purple-600" />
              <h1 className="text-2xl font-semibold text-foreground">Auto-Reply Analytics</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              How the audit gate is performing. Use the issue-pattern table to spot over-flagging
              and inform prompt tuning.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <WindowToggle value={window} onChange={setWindow} />
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <Card>
            <CardContent className="p-4 text-sm text-red-600">Error: {error}</CardContent>
          </Card>
        )}

        {/* Headline */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Total processed
                </p>
                <p className="text-3xl font-bold text-foreground mt-1">{total.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {window === '7d' ? 'last 7 days' : window === '30d' ? 'last 30 days' : 'all time'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Send rate (auto + human-approved)
                </p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {headlineRate == null ? '—' : `${headlineRate}%`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  of terminal-status drafts went out
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Awaiting review
                </p>
                <p className="text-3xl font-bold text-orange-600 mt-1">
                  {overallMap.pending_review || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">currently in queue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline state breakdown */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Pipeline breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {(
              [
                'audit_auto_sent',
                'human_approved_as_is',
                'human_approved_with_edits',
                'pending_review',
                'human_rejected',
                'audit_rejected',
                'system_error',
                'cancelled_other',
                'in_progress',
              ] as TerminalState[]
            ).map((state) => {
              const meta = TERMINAL_STATE_META[state];
              const count = overallMap[state] || 0;
              if (count === 0 && state !== 'pending_review' && state !== 'audit_auto_sent') {
                return null;
              }
              return (
                <Card key={state} className={`border-l-4 ${TONE_CLASSES[meta.tone]}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        {meta.label}
                      </span>
                      <span className={`text-${meta.tone}-500`}>{meta.icon}</span>
                    </div>
                    <div className="text-2xl font-bold text-foreground mt-1">{count}</div>
                    <p className="text-xs text-muted-foreground mt-1 leading-tight">{meta.help}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Issue patterns table */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Audit issue patterns</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Each row is one issue type the audit raises. The "human approval rate" answers:
            when the audit pushed this to review, how often did a human approve anyway?
            High rates → audit is over-flagging this type → prompt-tuning candidate.
          </p>
          <PatternsTable patterns={patterns} loading={loading} />
        </div>
      </div>
    </div>
  );
}

function WindowToggle({ value, onChange }: { value: TimeWindow; onChange: (w: TimeWindow) => void }) {
  const opts: { v: TimeWindow; label: string }[] = [
    { v: '7d', label: '7 days' },
    { v: '30d', label: '30 days' },
    { v: 'all', label: 'All time' },
  ];
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            value === o.v
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-foreground hover:bg-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface PatternsTableProps {
  patterns: IssuePattern[];
  loading: boolean;
}

function PatternsTable({ patterns, loading }: PatternsTableProps) {
  if (loading && patterns.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading patterns…
        </CardContent>
      </Card>
    );
  }

  if (patterns.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>No audit issues recorded in this window yet.</p>
          <p className="text-xs mt-2">Patterns appear here once the worker has processed inbound interested replies.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">Issue type</th>
              <th className="px-4 py-2 font-medium">Severity</th>
              <th className="px-4 py-2 font-medium text-right">Flagged</th>
              <th className="px-4 py-2 font-medium text-right" title="Audit cleared, no human involvement">Auto-sent</th>
              <th className="px-4 py-2 font-medium text-right" title="Human approved without editing">As-is</th>
              <th className="px-4 py-2 font-medium text-right" title="Human edited then sent">Edited</th>
              <th className="px-4 py-2 font-medium text-right" title="Human rejected">Rejected</th>
              <th className="px-4 py-2 font-medium text-right" title="Score below 65 → never reached a human">Audit-killed</th>
              <th className="px-4 py-2 font-medium text-right">Approval rate</th>
              <th className="px-4 py-2 font-medium">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {patterns.map((p, i) => (
              <PatternRow key={`${p.issue_type}-${p.severity}-${i}`} pattern={p} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PatternRow({ pattern: p }: { pattern: IssuePattern }) {
  const sev = (p.severity || 'low').toLowerCase();
  const sevClass =
    sev === 'high'
      ? 'bg-red-100 text-red-800 border-red-200'
      : sev === 'medium'
      ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
      : 'bg-muted text-muted-foreground border-border';

  // Verdict heuristic:
  // - Approval rate >=85% with N>=10 human actions → "over-flagging, candidate to drop"
  // - Approval rate 50-84% → "mixed signal, watch"
  // - Approval rate <50% → "audit is correct, keep"
  // - Insufficient data → "not enough data yet"
  const humanActions =
    p.human_approved_as_is + p.human_approved_with_edits + p.human_rejected;

  const verdict = (() => {
    if (humanActions < 5) return { label: 'not enough data', cls: 'bg-muted text-muted-foreground border-border' };
    const rate = p.human_approval_rate ?? 0;
    if (rate >= 85) return { label: 'OVER-FLAGGING — relax', cls: 'bg-orange-100 text-orange-800 border-orange-200' };
    if (rate >= 50) return { label: 'mixed — watch', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    return { label: 'audit is right — keep', cls: 'bg-green-100 text-green-800 border-green-200' };
  })();

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-2 font-mono text-xs">{p.issue_type}</td>
      <td className="px-4 py-2">
        <Badge variant="outline" className={sevClass}>
          {sev}
        </Badge>
      </td>
      <td className="px-4 py-2 text-right font-medium">{p.times_flagged}</td>
      <td className="px-4 py-2 text-right">{p.audit_auto_sent}</td>
      <td className="px-4 py-2 text-right text-green-600 font-medium">{p.human_approved_as_is}</td>
      <td className="px-4 py-2 text-right text-blue-600">{p.human_approved_with_edits}</td>
      <td className="px-4 py-2 text-right text-red-600">{p.human_rejected}</td>
      <td className="px-4 py-2 text-right text-muted-foreground">{p.audit_rejected}</td>
      <td className="px-4 py-2 text-right font-medium">
        {p.human_approval_rate == null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span>{p.human_approval_rate}%</span>
        )}
      </td>
      <td className="px-4 py-2">
        <Badge variant="outline" className={`${verdict.cls} text-xs`}>
          {verdict.label}
        </Badge>
      </td>
    </tr>
  );
}
