// Generate a prescriptive redraft suggestion for a review_required draft.
//
// The audit-ai-reply function produces *descriptive* reasoning ("the draft
// uses the wrong phone number") — useful for understanding why something
// was flagged, but not directly actionable. This function turns that into
// a single short instruction the drafter would receive
// ("Use 469-604-4484 instead of the lead's signature number — that's the
// agent's office line per the resolved facts.").
//
// Pre-populates the redraft textarea on the dashboard so reviewers can
// one-click submit instead of typing feedback themselves.
//
// Idempotent: if the queue row already has a cached suggestion, it's
// returned without a fresh LLM call. Once cached, suggestions are static
// per draft — they only change when the draft itself changes (i.e. after
// a redraft, redraft-ai-reply will clear suggested_feedback so a fresh one
// gets generated for the new draft).
//
// Auth: verify_jwt=true. Frontend calls with user session JWT.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Reuse the audit model for suggestion generation — it has the same
// reasoning capability and we already pay for it.
const SUGGEST_MODEL = Deno.env.get('ANTHROPIC_AUDIT_MODEL') || 'claude-sonnet-4-6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const SYSTEM_PROMPT = `You are an editorial assistant helping reviewers fix AI-drafted email replies.

You're given:
1. An AI-drafted reply that an audit gate flagged for human review
2. The audit's reasoning explaining what's concerning
3. The audit's specific issues with severities
4. The original lead message + workspace context

Your job: produce ONE short, actionable instruction (max 250 characters) that tells the drafter how to fix the most important issue. The instruction should be:
- **Direct** — written as a command to the drafter, not advice to the reviewer
- **Specific** — name the exact thing to change ("drop the May 5th renewal date") not vague ("make it better")
- **Single-issue focused** — pick the highest-severity / most-impactful issue. Don't enumerate everything.
- **Grounded** — only suggest changes that respect the anti-hallucination rules. Never tell the drafter to invent facts.

Examples of good suggestions:
- "Drop the May 5th renewal date — it came from our prior outreach, not the lead's message."
- "Use the address Mike typed in his email signature instead of the database address."
- "Shorten this to 2 sentences and remove the cc'd team line."
- "Use 'Mike' from the lead's signature, not 'James' from the database — they signed differently."

Examples of BAD suggestions (don't produce these):
- "Improve the tone." (too vague)
- "Fix the hallucinations." (too vague)
- "Use the address 123 Main St" (inventing a value the audit can't verify)
- "Drop the date and shorten and improve tone and..." (too many things at once)

Output ONLY the suggestion text. No JSON, no preamble, no quotes around it. Just the instruction.`;

async function generateSuggestion(opts: {
  draftText: string;
  auditReasoning: string;
  auditIssues: Array<{ type?: string; severity?: string; detail?: string }>;
  originalMessage: string;
  workspaceName: string;
}): Promise<string> {
  const issuesText = (opts.auditIssues || [])
    .filter((i) => i?.type !== 'manually_approved' && i?.type !== 'manually_rejected' && i?.type !== 'manual_redraft')
    .slice(0, 8)
    .map((i) => `- [${i.severity ?? 'low'}] ${i.type ?? 'issue'}: ${i.detail ?? ''}`)
    .join('\n') || '(no specific issues)';

  const userPrompt = `## Workspace
${opts.workspaceName}

## Original lead message
"""
${opts.originalMessage}
"""

## AI-drafted reply (the thing being reviewed)
"""
${opts.draftText}
"""

## Audit reasoning
${opts.auditReasoning || '(none)'}

## Audit issues
${issuesText}

Produce ONE short actionable instruction now.`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: SUGGEST_MODEL,
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!resp.ok) {
    throw new Error(`Suggestion LLM error (${resp.status}): ${(await resp.text()).slice(0, 300)}`);
  }
  const data = await resp.json();
  const raw: string = data?.content?.[0]?.text ?? '';
  // Strip surrounding quotes/whitespace, cap at 500 chars defensively
  return raw.trim().replace(/^["']|["']$/g, '').slice(0, 500);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ success: false, error: 'ANTHROPIC_API_KEY not set' }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const queueId: string | undefined = body?.queue_id;
    if (!queueId) {
      return new Response(JSON.stringify({ success: false, error: 'queue_id required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 1. Load the queue row.
    const { data: row, error: rowErr } = await supabase
      .from('auto_reply_queue')
      .select(
        'id, reply_uuid, workspace_name, status, generated_reply_text, audit_reasoning, audit_issues, suggested_feedback',
      )
      .eq('id', queueId)
      .maybeSingle();

    if (rowErr || !row) {
      return new Response(JSON.stringify({ success: false, error: 'queue row not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // 2. Idempotent: if cached, return it.
    if (row.suggested_feedback && row.suggested_feedback.trim().length > 0) {
      return new Response(
        JSON.stringify({ success: true, suggestion: row.suggested_feedback, cached: true }),
        { status: 200, headers: corsHeaders },
      );
    }

    // 3. Need lead context for prompt.
    const { data: lead } = await supabase
      .from('lead_replies')
      .select('reply_text')
      .eq('id', row.reply_uuid)
      .maybeSingle();

    if (!row.generated_reply_text) {
      return new Response(
        JSON.stringify({ success: false, error: 'queue row has no draft yet' }),
        { status: 409, headers: corsHeaders },
      );
    }

    // 4. Generate suggestion.
    const suggestion = await generateSuggestion({
      draftText: row.generated_reply_text,
      auditReasoning: row.audit_reasoning || '',
      auditIssues: (row.audit_issues || []) as any,
      originalMessage: lead?.reply_text || '',
      workspaceName: row.workspace_name,
    });

    if (!suggestion || suggestion.length < 5) {
      return new Response(
        JSON.stringify({ success: false, error: 'suggestion model returned empty' }),
        { status: 502, headers: corsHeaders },
      );
    }

    // 5. Persist (idempotent: only if still empty — avoids racing with
    //    concurrent calls or a redraft that already cleared this).
    const { data: updated, error: updErr } = await supabase
      .from('auto_reply_queue')
      .update({ suggested_feedback: suggestion })
      .eq('id', queueId)
      .is('suggested_feedback', null)
      .select('suggested_feedback')
      .maybeSingle();

    if (updErr) {
      console.error('persist suggestion error:', updErr.message);
      // Return the suggestion anyway — the persist failure is non-fatal,
      // the frontend gets the value it needs.
    }

    console.log(
      `💡 Suggestion generated for ${queueId} (${row.workspace_name}): ${suggestion.slice(0, 80)}…`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        suggestion: updated?.suggested_feedback ?? suggestion,
        cached: false,
      }),
      { status: 200, headers: corsHeaders },
    );
  } catch (e: any) {
    console.error('suggest-redraft-feedback error:', e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message || 'unknown error' }),
      { status: 500, headers: corsHeaders },
    );
  }
});
