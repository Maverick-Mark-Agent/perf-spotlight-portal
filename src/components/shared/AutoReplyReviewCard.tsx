/**
 * AutoReplyReviewCard
 *
 * Renders an auto_reply_queue row with status='review_required' so a human
 * can approve, edit, or reject the AI-drafted reply that the audit gate
 * sent for review.
 *
 * Approve & Send → calls send-reply-via-bison with the (possibly edited)
 *                  draft text. Same path as the manual composer; the queue
 *                  row gets stamped 'auto_sent' with the manual-approval
 *                  flag appended to audit_issues.
 * Reject         → marks the queue row 'cancelled'. No outbound send.
 *                  Lead remains in lead_replies for the manual triage path.
 */

import { useState } from 'react';
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
  const { toast } = useToast();

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
        <div>
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
          />
          {row.cc_emails && row.cc_emails.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              CC: {row.cc_emails.join(', ')}
            </p>
          )}
        </div>

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
              disabled={isSending || isRejecting}
            >
              {isRejecting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-1" />
              )}
              Reject
            </Button>
            <Button
              size="sm"
              onClick={handleApproveAndSend}
              disabled={isSending || isRejecting || !draft.trim()}
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
