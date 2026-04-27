// Redraft an Awaiting-Review draft with reviewer feedback.
//
// One-shot orchestrator the dashboard calls when a reviewer types feedback
// like "shorten it" or "use the address Mike typed":
//   1. Load the auto_reply_queue row + lead context
//   2. Re-call generate-ai-reply with previous_draft + feedback
//   3. Re-call audit-ai-reply on the new draft
//   4. Append a manual_redraft entry to audit_issues so the trail is visible
//      on the card (parallels the manually_approved/manually_rejected pattern)
//   5. Update the queue row in place — status stays review_required because
//      we never auto-send a redraft (the reviewer is already in the loop)
//   6. Return the updated row to the frontend for an immediate UI patch
//
// Auth: verify_jwt=true. Frontend calls with the user's session JWT.
// Inter-function calls (generate, audit) use INTERNAL_FUNCTION_AUTH for the
// same reason process-auto-reply-queue does — auto-injected SUPABASE_SERVICE_ROLE_KEY
// can be sb_secret_* on this project, which fails JWT verification.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const INTERNAL_FUNCTION_AUTH =
  Deno.env.get('INTERNAL_FUNCTION_AUTH') || SUPABASE_SERVICE_ROLE_KEY;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const FEEDBACK_MAX_CHARS = 2000;

async function callEdgeFunction<T = unknown>(
  name: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${INTERNAL_FUNCTION_AUTH}`,
        'Content-Type': 'application/json',
        'x-triggered-by': 'redraft-ai-reply',
      },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    let parsed: T | null = null;
    try {
      parsed = text ? (JSON.parse(text) as T) : null;
    } catch (_) {
      parsed = null;
    }
    if (!r.ok) {
      return { ok: false, status: r.status, data: parsed, error: text.slice(0, 500) };
    }
    return { ok: true, status: r.status, data: parsed };
  } catch (e: any) {
    return { ok: false, status: 0, data: null, error: e?.message || 'fetch_error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const queueId: string | undefined = body?.queue_id;
    const feedbackRaw: string | undefined = body?.feedback;

    if (!queueId || typeof queueId !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'queue_id is required' }),
        { status: 400, headers: corsHeaders },
      );
    }
    const feedback = (feedbackRaw ?? '').trim().slice(0, FEEDBACK_MAX_CHARS);
    if (!feedback) {
      return new Response(
        JSON.stringify({ success: false, error: 'feedback is required' }),
        { status: 400, headers: corsHeaders },
      );
    }

    // 1. Load the queue row. Must be in review_required to redraft.
    const { data: queueRow, error: qErr } = await supabase
      .from('auto_reply_queue')
      .select(
        'id, reply_uuid, workspace_name, status, generated_reply_text, cc_emails, audit_score, audit_issues',
      )
      .eq('id', queueId)
      .maybeSingle();

    if (qErr || !queueRow) {
      return new Response(
        JSON.stringify({ success: false, error: 'queue row not found' }),
        { status: 404, headers: corsHeaders },
      );
    }
    if (queueRow.status !== 'review_required') {
      return new Response(
        JSON.stringify({
          success: false,
          error: `queue row is not in review_required (currently ${queueRow.status})`,
        }),
        { status: 409, headers: corsHeaders },
      );
    }

    // 2. Load lead context for generate-ai-reply.
    const { data: lead, error: lErr } = await supabase
      .from('lead_replies')
      .select('id, lead_email, first_name, last_name, phone, reply_text, workspace_name')
      .eq('id', queueRow.reply_uuid)
      .maybeSingle();

    if (lErr || !lead) {
      return new Response(
        JSON.stringify({ success: false, error: 'lead reply not found' }),
        { status: 404, headers: corsHeaders },
      );
    }

    const leadName =
      [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.lead_email;
    const previousScore = queueRow.audit_score ?? null;

    // 3. Regenerate with feedback.
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
      reply_uuid: queueRow.reply_uuid,
      workspace_name: queueRow.workspace_name,
      lead_name: leadName,
      lead_email: lead.lead_email,
      lead_phone: lead.phone || undefined,
      original_message: lead.reply_text || '',
      preview_mode: true,
      previous_draft: queueRow.generated_reply_text || '',
      feedback,
    });

    if (!draftRes.ok || !draftRes.data?.generated_reply) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'redraft failed at generation',
          detail: draftRes.data?.error || draftRes.error || `status ${draftRes.status}`,
        }),
        { status: 502, headers: corsHeaders },
      );
    }

    const draft = draftRes.data;
    const newDraftText = draft.generated_reply!;

    // 4. Look up the template_text variant the audit needs.
    const { data: tmpl } = await supabase
      .from('reply_templates')
      .select('template_text_no_phone, template_text_with_phone')
      .eq('workspace_name', queueRow.workspace_name)
      .maybeSingle();
    const templateText =
      draft.template_used === 'with_phone'
        ? tmpl?.template_text_with_phone || ''
        : tmpl?.template_text_no_phone || '';

    // 5. Re-audit.
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
      lead_reply_uuid: queueRow.reply_uuid,
      generated_reply_text: newDraftText,
      cc_emails: queueRow.cc_emails ?? [],
      original_message: lead.reply_text || '',
      template_text: templateText,
      placeholders_resolved: draft.placeholders_resolved ?? [],
      placeholders_missing: draft.placeholders_missing ?? [],
      placeholder_values: draft.placeholder_values ?? {},
      thread_history: draft.thread_history ?? [],
      workspace_name: queueRow.workspace_name,
    });

    if (!auditRes.ok || !auditRes.data?.audit) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'redraft failed at audit',
          detail: auditRes.data?.error || auditRes.error || `status ${auditRes.status}`,
        }),
        { status: 502, headers: corsHeaders },
      );
    }
    const audit = auditRes.data.audit;

    // 6. Append the redraft trail entry. Existing audit_issues array gets
    //    a new manual_redraft sentinel — same pattern used for
    //    manually_approved / manually_rejected.
    const truncatedFeedback =
      feedback.length > 200 ? feedback.slice(0, 200) + '…' : feedback;
    const trailEntry = {
      type: 'manual_redraft',
      severity: 'low' as const,
      detail: `Reviewer feedback: ${truncatedFeedback} | Score: ${
        previousScore ?? '?'
      } → ${audit.score}`,
    };
    // Audit's NEW issues (real ones from the new audit) plus the trail entry
    // we appended. Note: we DROP the old audit's issues — the new audit
    // covers the new draft, those old issues no longer apply.
    const newIssues = [...(audit.issues ?? []), trailEntry];

    // 7. Persist. Status STAYS review_required so the human still confirms.
    // Clear the cached suggested_feedback — this draft is new, so the old
    // suggestion (which targeted the previous draft) is stale. A fresh
    // suggestion will be generated lazily on the next card view.
    const { data: updatedRow, error: updErr } = await supabase
      .from('auto_reply_queue')
      .update({
        generated_reply_text: newDraftText,
        audit_score: audit.score,
        audit_verdict: audit.verdict,
        audit_reasoning: audit.reasoning,
        audit_issues: newIssues,
        audit_model: audit.model,
        generation_model: draft.model_used,
        status: 'review_required',
        error_message: null,
        suggested_feedback: null,
      })
      .eq('id', queueId)
      .select(
        'id, reply_uuid, workspace_name, status, scheduled_for, attempts, last_attempt_at, generated_reply_text, cc_emails, audit_score, audit_verdict, audit_reasoning, audit_issues, audit_model, generation_model, sent_reply_id, error_message, created_at, updated_at, suggested_feedback',
      )
      .maybeSingle();

    if (updErr || !updatedRow) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'redraft persist failed',
          detail: updErr?.message,
        }),
        { status: 500, headers: corsHeaders },
      );
    }

    console.log(
      `🔁 Redrafted ${queueId} for ${queueRow.workspace_name} — score ${
        previousScore ?? '?'
      } → ${audit.score}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        queue_row: updatedRow,
        previous_score: previousScore,
        new_score: audit.score,
      }),
      { status: 200, headers: corsHeaders },
    );
  } catch (e: any) {
    console.error('redraft-ai-reply error:', e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message || 'unknown error' }),
      { status: 500, headers: corsHeaders },
    );
  }
});
