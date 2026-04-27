// Auto-reply queue worker — runs every 5 min via pg_cron.
//
// Flow per due row:
//   1. Atomically claim (status pending → processing, attempts++).
//   2. Load reply + template context.
//   3. Generate draft (preview_mode) via generate-ai-reply.
//   4. Audit draft via audit-ai-reply.
//   5. Apply per-workspace audit threshold → final verdict.
//   6. On auto_send: rate-limit check → send-reply-via-bison → status auto_sent.
//      On review:    status review_required + Slack escalation.
//      On reject:    status failed.
//
// Concurrency: multiple cron invocations are safe. The CAS update on
// status='pending' ensures only one worker claims any given row.
//
// Idempotency: send-reply-via-bison's own CAS-on-sent_replies + the queue's
// UNIQUE(reply_uuid) constraint mean repeated processing won't double-send.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { sendAutoReplyEscalation } from '../_shared/slackNotifications.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Optional dashboard origin for the Slack deep-link. Set to e.g.
// https://dashboard.maverick-ins.com once the link target is finalized.
const DASHBOARD_BASE_URL = Deno.env.get('DASHBOARD_BASE_URL') || '';

const MAX_ROWS_PER_RUN = 20;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

interface RunStats {
  candidates: number;
  claimed: number;
  auto_sent: number;
  review_required: number;
  failed: number;
  rate_limited: number;
  skipped: number;
  errors: number;
  details: Array<Record<string, unknown>>;
}

async function callEdgeFunction<T = unknown>(name: string, body: unknown): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'x-triggered-by': 'auto-reply-worker',
      },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    let parsed: T | null = null;
    try { parsed = text ? JSON.parse(text) : null; } catch (_) { parsed = null; }
    if (!r.ok) {
      return { ok: false, status: r.status, data: parsed, error: text.slice(0, 500) };
    }
    return { ok: true, status: r.status, data: parsed };
  } catch (e: any) {
    return { ok: false, status: 0, data: null, error: e?.message || 'fetch_error' };
  }
}

async function processRow(supabase: any, row: any, stats: RunStats): Promise<void> {
  const queueId: string = row.id;
  const replyUuid: string = row.reply_uuid;
  const workspaceName: string = row.workspace_name;

  // ── 1. CAS claim ──────────────────────────────────────────────────────
  const { data: claimed, error: claimErr } = await supabase
    .from('auto_reply_queue')
    .update({
      status: 'processing',
      attempts: (row.attempts ?? 0) + 1,
      last_attempt_at: new Date().toISOString(),
    })
    .eq('id', queueId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (claimErr || !claimed) {
    stats.skipped++;
    stats.details.push({ queueId, status: 'skipped', reason: 'claim_lost' });
    return;
  }
  stats.claimed++;

  // ── 2. Load context: reply + workspace + template ─────────────────────
  const [replyResult, workspaceResult, templateResult] = await Promise.all([
    supabase
      .from('lead_replies')
      .select('id, workspace_name, lead_email, first_name, last_name, phone, reply_text')
      .eq('id', replyUuid)
      .maybeSingle(),
    supabase
      .from('client_registry')
      .select('auto_reply_min_audit_score, auto_reply_max_per_hour')
      .eq('workspace_name', workspaceName)
      .maybeSingle(),
    supabase
      .from('reply_templates')
      .select('template_text_no_phone, template_text_with_phone')
      .eq('workspace_name', workspaceName)
      .maybeSingle(),
  ]);

  const reply = replyResult.data;
  const workspace = workspaceResult.data;
  const template = templateResult.data;

  if (!reply || !workspace || !template) {
    await supabase.from('auto_reply_queue').update({
      status: 'failed',
      error_message: `missing context: reply=${!!reply} workspace=${!!workspace} template=${!!template}`,
    }).eq('id', queueId);
    stats.failed++;
    stats.details.push({ queueId, status: 'failed', reason: 'missing_context' });
    return;
  }

  const leadName = [reply.first_name, reply.last_name].filter(Boolean).join(' ') || reply.lead_email;
  const auditThreshold: number = workspace.auto_reply_min_audit_score ?? 90;
  const maxPerHour: number = workspace.auto_reply_max_per_hour ?? 30;

  // ── 3. Rate-limit check (per workspace, per rolling hour) ─────────────
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: sentLastHour } = await supabase
    .from('auto_reply_queue')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_name', workspaceName)
    .eq('status', 'auto_sent')
    .gte('updated_at', oneHourAgo);

  if ((sentLastHour ?? 0) >= maxPerHour) {
    // Push 30 min forward and revert to pending so the next cron run picks
    // it up later. Don't burn an attempt for a rate-limit deferral.
    const reschedule = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await supabase.from('auto_reply_queue').update({
      status: 'pending',
      scheduled_for: reschedule,
      // Compensate the attempts increment we did at claim time.
      attempts: row.attempts ?? 0,
    }).eq('id', queueId);
    stats.rate_limited++;
    stats.details.push({ queueId, status: 'rate_limited', sentLastHour, maxPerHour, reschedule });
    return;
  }

  // ── 4. Generate draft (preview_mode — no DB writes) ───────────────────
  const draftRes = await callEdgeFunction<{
    success?: boolean;
    generated_reply?: string;
    cc_emails?: string[];
    template_used?: 'with_phone' | 'no_phone';
    model_used?: string;
    placeholders_resolved?: string[];
    placeholders_missing?: string[];
    placeholder_values?: Record<string, string>;
    error?: string;
  }>('generate-ai-reply', {
    reply_uuid: replyUuid,
    workspace_name: workspaceName,
    lead_name: leadName,
    lead_email: reply.lead_email,
    lead_phone: reply.phone || undefined,
    original_message: reply.reply_text || '',
    preview_mode: true,
  });

  if (!draftRes.ok || !draftRes.data?.generated_reply) {
    await supabase.from('auto_reply_queue').update({
      status: 'failed',
      error_message: `generate-ai-reply failed: ${draftRes.data?.error || draftRes.error || `status ${draftRes.status}`}`,
    }).eq('id', queueId);
    stats.failed++;
    stats.details.push({ queueId, status: 'failed', reason: 'generate_failed' });
    return;
  }

  const draft = draftRes.data;
  const generatedReplyText = draft.generated_reply!;
  const ccEmails = draft.cc_emails || [];
  const templateText = draft.template_used === 'with_phone'
    ? template.template_text_with_phone
    : template.template_text_no_phone;

  // ── 5. Audit ──────────────────────────────────────────────────────────
  const auditRes = await callEdgeFunction<{
    success?: boolean;
    audit?: {
      score: number;
      verdict: 'auto_send' | 'review' | 'reject';
      reasoning: string;
      issues: Array<{ type: string; severity: string; detail: string }>;
      model: string;
    };
    error?: string;
  }>('audit-ai-reply', {
    lead_reply_uuid: replyUuid,
    generated_reply_text: generatedReplyText,
    cc_emails: ccEmails,
    original_message: reply.reply_text || '',
    template_text: templateText || '',
    placeholders_resolved: draft.placeholders_resolved ?? [],
    placeholders_missing: draft.placeholders_missing ?? [],
    // Authoritative ground truth — without this the auditor flags every
    // legitimately-substituted phone/address as a hallucination.
    placeholder_values: draft.placeholder_values ?? {},
    workspace_name: workspaceName,
  });

  if (!auditRes.ok || !auditRes.data?.audit) {
    // Fail closed: if the audit service is down, don't auto-send.
    // Stash the draft and mark for review.
    await supabase.from('auto_reply_queue').update({
      status: 'review_required',
      generated_reply_text: generatedReplyText,
      cc_emails: ccEmails,
      generation_model: draft.model_used,
      audit_verdict: 'review',
      audit_reasoning: `audit service unavailable: ${auditRes.error || `status ${auditRes.status}`}`,
    }).eq('id', queueId);

    await sendAutoReplyEscalation({
      workspace: workspaceName,
      leadName,
      leadEmail: reply.lead_email,
      auditScore: null,
      auditThreshold,
      auditReasoning: 'Audit service unavailable — escalating to human review.',
      queueRowId: queueId,
      dashboardUrl: DASHBOARD_BASE_URL ? `${DASHBOARD_BASE_URL}/live-replies?review=${queueId}` : undefined,
    });

    stats.review_required++;
    stats.details.push({ queueId, status: 'review_required', reason: 'audit_unavailable' });
    return;
  }

  const audit = auditRes.data.audit;

  // Apply per-workspace threshold override on top of the LLM's recommendation.
  // The LLM uses a default of 90, but the workspace may have a different bar.
  let finalVerdict: 'auto_send' | 'review' | 'reject' = audit.verdict;
  const hasHighSeverity = (audit.issues || []).some((i) => i.severity === 'high');
  if (hasHighSeverity && finalVerdict === 'auto_send') {
    finalVerdict = 'review';
  } else if (audit.score >= auditThreshold && !hasHighSeverity) {
    finalVerdict = 'auto_send';
  } else if (audit.score >= 65) {
    finalVerdict = finalVerdict === 'reject' ? 'reject' : 'review';
  } else {
    finalVerdict = 'reject';
  }

  // Persist the audit result regardless of branch.
  const baseUpdate = {
    generated_reply_text: generatedReplyText,
    cc_emails: ccEmails,
    audit_score: audit.score,
    audit_verdict: finalVerdict,
    audit_reasoning: audit.reasoning,
    audit_issues: audit.issues,
    audit_model: audit.model,
    generation_model: draft.model_used,
  };

  // ── 6. Branch on verdict ──────────────────────────────────────────────
  if (finalVerdict === 'auto_send') {
    const sendRes = await callEdgeFunction<{
      success?: boolean;
      bison_reply_id?: number;
      already_sent?: boolean;
      error?: string;
    }>('send-reply-via-bison', {
      reply_uuid: replyUuid,
      workspace_name: workspaceName,
      generated_reply_text: generatedReplyText,
      cc_emails: ccEmails,
    });

    if (!sendRes.ok || !sendRes.data?.success) {
      await supabase.from('auto_reply_queue').update({
        ...baseUpdate,
        status: 'failed',
        error_message: `send-reply-via-bison failed: ${sendRes.data?.error || sendRes.error || `status ${sendRes.status}`}`,
      }).eq('id', queueId);
      stats.failed++;
      stats.details.push({ queueId, status: 'failed', reason: 'send_failed', score: audit.score });
      return;
    }

    // Look up the sent_replies row id we just created so we can FK it.
    const { data: sentRow } = await supabase
      .from('sent_replies')
      .select('id')
      .eq('reply_uuid', replyUuid)
      .maybeSingle();

    await supabase.from('auto_reply_queue').update({
      ...baseUpdate,
      status: 'auto_sent',
      sent_reply_id: sentRow?.id ?? null,
    }).eq('id', queueId);

    stats.auto_sent++;
    stats.details.push({ queueId, status: 'auto_sent', score: audit.score, lead: reply.lead_email });
    return;
  }

  if (finalVerdict === 'review') {
    await supabase.from('auto_reply_queue').update({
      ...baseUpdate,
      status: 'review_required',
    }).eq('id', queueId);

    await sendAutoReplyEscalation({
      workspace: workspaceName,
      leadName,
      leadEmail: reply.lead_email,
      auditScore: audit.score,
      auditThreshold,
      auditReasoning: audit.reasoning,
      auditIssues: audit.issues,
      queueRowId: queueId,
      dashboardUrl: DASHBOARD_BASE_URL ? `${DASHBOARD_BASE_URL}/live-replies?review=${queueId}` : undefined,
    });

    stats.review_required++;
    stats.details.push({ queueId, status: 'review_required', score: audit.score });
    return;
  }

  // verdict === 'reject'
  await supabase.from('auto_reply_queue').update({
    ...baseUpdate,
    status: 'failed',
    error_message: `audit rejected (score=${audit.score}): ${audit.reasoning}`,
  }).eq('id', queueId);
  stats.failed++;
  stats.details.push({ queueId, status: 'failed', reason: 'audit_rejected', score: audit.score });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startedAt = Date.now();

  // Fetch up to MAX_ROWS_PER_RUN due rows.
  const { data: dueRows, error: dueErr } = await supabase
    .from('auto_reply_queue')
    .select('id, reply_uuid, workspace_name, attempts')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(MAX_ROWS_PER_RUN);

  if (dueErr) {
    console.error('Failed to fetch due rows:', dueErr);
    return new Response(JSON.stringify({ success: false, error: dueErr.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const stats: RunStats = {
    candidates: dueRows?.length ?? 0,
    claimed: 0,
    auto_sent: 0,
    review_required: 0,
    failed: 0,
    rate_limited: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  if (!dueRows || dueRows.length === 0) {
    return new Response(JSON.stringify({ success: true, message: 'no due rows', ...stats, elapsed_ms: Date.now() - startedAt }), {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Process sequentially to respect rate limits and to keep Bison API
  // pressure reasonable. Concurrency is achieved by multiple cron
  // invocations, not by parallel processing within a single run.
  for (const row of dueRows) {
    try {
      await processRow(supabase, row, stats);
    } catch (e: any) {
      console.error(`Error processing queue row ${row.id}:`, e);
      stats.errors++;
      stats.details.push({ queueId: row.id, status: 'error', reason: e?.message || 'unknown' });
      // Best-effort mark as failed so it doesn't get re-claimed forever.
      await supabase.from('auto_reply_queue').update({
        status: 'failed',
        error_message: `worker exception: ${e?.message || 'unknown'}`,
      }).eq('id', row.id);
    }
  }

  console.log(
    `✅ Auto-reply worker run: candidates=${stats.candidates} claimed=${stats.claimed} ` +
    `auto_sent=${stats.auto_sent} review=${stats.review_required} failed=${stats.failed} ` +
    `rate_limited=${stats.rate_limited} skipped=${stats.skipped} errors=${stats.errors} ` +
    `elapsed=${Date.now() - startedAt}ms`,
  );

  return new Response(JSON.stringify({
    success: true,
    ...stats,
    elapsed_ms: Date.now() - startedAt,
  }), { status: 200, headers: corsHeaders });
});
