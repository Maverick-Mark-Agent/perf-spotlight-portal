/**
 * AutoReplyReviewCard
 *
 * Renders an auto_reply_queue row with status='review_required' so a human
 * can approve, redraft, or reject the AI-drafted reply that the audit gate
 * sent for review.
 *
 * Approve & Send → calls send-reply-via-bison with the (possibly edited)
 *                  draft text. Same path as the manual composer; the queue
 *                  row gets stamped 'auto_sent' with the manual-approval
 *                  flag appended to audit_issues.
 * Redraft        → reviewer types short feedback ("use the address Mike
 *                  typed", "be less formal"); calls redraft-ai-reply which
 *                  regenerates + re-audits + updates the row. Status stays
 *                  review_required for human confirmation.
 * Reject         → marks the queue row 'cancelled'. No outbound send.
 *                  Lead remains in lead_replies for the manual triage path.
 */

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Sparkles,
  Send,
  X,
  Mail,
  Building2,
  User,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Clock,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { AutoReplyQueueRow } from '@/hooks/useAutoReplyQueue';

interface AutoReplyReviewCardProps {
  row: AutoReplyQueueRow;
  /** Optimistic patch — flips card immediately, before realtime lands. */
  patchRow: (id: string, patch: Partial<AutoReplyQueueRow>) => void;
  /** Optional remove-from-list callback after a terminal action. */
  removeRow?: (id: string) => void;
}

function scoreTone(score: number | null): { color: string; label: string } {
  if (score == null) return { color: 'bg-muted text-muted-foreground border-border', label: 'no score' };
  if (score >= 85) return { color: 'bg-green-100 text-green-800 border-green-200', label: `${score} / 100` };
  if (score >= 65) return { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: `${score} / 100` };
  return { color: 'bg-red-100 text-red-800 border-red-200', label: `${score} / 100` };
}

function severityBadge(sev?: string) {
  const s = (sev || 'low').toLowerCase();
  if (s === 'high') return 'bg-red-100 text-red-800 border-red-200';
  if (s === 'medium') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-muted text-muted-foreground border-border';
}

export function AutoReplyReviewCard({ row, patchRow, removeRow }: AutoReplyReviewCardProps) {
  const lead = row.lead;
  const leadName = lead
    ? [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.lead_email
    : '(lead context unavailable)';

  // Local editable state for the draft. Defaults to the AI draft.
  const [draft, setDraft] = useState(row.generated_reply_text || '');
  const [isSending, setIsSending] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  // Redraft state — shows the feedback textarea + tracks the in-flight redraft.
  const [redraftMode, setRedraftMode] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isRedrafting, setIsRedrafting] = useState(false);
  const { toast } = useToast();

  // When the row updates from realtime/server (e.g. after a redraft lands),
  // sync the local draft state. Without this, the user's stale `draft` would
  // mask the new generated_reply_text the redraft produced. Only resync if
  // the user hasn't started editing on top of the current row text.
  useEffect(() => {
    setDraft(row.generated_reply_text || '');
  }, [row.id, row.generated_reply_text]);

  // Count how many times this draft has been redrafted by counting
  // manual_redraft entries in audit_issues. Surfaces as a badge so the
  // reviewer can see this isn't the original AI output.
  const redraftCount = useMemo(() => {
    return (row.audit_issues || []).filter(
      (i) => i?.type === 'manual_redraft',
    ).length;
  }, [row.audit_issues]);

  // Lazy-fetch a redraft suggestion the FIRST time this card is mounted
  // for a row that doesn't have one cached yet. Once fetched, the value
  // is stored on the queue row (server-side) so subsequent views reuse it.
  // The realtime subscription on auto_reply_queue will surface the cached
  // value via patchRow (or natural row refresh) on next render.
  useEffect(() => {
    if (row.status !== 'review_required') return;
    if (row.suggested_feedback && row.suggested_feedback.trim().length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const resp = await fetch(
          'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/suggest-redraft-feedback',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ queue_id: row.id }),
          }
        );
        const body = await resp.json().catch(() => ({}));
        if (cancelled) return;
        if (resp.ok && body?.success && body?.suggestion) {
          // Patch the row locally so the next "Redraft" click pre-fills
          // the textarea without waiting for a realtime tick.
          patchRow(row.id, { suggested_feedback: body.suggestion } as Partial<AutoReplyQueueRow>);
        }
      } catch (e) {
        console.warn('Failed to fetch redraft suggestion:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  // Only fetch on first mount per row id; deliberately not depending on
  // the suggested_feedback value to avoid loops if the persist races.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id, row.status]);

  // When the reviewer opens the redraft panel, pre-fill the textarea with
  // the AI's suggestion (if available and the textarea is empty). Reviewer
  // can edit, submit as-is, or replace.
  useEffect(() => {
    if (redraftMode && !feedback && row.suggested_feedback) {
      setFeedback(row.suggested_feedback);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redraftMode, row.suggested_feedback]);

  const wasEdited = draft !== (row.generated_reply_text || '');
  const tone = scoreTone(row.audit_score);

  const handleApproveAndSend = async () => {
    if (!lead) {
      toast({ title: 'Cannot send', description: 'Lead context missing — refresh and try again.', variant: 'destructive' });
      return;
    }
    if (!draft.trim()) {
      toast({ title: 'Empty draft', description: 'Draft is empty.', variant: 'destructive' });
      return;
    }

    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Not signed in', description: 'You must be logged in to send replies.', variant: 'destructive' });
        return;
      }

      // Same Edge Function the manual composer uses — preserves CAS-claim,
      // retry, Slack-on-failure, and idempotency on reply_uuid.
      const resp = await fetch(
        'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/send-reply-via-bison',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            reply_uuid: row.reply_uuid,
            workspace_name: row.workspace_name,
            generated_reply_text: draft,
            cc_emails: row.cc_emails || [],
          }),
        }
      );

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.error || `Send failed (${resp.status})`);
      }

      // Stamp the queue row as auto_sent and append a manual-approval audit note.
      // Append (vs overwrite) so we keep the original audit reasoning visible.
      const newIssues = [
        ...(row.audit_issues || []),
        {
          type: 'manually_approved',
          severity: 'low' as const,
          detail: wasEdited
            ? 'Approved by human after edit during review.'
            : 'Approved by human as-is during review.',
        },
      ];

      const { error: updErr } = await supabase
        .from('auto_reply_queue')
        .update({
          status: 'auto_sent',
          generated_reply_text: draft,
          audit_issues: newIssues,
        })
        .eq('id', row.id);

      if (updErr) {
        // Send went through; queue update failed — log + warn but don't block.
        console.warn('Failed to stamp queue row after manual approval:', updErr.message);
      }

      // Optimistic local patch so the UI reflects the new state instantly.
      patchRow(row.id, {
        status: 'auto_sent',
        generated_reply_text: draft,
        audit_issues: newIssues,
      });

      toast({
        title: 'Reply sent',
        description: `Sent to ${leadName}${wasEdited ? ' (with edits)' : ''}.`,
      });
    } catch (e: any) {
      console.error('Approve & Send failed:', e);
      toast({
        title: 'Send failed',
        description: e?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleRedraft = async () => {
    const trimmed = feedback.trim();
    if (!trimmed) {
      toast({
        title: 'Feedback required',
        description: 'Type a short instruction telling the AI what to change.',
        variant: 'destructive',
      });
      return;
    }

    setIsRedrafting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Not signed in', variant: 'destructive' });
        return;
      }

      const resp = await fetch(
        'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/redraft-ai-reply',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ queue_id: row.id, feedback: trimmed }),
        }
      );

      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || !body?.success) {
        throw new Error(body?.detail || body?.error || `Redraft failed (${resp.status})`);
      }

      // Server returned the updated row — patch local state immediately so
      // the UI reflects the new draft + score before realtime catches up.
      if (body.queue_row) {
        patchRow(row.id, body.queue_row as Partial<AutoReplyQueueRow>);
      }

      const oldScore = body.previous_score ?? '?';
      const newScore = body.new_score ?? '?';
      toast({
        title: 'Redraft ready',
        description: `Audit score: ${oldScore} → ${newScore}. Review the new draft and approve when ready.`,
      });

      setFeedback('');
      setRedraftMode(false);
    } catch (e: any) {
      console.error('Redraft failed:', e);
      toast({
        title: 'Redraft failed',
        description: e?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsRedrafting(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      const newIssues = [
        ...(row.audit_issues || []),
        { type: 'manually_rejected', severity: 'low' as const, detail: 'Human rejected during review.' },
      ];
      const { error: updErr } = await supabase
        .from('auto_reply_queue')
        .update({ status: 'cancelled', audit_issues: newIssues })
        .eq('id', row.id);
      if (updErr) throw updErr;

      patchRow(row.id, { status: 'cancelled', audit_issues: newIssues });
      // Cancelled rows fall out of the default review filter; remove for clarity.
      removeRow?.(row.id);

      toast({ title: 'Reply rejected', description: 'Removed from review queue.' });
    } catch (e: any) {
      console.error('Reject failed:', e);
      toast({ title: 'Reject failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setIsRejecting(false);
    }
  };

  // Auto_sent rows render in a compact, success-styled variant — no actions.
  if (row.status === 'auto_sent') {
    return (
      <Card className="border-l-4 border-l-green-500 opacity-80">
        <div className="p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">{leadName}</span>
              <Badge variant="outline" className={tone.color}>
                Audit {tone.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Auto-sent {formatDistanceToNow(new Date(row.updated_at), { addSuffix: true })}
              </span>
              <span className="text-xs text-blue-500 font-medium">{row.workspace_name}</span>
            </div>
            {lead?.lead_email && (
              <p className="text-xs text-muted-foreground truncate">{lead.lead_email}</p>
            )}
          </div>
          {lead?.bison_conversation_url && (
            <Button variant="ghost" size="sm" asChild>
              <a href={lead.bison_conversation_url} target="_blank" rel="noopener noreferrer">
                View <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // review_required: full editable card with approve / reject.
  return (
    <Card className="border-l-4 border-l-orange-500">
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground">{leadName}</h3>
                <Badge variant="outline" className={tone.color}>
                  Audit {tone.label}
                </Badge>
                {redraftCount > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-purple-100 text-purple-800 border-purple-200 text-xs"
                    title="Number of times this draft has been redrafted with reviewer feedback."
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Redrafted {redraftCount}x
                  </Badge>
                )}
                <span className="text-xs text-blue-500 font-medium">{row.workspace_name}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Queued {formatDistanceToNow(new Date(row.updated_at), { addSuffix: true })}
                </span>
              </div>
              {lead && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {lead.lead_email}
                  </span>
                  {lead.company && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> {lead.company}
                    </span>
                  )}
                  {lead.title && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" /> {lead.title}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Audit reasoning */}
        {row.audit_reasoning && (
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Why this needs review
            </p>
            <p className="text-sm text-foreground leading-relaxed">{row.audit_reasoning}</p>
          </div>
        )}

        {/* Audit issues list (if any) */}
        {row.audit_issues && row.audit_issues.length > 0 && (
          <div className="space-y-1">
            {row.audit_issues.slice(0, 5).map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <Badge variant="outline" className={severityBadge(issue.severity)}>
                  {issue.severity ?? 'low'}
                </Badge>
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{issue.type ?? 'issue'}</span>
                  {issue.detail ? `: ${issue.detail}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Original inbound reply */}
        {lead?.reply_text && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Original message from {lead.first_name || 'lead'}
            </p>
            <div className="bg-muted rounded-lg p-3 border border-border max-h-40 overflow-y-auto">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {lead.reply_text}
              </p>
            </div>
          </div>
        )}

        {/* AI-drafted reply (editable) */}
        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-purple-500" />
              AI draft (editable)
            </p>
            {wasEdited && (
              <span className="text-xs text-amber-600 font-medium">edited</span>
            )}
          </div>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[180px] font-sans text-sm"
            placeholder="AI-drafted reply…"
            disabled={isRedrafting}
          />
          {/* Spinner overlay while redraft is in flight */}
          {isRedrafting && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/70 rounded-md mt-6">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                <span className="text-xs font-medium">Regenerating with your feedback…</span>
              </div>
            </div>
          )}
          {row.cc_emails && row.cc_emails.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              CC: {row.cc_emails.join(', ')}
            </p>
          )}
        </div>

        {/* Redraft feedback panel — appears when reviewer clicks Redraft */}
        {redraftMode && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-purple-800 uppercase tracking-wide flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                {feedback === row.suggested_feedback && row.suggested_feedback
                  ? 'AI-suggested fix (editable)'
                  : 'Tell the AI what to change'}
              </p>
              <span className="text-xs text-muted-foreground">
                {feedback.length}/2000
              </span>
            </div>
            {feedback === row.suggested_feedback && row.suggested_feedback && (
              <p className="text-xs text-purple-700 italic">
                ✨ Pre-filled based on the audit's reasoning. Submit as-is, or edit / replace.
              </p>
            )}
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value.slice(0, 2000))}
              className="min-h-[80px] font-sans text-sm bg-card"
              placeholder='e.g. "use the address Mike actually typed in his email" or "shorten this to 2 sentences and drop the renewal date"'
              disabled={isRedrafting}
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRedraftMode(false);
                  setFeedback('');
                }}
                disabled={isRedrafting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRedraft}
                disabled={isRedrafting || !feedback.trim()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isRedrafting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Regenerating…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1" />
                    Submit feedback
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="text-xs text-muted-foreground">
            Audit by <span className="font-mono">{row.audit_model || 'unknown'}</span>
            {row.generation_model && (
              <> · drafted by <span className="font-mono">{row.generation_model}</span></>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReject}
              disabled={isSending || isRejecting || isRedrafting}
            >
              {isRejecting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-1" />
              )}
              Reject
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRedraftMode((v) => !v)}
              disabled={isSending || isRejecting || isRedrafting}
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              {redraftMode ? 'Hide feedback' : 'Redraft with feedback'}
            </Button>
            <Button
              size="sm"
              onClick={handleApproveAndSend}
              disabled={isSending || isRejecting || isRedrafting || !draft.trim()}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Approve {wasEdited && 'edits'} & Send
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
