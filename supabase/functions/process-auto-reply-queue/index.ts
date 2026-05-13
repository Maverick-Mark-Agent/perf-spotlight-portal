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
import {
  DEFLECTION_GENERATION_MODEL,
  DeflectionTemplateMap,
  getAssistantFirstName,
  isSchedulingIntent,
  renderDeflection,
  SchedulingIntent,
} from '../_shared/schedulingIntent.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Inter-function auth — Supabase Edge Function gateway requires JWT-format
// keys when verify_jwt=true. The auto-injected SUPABASE_SERVICE_ROLE_KEY can
// be a non-JWT (sb_secret_*) format on projects migrated to the new key
// system, which fails JWT verification when passed Bearer-style to another
// function. We keep an explicit JWT-format key here under our own control so
// inter-function calls don't depend on whatever Supabase auto-injects.
const INTERNAL_FUNCTION_AUTH =
  Deno.env.get('INTERNAL_FUNCTION_AUTH') || SUPABASE_SERVICE_ROLE_KEY;
// Optional dashboard origin for the Slack deep-link. Set to e.g.
// https://dashboard.maverick-ins.com once the link target is finalized.
const DASHBOARD_BASE_URL = Deno.env.get('DASHBOARD_BASE_URL') || '';

// Each row takes ~10-30s end-to-end (generate + audit + maybe send).
// Supabase Edge Functions have a 150s idle timeout. Sequential processing
// of 20 rows blew through that earlier; parallel processing with a
// CONCURRENCY cap keeps everything in flight without overwhelming the
// upstream APIs (Anthropic + Bison).
const MAX_ROWS_PER_RUN = 16;
const CONCURRENCY = 4;

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
        // Use the JWT-format internal auth, NOT the auto-injected service role
        // key (which can be sb_secret_* on this project and fails verify_jwt).
        'Authorization': `Bearer ${INTERNAL_FUNCTION_AUTH}`,
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
  const forceReview: boolean = row.force_review === true;

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

  // ── 1b. Guard: check if a human already replied since this row was enqueued ──
  // A human agent replying directly in Bison fires manual_email_sent → creates a
  // verified sent_replies row. If that exists now, cancel this queue row — we must
  // never auto-reply on top of a human reply.
  const { data: existingSent } = await supabase
    .from('sent_replies')
    .select('id, sent_by, verified_at')
    .eq('reply_uuid', replyUuid)
    .not('verified_at', 'is', null)
    .maybeSingle();

  if (existingSent) {
    await supabase.from('auto_reply_queue').update({
      status: 'cancelled',
      error_message: `Reply already sent (sent_replies.id=${existingSent.id}, sent_by=${existingSent.sent_by ?? 'unknown'}) — cancelling to avoid double-reply`,
    }).eq('id', queueId);
    stats.skipped++;
    stats.details.push({ queueId, status: 'cancelled', reason: 'already_replied_by_human', sentBy: existingSent.sent_by });
    return;
  }

  // ── 2. Load context: reply + workspace + template ─────────────────────
  const [replyResult, workspaceResult, templateResult] = await Promise.all([
    supabase
      .from('lead_replies')
      .select('id, workspace_name, lead_email, first_name, last_name, phone, reply_text, scheduling_intent, scheduling_phrase, scheduling_intent_confidence')
      .eq('id', replyUuid)
      .maybeSingle(),
    supabase
      .from('client_registry')
      .select('auto_reply_min_audit_score, auto_reply_max_per_hour, auto_reply_deflect_scheduling, auto_reply_min_scheduling_confidence, auto_reply_deflection_templates')
      .eq('workspace_name', workspaceName)
      .maybeSingle(),
    supabase
      .from('reply_templates')
      .select('template_text_no_phone, template_text_with_phone, cc_emails')
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

  // ── 2b. One-reply-per-lead rule ──────────────────────────────────────────
  // The AI replies ONLY to a lead's first inbound message in a given workspace.
  // After that, the human rep owns the conversation — no matter how many more
  // times the lead writes back, we stay silent. This prevents the AI from
  // talking over a rep who has already taken the handoff (e.g., Castle Agency:
  // Kim Williams hands off to Luke Mieska after the first reply).
  //
  // We cancel if ANY sent_replies row exists for this email+workspace,
  // regardless of status or verification. Exclude failed rows so a genuine
  // send failure doesn't permanently lock the lead out — they can be retried.
  if (reply.lead_email) {
    const { data: priorSent } = await supabase
      .from('sent_replies')
      .select('id, sent_by, status, sent_at')
      .eq('workspace_name', workspaceName)
      .eq('lead_email', reply.lead_email)
      .neq('reply_uuid', replyUuid)
      .neq('status', 'failed')
      .limit(1)
      .maybeSingle();

    if (priorSent) {
      await supabase.from('auto_reply_queue').update({
        status: 'cancelled',
        error_message: `Already replied to this lead in ${workspaceName} (sent_replies.id=${priorSent.id}, sent_at=${priorSent.sent_at}, sent_by=${priorSent.sent_by ?? 'auto'}) — AI replies only to the first inbound message; the human rep owns subsequent turns.`,
      }).eq('id', queueId);
      stats.skipped++;
      stats.details.push({ queueId, status: 'cancelled', reason: 'one_reply_per_lead', sentBy: priorSent.sent_by });
      return;
    }
  }

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

  // ── 4. Decide path: deflection vs. LLM draft ──────────────────────────
  // If the inbound reply was classified with scheduling intent AND the
  // workspace has deflection enabled AND classifier confidence cleared the
  // workspace's floor, we render a deterministic deflection draft locally
  // (no generate-ai-reply call). Audit still runs on the result.
  const intentRaw = reply.scheduling_intent ?? 'none';
  const intent: SchedulingIntent = isSchedulingIntent(intentRaw) ? intentRaw : 'none';
  const intentConfidence: number = reply.scheduling_intent_confidence ?? 0;
  const deflectFlag: boolean = workspace.auto_reply_deflect_scheduling === true;
  const intentFloor: number = workspace.auto_reply_min_scheduling_confidence ?? 70;
  const shouldDeflect = deflectFlag
    && intent !== 'none'
    && intentConfidence >= intentFloor;

  let generatedReplyText: string;
  let ccEmails: string[];
  let templateText: string;
  let generationModel: string | undefined;
  let placeholdersResolved: string[];
  let placeholdersMissing: string[];
  let placeholderValues: Record<string, string>;
  let threadHistory: Array<{ reply_date?: string; reply_text?: string; sentiment?: string | null }>;
  let deflectionIntentForRow: Exclude<SchedulingIntent, 'none'> | null = null;

  if (shouldDeflect) {
    // Deterministic deflection path. {Assistant} comes from cc_emails on the
    // workspace's reply template (Andrew/Becky for the Schroders).
    const ccFromTemplate = Array.isArray(template.cc_emails) ? template.cc_emails as string[] : [];
    const assistant = getAssistantFirstName(ccFromTemplate);
    const overrides = (workspace.auto_reply_deflection_templates as DeflectionTemplateMap | null) ?? null;
    const intentForRender = intent as Exclude<SchedulingIntent, 'none'>;

    const rendered = renderDeflection({
      intent: intentForRender,
      first: reply.first_name ?? '',
      assistant,
      timingPhrase: reply.scheduling_phrase ?? null,
      overrides,
    });

    generatedReplyText = rendered.text;
    ccEmails = ccFromTemplate;
    // For audit's "faithfulness to template" axis, the deflection's source
    // template IS the template — pass it through so audit grades against
    // what we actually rendered from.
    templateText = (overrides?.[intentForRender] && overrides[intentForRender]!.trim().length > 0)
      ? overrides[intentForRender]!
      : (template.template_text_no_phone || '');  // existing fallback for hard-rule shape
    generationModel = DEFLECTION_GENERATION_MODEL;
    placeholdersResolved = ['first', 'Assistant', 'timing_phrase'];
    placeholdersMissing = [];
    placeholderValues = {
      first: reply.first_name ?? '',
      Assistant: assistant ?? 'our team',
      timing_phrase: reply.scheduling_phrase ?? 'shortly',
    };
    threadHistory = [];
    deflectionIntentForRow = intentForRender;

    console.log(`📨 Deflection drafted for ${queueId} (${workspaceName}, intent=${intent}@${intentConfidence}%, source=${rendered.templateUsed})`);
  } else {
    // ── LLM path (existing behavior) ────────────────────────────────────
    const draftRes = await callEdgeFunction<{
      success?: boolean;
      generated_reply?: string;
      cc_emails?: string[];
      template_used?: 'with_phone' | 'no_phone';
      model_used?: string;
      placeholders_resolved?: string[];
      placeholders_missing?: string[];
      placeholder_values?: Record<string, string>;
      thread_history?: Array<{ reply_date?: string; reply_text?: string; sentiment?: string | null }>;
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
    generatedReplyText = draft.generated_reply!;
    ccEmails = draft.cc_emails || [];
    templateText = (draft.template_used === 'with_phone'
      ? template.template_text_with_phone
      : template.template_text_no_phone) || '';
    generationModel = draft.model_used;
    placeholdersResolved = draft.placeholders_resolved ?? [];
    placeholdersMissing = draft.placeholders_missing ?? [];
    placeholderValues = draft.placeholder_values ?? {};
    threadHistory = draft.thread_history ?? [];
  }

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
    template_text: templateText,
    placeholders_resolved: placeholdersResolved,
    placeholders_missing: placeholdersMissing,
    // Authoritative ground truth — without this the auditor flags every
    // legitimately-substituted phone/address as a hallucination.
    placeholder_values: placeholderValues,
    // Prior turns so audit can verify facts (renewal dates, agent names) that
    // surfaced earlier in the conversation rather than treating them as new claims.
    thread_history: threadHistory,
    workspace_name: workspaceName,
    // Lets audit's confirmed_specific_time rule know whether the inbound
    // reply named a specific time — only then is "draft confirms a specific
    // time" a problem.
    inbound_scheduling_intent: intent,
  });

  if (!auditRes.ok || !auditRes.data?.audit) {
    // Fail closed: if the audit service is down, don't auto-send.
    // Stash the draft and mark for review.
    await supabase.from('auto_reply_queue').update({
      status: 'review_required',
      generated_reply_text: generatedReplyText,
      cc_emails: ccEmails,
      generation_model: generationModel,
      deflection_intent: deflectionIntentForRow,
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

  // Verdict mapping:
  //   - auto_send : score >= threshold AND no high-severity issues → send immediately
  //   - review    : anything else — but ONLY after a retry. On the first attempt we
  //                 regenerate and re-audit rather than parking the row as review_required.
  //                 This means a hallucinated draft gets one fresh shot before escalating.
  const hasHighSeverity = (audit.issues || []).some((i: any) => i.severity === 'high');
  let finalVerdict: 'auto_send' | 'review' = 'review';
  // force_review=true means a human must approve regardless of audit score —
  // this covers: auto_reply_disabled workspaces, low confidence, needs_review flag.
  if (!forceReview && audit.score >= auditThreshold && !hasHighSeverity) {
    finalVerdict = 'auto_send';
  }

  // ── Auto-retry on first audit failure ─────────────────────────────────
  // If the draft failed audit AND this is the first attempt (attempts === 1),
  // regenerate a fresh draft and re-audit it before escalating to human review.
  // Most hallucinations are one-off — a second generation usually passes clean.
  // Skip retry for force_review rows — they go straight to review regardless.
  if (finalVerdict === 'review' && !forceReview && (row.attempts ?? 1) <= 1) {
    console.log(`🔄 Audit failed on attempt 1 (score=${audit.score}) — regenerating draft for ${replyUuid}`);

    const retryDraftRes = await callEdgeFunction<{
      success?: boolean;
      generated_reply?: string;
      cc_emails?: string[];
      template_used?: 'with_phone' | 'no_phone';
      model_used?: string;
      placeholders_resolved?: string[];
      placeholders_missing?: string[];
      placeholder_values?: Record<string, string>;
      thread_history?: Array<{ reply_date?: string; reply_text?: string; sentiment?: string | null }>;
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

    if (retryDraftRes.ok && retryDraftRes.data?.generated_reply) {
      const retryDraft = retryDraftRes.data;
      const retryText = retryDraft.generated_reply!;
      const retryTemplateText = retryDraft.template_used === 'with_phone'
        ? template.template_text_with_phone
        : template.template_text_no_phone;

      const retryAuditRes = await callEdgeFunction<{
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
        generated_reply_text: retryText,
        cc_emails: retryDraft.cc_emails || [],
        original_message: reply.reply_text || '',
        template_text: retryTemplateText || '',
        placeholders_resolved: retryDraft.placeholders_resolved ?? [],
        placeholders_missing: retryDraft.placeholders_missing ?? [],
        placeholder_values: retryDraft.placeholder_values ?? {},
        thread_history: retryDraft.thread_history ?? [],
        workspace_name: workspaceName,
      });

      if (retryAuditRes.ok && retryAuditRes.data?.audit) {
        const retryAudit = retryAuditRes.data.audit;
        const retryHasHigh = (retryAudit.issues || []).some((i: any) => i.severity === 'high');
        if (!forceReview && retryAudit.score >= auditThreshold && !retryHasHigh) {
          // Retry passed — proceed to send with the new draft
          console.log(`✅ Retry draft passed audit (score=${retryAudit.score}) — sending`);
          const retryBaseUpdate = {
            generated_reply_text: retryText,
            cc_emails: retryDraft.cc_emails || [],
            audit_score: retryAudit.score,
            audit_verdict: 'auto_send',
            audit_reasoning: retryAudit.reasoning,
            audit_issues: retryAudit.issues,
            audit_model: retryAudit.model,
            generation_model: retryDraft.model_used,
          };
          const retrySendRes = await callEdgeFunction<{
            success?: boolean; bison_reply_id?: number; already_sent?: boolean; error?: string;
          }>('send-reply-via-bison', {
            reply_uuid: replyUuid,
            workspace_name: workspaceName,
            generated_reply_text: retryText,
            cc_emails: retryDraft.cc_emails || [],
          });
          if (!retrySendRes.ok || !retrySendRes.data?.success) {
            const retryErrMsg = `send-reply-via-bison failed (retry): ${retrySendRes.data?.error || retrySendRes.error || `status ${retrySendRes.status}`}`;
            await supabase.from('auto_reply_queue').update({
              ...retryBaseUpdate,
              status: 'failed',
              error_message: retryErrMsg,
            }).eq('id', queueId);
            // Insert a failed sent_replies row so the dashboard shows ERROR, not silence
            await supabase.from('sent_replies').upsert({
              reply_uuid: replyUuid,
              workspace_name: workspaceName,
              lead_email: reply.lead_email,
              lead_name: leadName,
              generated_reply_text: retryText,
              status: 'failed',
              error_message: retryErrMsg,
              sent_at: new Date().toISOString(),
              retry_count: 1,
            }, { onConflict: 'reply_uuid', ignoreDuplicates: false });
            stats.failed++;
            stats.details.push({ queueId, status: 'failed', reason: 'send_failed_retry', score: retryAudit.score });
            return;
          }
          const { data: retrySentRow } = await supabase.from('sent_replies').select('id').eq('reply_uuid', replyUuid).maybeSingle();
          await supabase.from('auto_reply_queue').update({
            ...retryBaseUpdate,
            status: 'auto_sent',
            sent_reply_id: retrySentRow?.id ?? null,
          }).eq('id', queueId);
          stats.auto_sent++;
          stats.details.push({ queueId, status: 'auto_sent', score: retryAudit.score, lead: reply.lead_email, note: 'retry_passed' });
          return;
        }
        // Retry also failed audit — fall through with retry's draft so the reviewer
        // sees the better (most recent) version.
        console.log(`⚠️  Retry draft also failed audit (score=${retryAudit.score}) — escalating to review`);
        // Overwrite the original draft/audit with the retry results for the reviewer
        const retryFinalUpdate = {
          generated_reply_text: retryText,
          cc_emails: retryDraft.cc_emails || [],
          audit_score: retryAudit.score,
          audit_verdict: 'review' as const,
          audit_reasoning: retryAudit.reasoning,
          audit_issues: retryAudit.issues,
          audit_model: retryAudit.model,
          generation_model: retryDraft.model_used,
        };
        await supabase.from('auto_reply_queue').update({
          ...retryFinalUpdate,
          status: 'review_required',
        }).eq('id', queueId);
        await sendAutoReplyEscalation({
          workspace: workspaceName, leadName, leadEmail: reply.lead_email,
          auditScore: retryAudit.score, auditThreshold, auditReasoning: retryAudit.reasoning,
          auditIssues: retryAudit.issues, queueRowId: queueId,
          dashboardUrl: DASHBOARD_BASE_URL ? `${DASHBOARD_BASE_URL}/live-replies?review=${queueId}` : undefined,
        });
        stats.review_required++;
        stats.details.push({ queueId, status: 'review_required', score: retryAudit.score, note: 'both_attempts_failed' });
        return;
      }
    }
    // Retry generation/audit itself failed — fall through to escalate with original draft
    console.warn(`⚠️  Retry generation failed — escalating original draft to review for ${replyUuid}`);
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
    generation_model: generationModel,
    deflection_intent: deflectionIntentForRow,
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
      const sendErrMsg = `send-reply-via-bison failed: ${sendRes.data?.error || sendRes.error || `status ${sendRes.status}`}`;
      await supabase.from('auto_reply_queue').update({
        ...baseUpdate,
        status: 'failed',
        error_message: sendErrMsg,
      }).eq('id', queueId);
      // Insert a failed sent_replies row so the dashboard shows ERROR with the message,
      // not silence. Uses upsert to avoid duplicate if somehow called twice.
      await supabase.from('sent_replies').upsert({
        reply_uuid: replyUuid,
        workspace_name: workspaceName,
        lead_email: reply.lead_email,
        lead_name: leadName,
        generated_reply_text: generatedReplyText,
        status: 'failed',
        error_message: sendErrMsg,
        sent_at: new Date().toISOString(),
        retry_count: 0,
      }, { onConflict: 'reply_uuid', ignoreDuplicates: false });
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

  // finalVerdict === 'review' — both attempts failed, escalate to human
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
    .select('id, reply_uuid, workspace_name, attempts, force_review')
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

  // Process up to CONCURRENCY rows in parallel via a shared queue. Each
  // "lane" pulls the next pending row, processes it, and loops until the
  // queue is empty. Per-workspace rate limiting still works because
  // processRow checks the limit at claim time. Bison API pressure stays
  // bounded because CONCURRENCY caps simultaneous Bison calls.
  const work = [...dueRows];
  async function laneWorker(): Promise<void> {
    while (work.length > 0) {
      const row = work.shift();
      if (!row) return;
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
  }
  const lanes = Array.from(
    { length: Math.min(CONCURRENCY, dueRows.length) },
    () => laneWorker(),
  );
  await Promise.all(lanes);

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
