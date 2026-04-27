// Audit a generated AI reply before auto-sending.
//
// Two-stage gate:
//   1. Hard rules (deterministic, instant) — length, leftover placeholders,
//      "(not on file — please confirm)" sentinels, malformed CC emails.
//      Any hard-rule failure → verdict='reject', score=0, no LLM call.
//   2. LLM-as-judge — Sonnet 4.5 (env-driven via ANTHROPIC_AUDIT_MODEL)
//      grades the draft on 4 axes (faithfulness/personalization/tone/grounding)
//      and returns a structured verdict.
//
// Verdict mapping (applied by the caller, NOT this function — we just
// return the raw score + LLM's recommended verdict):
//   score >= client.auto_reply_min_audit_score → auto_send
//   65 <= score < threshold                    → review
//   score < 65                                 → reject
//
// Caller is responsible for the final auto_send/review/reject decision
// because the threshold is per-workspace.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const AUDIT_MODEL = Deno.env.get('ANTHROPIC_AUDIT_MODEL') || 'claude-sonnet-4-6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

interface AuditIssue {
  type: string;
  severity: 'low' | 'medium' | 'high';
  detail: string;
}

interface AuditResult {
  score: number;          // 0–100
  verdict: 'auto_send' | 'review' | 'reject';
  reasoning: string;
  issues: AuditIssue[];
  model: string;
  hard_rule_failures?: AuditIssue[];   // present if a hard rule rejected
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER_RE = /\{[a-zA-Z][a-zA-Z0-9_]*\}/;
const NOT_ON_FILE_SENTINEL = '(not on file — please confirm)';

/** Returns null if all hard rules pass, else an AuditResult with reject verdict. */
function runHardRules(opts: {
  generatedReplyText: string;
  ccEmails: string[];
  placeholdersMissing: string[];
}): AuditResult | null {
  const failures: AuditIssue[] = [];
  const text = opts.generatedReplyText ?? '';

  if (text.trim().length < 50) {
    failures.push({ type: 'too_short', severity: 'high', detail: `Reply is ${text.trim().length} chars (min 50)` });
  }
  if (text.length > 2000) {
    failures.push({ type: 'too_long', severity: 'high', detail: `Reply is ${text.length} chars (max 2000)` });
  }
  if (PLACEHOLDER_RE.test(text)) {
    const m = text.match(PLACEHOLDER_RE);
    failures.push({ type: 'unfilled_placeholder', severity: 'high', detail: `Found unfilled placeholder: ${m?.[0] ?? '?'}` });
  }
  if (text.includes(NOT_ON_FILE_SENTINEL)) {
    // The drafter LLM is instructed to gracefully handle these. If the sentinel
    // survived to the draft, the personalization broke down — reject.
    failures.push({
      type: 'leaked_sentinel',
      severity: 'high',
      detail: '"(not on file — please confirm)" sentinel survived into the final draft',
    });
  }
  for (const email of opts.ccEmails || []) {
    if (!EMAIL_RE.test(email)) {
      failures.push({ type: 'invalid_cc_email', severity: 'high', detail: `Bad email: ${email}` });
    }
  }

  if (failures.length === 0) return null;

  return {
    score: 0,
    verdict: 'reject',
    reasoning: `Hard-rule failure(s): ${failures.map((f) => f.type).join(', ')}`,
    issues: failures,
    model: 'hard_rules',
    hard_rule_failures: failures,
  };
}

const SYSTEM_PROMPT = `You are an audit reviewer for AI-generated email replies on behalf of insurance agents.

Your job: grade an AI-drafted reply against the original lead message, the workspace template, and the lead's RESOLVED FACTS (the actual values that were substituted into placeholders). Return a structured score and verdict so a downstream worker can decide whether to auto-send or escalate to human review.

CRITICAL: The "Resolved facts" section in the user prompt lists EVERY personal-information value the drafter was authorized to use. If the draft contains a specific address, phone, DOB, or named person that is NOT in Resolved facts AND NOT explicitly written by the lead in their original message, treat it as a high-severity hallucination — even if the value sounds plausible.

Grade on four 0–25 axes (sum = 0–100):

1. **Faithfulness to template (0–25)**: Did the draft preserve the template's structure and all critical details (template-supplied phone numbers, agent names, signatures, CC routing, key offers)?
2. **Correctness of personalization (0–25)**: Are substituted values used naturally and in the right slot? E.g. don't insert the renewal date where a phone number belongs. If the lead signed their email with a different name than was substituted into {first_name}, that's a name mismatch — penalize.
3. **Tone match to original (0–25)**: Does the reply's energy match the lead's? Brief inbound → brief reply. Detailed/curious inbound → engaged reply. Avoid over-formal stiffness or over-casual chumminess.
4. **No hallucinated facts (0–25)**: Every specific fact in the draft (address, DOB, phone, dollar amount, named person, date) MUST be grounded in either (a) the Resolved facts list, (b) the template text, or (c) the lead's original message. Any specific value not grounded in one of those three is a high-severity hallucination — deduct heavily and flag in issues.

For each axis, deduct points generously when issues are present. A draft that is correct but uninspired should land in the 70s. A draft with a hallucinated fact should land below 65 (auto-reject). A draft that nails personalization and tone with zero issues lands 90+.

Output STRICT JSON only — no prose before or after, no markdown code fences:

{
  "score": <0-100 integer>,
  "verdict": "auto_send" | "review" | "reject",
  "reasoning": "<one or two sentences>",
  "issues": [
    {"type": "<short_id>", "severity": "low|medium|high", "detail": "<one sentence>"}
  ]
}

Verdict guidance (the caller may override):
  - "auto_send" if score >= 90 AND no high-severity issues
  - "review"   if 65 <= score < 90 OR any high-severity issue
  - "reject"   if score < 65`;

interface AuditPayload {
  lead_reply_uuid: string;
  generated_reply_text: string;
  cc_emails?: string[];
  original_message: string;
  template_text: string;
  // Optional raw custom_variables blob (legacy field — superseded by placeholder_values).
  custom_variables?: Record<string, unknown> | unknown[] | null;
  placeholders_resolved?: string[];
  placeholders_missing?: string[];
  // NEW: the (placeholder_name → resolved_value) map. THIS IS THE GROUND TRUTH the
  // auditor uses to verify that specific facts in the draft (addresses, phones, etc.)
  // come from a real source rather than being invented by the drafter.
  placeholder_values?: Record<string, string>;
  workspace_name: string;
}

function buildUserPrompt(p: AuditPayload): string {
  // Build the "Resolved facts" section. Prefer placeholder_values (the authoritative
  // key→value map). Fall back to a hint about names-only if values weren't passed.
  let resolvedFactsSection: string;
  if (p.placeholder_values && Object.keys(p.placeholder_values).length > 0) {
    const lines = Object.entries(p.placeholder_values).map(
      ([k, v]) => `- ${k}: ${v}`
    );
    resolvedFactsSection = lines.join('\n');
  } else if (p.placeholders_resolved && p.placeholders_resolved.length > 0) {
    resolvedFactsSection = `(values not provided — only field names: ${p.placeholders_resolved.join(', ')})\n` +
      `WARNING: caller did not pass placeholder_values. You cannot verify specific facts; treat any specific PII in the draft as suspect.`;
  } else {
    resolvedFactsSection = '(no placeholders were resolved — the drafter had no personal data to use)';
  }

  return `## Workspace
${p.workspace_name}

## Original lead message
"""
${p.original_message}
"""

## Workspace template (foundation the draft was built from)
"""
${p.template_text}
"""

## Resolved facts (the AUTHORITATIVE list of personal-info values the drafter could use)
${resolvedFactsSection}

## Placeholders missing (drafter was instructed to drop sentences using these)
[${(p.placeholders_missing ?? []).join(', ')}]

## CC recipients on this draft
${(p.cc_emails ?? []).join(', ') || '(none)'}

## AI-drafted reply (the thing you're auditing)
"""
${p.generated_reply_text}
"""

Return your audit JSON now. Remember: any specific fact in the draft that isn't in Resolved facts, the template, or the lead's original message is a hallucination — flag it as high severity.`;
}

function parseAuditJson(raw: string): { score: number; verdict: string; reasoning: string; issues: AuditIssue[] } | null {
  // Strip markdown fences if present.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    const obj = JSON.parse(cleaned);
    if (typeof obj.score !== 'number' || typeof obj.verdict !== 'string') return null;
    return {
      score: Math.max(0, Math.min(100, Math.round(obj.score))),
      verdict: obj.verdict,
      reasoning: typeof obj.reasoning === 'string' ? obj.reasoning : '',
      issues: Array.isArray(obj.issues) ? obj.issues.filter((i: unknown) => i && typeof i === 'object') : [],
    };
  } catch (_) {
    return null;
  }
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
    const payload = (await req.json()) as AuditPayload;
    if (!payload.generated_reply_text || !payload.original_message || !payload.template_text) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // === Stage 1: hard rules ===
    const hardRuleResult = runHardRules({
      generatedReplyText: payload.generated_reply_text,
      ccEmails: payload.cc_emails ?? [],
      placeholdersMissing: payload.placeholders_missing ?? [],
    });
    if (hardRuleResult) {
      console.log(`🛑 Hard-rule rejection for ${payload.lead_reply_uuid}: ${hardRuleResult.reasoning}`);
      return new Response(JSON.stringify({ success: true, audit: hardRuleResult }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // === Stage 2: LLM judge ===
    console.log(`🔍 Auditing reply ${payload.lead_reply_uuid} with ${AUDIT_MODEL}`);
    const userPrompt = buildUserPrompt(payload);

    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AUDIT_MODEL,
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!claudeResp.ok) {
      const errText = await claudeResp.text();
      console.error(`Claude audit error (status=${claudeResp.status}): ${errText}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'audit_llm_error',
        status: claudeResp.status,
        detail: errText.slice(0, 500),
      }), { status: 502, headers: corsHeaders });
    }

    const claudeData = await claudeResp.json();
    const rawText: string = claudeData?.content?.[0]?.text ?? '';
    const parsed = parseAuditJson(rawText);

    if (!parsed) {
      // Fail closed: if the audit model returned unparseable output, escalate
      // to review rather than auto-sending.
      console.error(`Audit LLM returned unparseable JSON: ${rawText.slice(0, 500)}`);
      const fallback: AuditResult = {
        score: 50,
        verdict: 'review',
        reasoning: 'Audit model returned unparseable JSON — escalating to human review.',
        issues: [{ type: 'audit_parse_failure', severity: 'high', detail: rawText.slice(0, 200) }],
        model: AUDIT_MODEL,
      };
      return new Response(JSON.stringify({ success: true, audit: fallback }), { status: 200, headers: corsHeaders });
    }

    // Normalize verdict to one of our three values; default unknown to 'review'.
    const allowedVerdicts: Array<AuditResult['verdict']> = ['auto_send', 'review', 'reject'];
    const verdict = allowedVerdicts.includes(parsed.verdict as AuditResult['verdict'])
      ? (parsed.verdict as AuditResult['verdict'])
      : 'review';

    const result: AuditResult = {
      score: parsed.score,
      verdict,
      reasoning: parsed.reasoning,
      issues: (parsed.issues as AuditIssue[]) ?? [],
      model: AUDIT_MODEL,
    };

    console.log(`✅ Audit complete: score=${result.score} verdict=${result.verdict} issues=${result.issues.length}`);

    return new Response(JSON.stringify({ success: true, audit: result }), { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error('audit-ai-reply error:', e);
    return new Response(JSON.stringify({ success: false, error: e?.message || 'unknown' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
