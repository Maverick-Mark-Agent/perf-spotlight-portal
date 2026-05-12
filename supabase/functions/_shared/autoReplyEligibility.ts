// Auto-reply eligibility predicate.
//
// Called from universal-bison-webhook → handleLeadInterested after the
// inbound reply's sentiment + interest classification is settled. Decides
// whether to enqueue this reply for auto-reply, and if so, when.
//
// Every skip path writes to auto_reply_skip_log so we can debug "why
// didn't this auto-reply?" without spinning up a queue row.

import { computeNextSendTime } from './scheduling.ts';

export interface SupabaseLike {
  // Minimal duck-typed surface — both real Supabase clients and any test
  // double can satisfy this.
  from: (table: string) => any;
}

interface EligibilityInput {
  supabase: SupabaseLike;
  replyUuid: string;
  workspaceName: string;
}

interface SkipResult {
  enqueued: false;
  reason: string;
  detail?: Record<string, unknown>;
}

interface EnqueueResult {
  enqueued: true;
  scheduledFor: Date;
  queueRowId: string;
  forceReview: boolean;
}

export type EligibilityOutcome = SkipResult | EnqueueResult;

async function logSkip(
  supabase: SupabaseLike,
  replyUuid: string,
  workspaceName: string,
  reason: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from('auto_reply_skip_log').insert({
      reply_uuid: replyUuid,
      workspace_name: workspaceName,
      skip_reason: reason,
      skip_detail: detail ?? null,
    });
  } catch (e) {
    // Skip-log failures shouldn't block the webhook — just warn.
    console.warn(`auto_reply_skip_log insert failed: ${(e as Error).message}`);
  }
}

async function enqueueRow(
  supabase: SupabaseLike,
  replyUuid: string,
  workspaceName: string,
  timezone: string,
  minDelayMinutes: number,
  forceReview: boolean,
  skipReason?: string,
): Promise<EligibilityOutcome> {
  const scheduledFor = computeNextSendTime(timezone, minDelayMinutes);

  const { data: inserted, error: insertErr } = await supabase
    .from('auto_reply_queue')
    .insert({
      reply_uuid: replyUuid,
      workspace_name: workspaceName,
      scheduled_for: scheduledFor.toISOString(),
      status: 'pending',
      force_review: forceReview,
    })
    .select('id')
    .maybeSingle();

  if (insertErr) {
    if (insertErr.code === '23505' /* unique_violation */) {
      await logSkip(supabase, replyUuid, workspaceName, 'already_enqueued');
      return { enqueued: false, reason: 'already_enqueued' };
    }
    await logSkip(supabase, replyUuid, workspaceName, 'insert_error', { error: insertErr.message });
    return { enqueued: false, reason: 'insert_error', detail: { error: insertErr.message } };
  }

  if (skipReason) {
    // Record why this was force-reviewed so it's visible in the skip log.
    await logSkip(supabase, replyUuid, workspaceName, `force_review:${skipReason}`);
  }

  return {
    enqueued: true,
    scheduledFor,
    queueRowId: inserted?.id ?? '',
    forceReview,
  };
}

/**
 * Decide whether to enqueue an inbound reply for auto-reply, and if so,
 * insert into auto_reply_queue with a workspace-timezone-aware
 * scheduled_for. Returns the outcome for caller logging.
 *
 * Design: every interested lead always gets a draft generated and lands in
 * "Awaiting Review" (force_review=true) or auto-sends (force_review=false).
 * Only hard stops — no template, already sent, workspace not found — skip
 * the queue entirely. Soft conditions (auto_reply_disabled, low confidence,
 * needs_review flag, no timezone) enqueue with force_review=true so a human
 * always gets to review the draft.
 *
 * Idempotent: safe to call multiple times for the same reply_uuid (the
 * queue's UNIQUE(reply_uuid) constraint catches dupes).
 */
export async function enqueueAutoReplyIfEligible(
  input: EligibilityInput,
): Promise<EligibilityOutcome> {
  const { supabase, replyUuid, workspaceName } = input;

  // ── 1. Load workspace config ──────────────────────────────────────────
  const { data: workspace, error: wsErr } = await supabase
    .from('client_registry')
    .select(`
      auto_reply_enabled,
      timezone,
      auto_reply_min_sentiment_confidence,
      auto_reply_min_delay_minutes
    `)
    .eq('workspace_name', workspaceName)
    .maybeSingle();

  if (wsErr || !workspace) {
    await logSkip(supabase, replyUuid, workspaceName, 'workspace_not_found', { error: wsErr?.message });
    return { enqueued: false, reason: 'workspace_not_found' };
  }

  // ── 2. Load the reply's classification ────────────────────────────────
  const { data: reply, error: replyErr } = await supabase
    .from('lead_replies')
    .select('sentiment, is_interested, confidence_score, needs_review')
    .eq('id', replyUuid)
    .maybeSingle();

  if (replyErr || !reply) {
    await logSkip(supabase, replyUuid, workspaceName, 'reply_not_found', { error: replyErr?.message });
    return { enqueued: false, reason: 'reply_not_found' };
  }

  if (reply.sentiment !== 'positive') {
    await logSkip(supabase, replyUuid, workspaceName, 'sentiment_not_positive', { sentiment: reply.sentiment });
    return { enqueued: false, reason: 'sentiment_not_positive' };
  }

  if (!reply.is_interested) {
    await logSkip(supabase, replyUuid, workspaceName, 'not_interested');
    return { enqueued: false, reason: 'not_interested' };
  }

  // ── 3. Don't double-process replies that are already handled ──────────
  const { data: existingSent } = await supabase
    .from('sent_replies')
    .select('id, status')
    .eq('reply_uuid', replyUuid)
    .maybeSingle();

  if (existingSent) {
    await logSkip(supabase, replyUuid, workspaceName, 'already_in_sent_replies', { status: existingSent.status });
    return { enqueued: false, reason: 'already_in_sent_replies' };
  }

  // ── 4. Template must exist for the worker to generate a reply ─────────
  const { data: template } = await supabase
    .from('reply_templates')
    .select('workspace_name')
    .eq('workspace_name', workspaceName)
    .maybeSingle();

  if (!template) {
    await logSkip(supabase, replyUuid, workspaceName, 'no_template');
    return { enqueued: false, reason: 'no_template' };
  }

  // ── 5. Determine if force_review is needed ────────────────────────────
  // Soft conditions: enqueue with force_review=true so a human reviews the
  // draft before it sends. No lead gets silently dropped.
  const timezone = workspace.timezone || 'America/New_York'; // fallback if null
  const minDelayMinutes: number = workspace.auto_reply_min_delay_minutes ?? 10;

  if (!workspace.auto_reply_enabled) {
    // Workspace has auto-reply off — still generate a draft for review.
    return enqueueRow(supabase, replyUuid, workspaceName, timezone, minDelayMinutes, true, 'auto_reply_disabled');
  }

  if (!workspace.timezone) {
    // No timezone configured — draft it for review with a safe fallback.
    return enqueueRow(supabase, replyUuid, workspaceName, 'America/New_York', minDelayMinutes, true, 'no_timezone');
  }

  if (reply.needs_review === true) {
    return enqueueRow(supabase, replyUuid, workspaceName, timezone, minDelayMinutes, true, 'flagged_needs_review');
  }

  const confidenceFloor = workspace.auto_reply_min_sentiment_confidence ?? 85;
  if ((reply.confidence_score ?? 0) < confidenceFloor) {
    return enqueueRow(supabase, replyUuid, workspaceName, timezone, minDelayMinutes, true, 'low_sentiment_confidence');
  }

  // ── 6. All checks passed — schedule for normal auto-send ─────────────
  return enqueueRow(supabase, replyUuid, workspaceName, timezone, minDelayMinutes, false);
}
