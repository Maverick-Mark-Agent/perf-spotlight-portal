// AI Reply Generation Edge Function
//
// Generates personalized replies using:
//   - The workspace's reply template (with/without phone variant)
//   - Full conversation history for the lead
//   - The latest reply's sentiment classification (from the webhook AI pass)
//   - Lead master metadata from client_leads
//   - Lead's full custom_variables from Bison (address, DOB, renewal, home value, etc.)
//     so templates can reference {full_address}, {dob}, {street_address}, {city}, {state},
//     {zip}, {renewal_date}, {home_value} and have them substituted with real data
//   - special_instructions from the template (workspace-specific guidance for the AI)
//
// Model is env-driven (ANTHROPIC_REPLY_MODEL) so rotation is one secret update, not a redeploy.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAVERICK_BISON_API_KEY = Deno.env.get('MAVERICK_BISON_API_KEY');
const LONG_RUN_BISON_API_KEY = Deno.env.get('LONG_RUN_BISON_API_KEY');

// Model is env-driven so rotation = one secret update, not a redeploy.
const REPLY_MODEL = Deno.env.get('ANTHROPIC_REPLY_MODEL') || 'claude-haiku-4-5-20251001';

// Cap on a single prior reply's body in the prompt.
const MAX_REPLY_CHARS = 10_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// Look up a custom_variable by any of several name aliases (case-insensitive,
// also tolerates spaces vs underscores). Returns null if none match or empty.
function getCustomVar(customVariables: any[] | null | undefined, ...names: string[]): string | null {
  if (!Array.isArray(customVariables)) return null;
  const norm = (s: string) => (s || '').toLowerCase().replace(/[\s_]+/g, ' ').trim();
  for (const name of names) {
    const target = norm(name);
    const variable = customVariables.find((v: any) => norm(v?.name) === target);
    const value = variable?.value;
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return null;
}

interface PlaceholderMap {
  [key: string]: string | null;
}

// Build a normalized placeholder map from custom_variables + request params.
// Keys are lowercase, values are either the resolved string or null when missing.
// Aliases share the same value (e.g., {dob}, {date_of_birth}, {birthday} all resolve the same way).
function buildPlaceholderMap(opts: {
  firstName: string;
  leadEmail: string;
  leadPhone: string | null;
  customVariables: any[] | null;
}): PlaceholderMap {
  const cv = opts.customVariables;
  const street = getCustomVar(cv, 'street_address', 'street address', 'address');
  const city = getCustomVar(cv, 'city');
  const state = getCustomVar(cv, 'state');
  const zip = getCustomVar(cv, 'zip', 'postal_code', 'zip code', 'zipcode');
  const dob = getCustomVar(cv, 'date_of_birth', 'date of birth', 'dob', 'birthday', 'birth_date');
  const renewal = getCustomVar(cv, 'renewal_date', 'renewal date', 'renewal', 'renewal_month');
  const homeValue = getCustomVar(cv, 'home_value', 'home value', 'property_value', 'property value');
  const income = getCustomVar(cv, 'income');
  const phone = opts.leadPhone || getCustomVar(cv, 'phone_number', 'phone number', 'phone', 'cell', 'mobile', 'cellphone', 'cell phone');

  // Stitch a full address — only include parts we have, comma-separated.
  const fullAddress = [street, city, state, zip].filter(Boolean).join(', ') || null;
  const cityStateZip = [city, state, zip].filter(Boolean).join(', ') || null;

  return {
    first_name: opts.firstName,
    lead_email: opts.leadEmail,
    full_address: fullAddress,
    address: street,
    street_address: street,
    street: street,
    city: city,
    state: state,
    zip: zip,
    zipcode: zip,
    zip_code: zip,
    city_state_zip: cityStateZip,
    dob: dob,
    date_of_birth: dob,
    birthday: dob,
    birth_date: dob,
    phone: phone,
    phone_number: phone,
    cell: phone,
    mobile: phone,
    renewal: renewal,
    renewal_date: renewal,
    renewal_month: renewal,
    home_value: homeValue,
    property_value: homeValue,
    income: income,
  };
}

// Substitute {placeholder} tokens in template text. Matched keys are
// case-insensitive. Missing values are replaced with a clear "(please confirm
// — not on file)" so the LLM understands the field is unknown and can phrase
// it naturally (or omit the line).
function substitutePlaceholders(text: string, map: PlaceholderMap): { result: string; resolved: string[]; missing: string[] } {
  const resolved: string[] = [];
  const missing: string[] = [];
  const result = text.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, rawKey) => {
    const key = rawKey.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      const value = map[key];
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        resolved.push(rawKey);
        return String(value);
      }
      missing.push(rawKey);
      // Sentinel that the LLM can recognize and handle gracefully.
      return '(not on file — please confirm)';
    }
    // Unknown placeholder — leave as-is so the LLM can decide what to do.
    missing.push(rawKey);
    return match;
  });
  return { result, resolved, missing };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const requestData = await req.json();
    const {
      reply_uuid,
      workspace_name,
      lead_name,
      lead_email,
      lead_phone,
      original_message,
      preview_mode = false,
      // Optional redraft inputs — when both present, the prompt picks up a
      // "Reviewer feedback" section and the model regenerates with feedback.
      previous_draft,
      feedback,
    } = requestData;
    const isRedraft = typeof feedback === 'string' && feedback.trim().length > 0;

    console.log(`📧 Generating AI reply for ${workspace_name} - ${lead_name} (model=${REPLY_MODEL}${isRedraft ? ', REDRAFT with feedback' : ''})`);

    if (!ANTHROPIC_API_KEY) {
      console.error('Missing ANTHROPIC_API_KEY');
      return new Response(JSON.stringify({ success: false, error: 'AI service not configured' }), { status: 500, headers: corsHeaders });
    }

    // === Parallel context fetch ===
    // 1. Template for this workspace (incl. special_instructions)
    // 2. Current reply's sentiment fields + bison_lead_id (needed to fetch custom_variables)
    // 3. Full thread history for this lead
    // 4. Lead master record from client_leads for richer metadata
    // 5. Workspace config for Bison API access
    const [templateResult, currentReplyResult, threadResult, leadResult, workspaceResult] = await Promise.all([
      supabase.from('reply_templates').select('*').eq('workspace_name', workspace_name).single(),
      supabase.from('lead_replies').select('sentiment, ai_reasoning, confidence_score, sentiment_source, bison_lead_id').eq('id', reply_uuid).maybeSingle(),
      supabase.from('lead_replies').select('reply_text, reply_date, sentiment, is_interested').eq('lead_email', lead_email).eq('workspace_name', workspace_name).neq('id', reply_uuid).order('reply_date', { ascending: true }),
      supabase.from('client_leads').select('company, title, pipeline_stage, interested, interested_at').eq('lead_email', lead_email).eq('workspace_name', workspace_name).maybeSingle(),
      supabase.from('client_registry').select('bison_api_key, bison_instance, bison_workspace_id').eq('workspace_name', workspace_name).maybeSingle(),
    ]);

    const template = templateResult.data;
    if (templateResult.error || !template) {
      console.error('Template not found:', templateResult.error);
      return new Response(JSON.stringify({ success: false, error: `No template found for workspace: ${workspace_name}` }), { status: 404, headers: corsHeaders });
    }

    const currentSentiment = currentReplyResult.data || {};
    const bisonLeadId = currentReplyResult.data?.bison_lead_id ?? null;
    const priorReplies = (threadResult.data || []).map((r: any) => ({
      ...r,
      reply_text: (r.reply_text || '').slice(0, MAX_REPLY_CHARS),
    }));
    const leadMeta: any = leadResult.data || {};
    const workspaceConfig: any = workspaceResult.data || {};

    // === Fetch lead's custom_variables from Bison API ===
    // We need this to substitute {full_address}, {dob}, etc. in the template.
    // Use the workspace's API key, fall back to the global Maverick key if needed.
    let customVariables: any[] | null = null;
    if (bisonLeadId) {
      const isLongRun = workspaceConfig.bison_instance === 'Long Run';
      const baseUrl = isLongRun ? 'https://send.longrun.agency/api' : 'https://send.maverickmarketingllc.com/api';
      const apiKey = workspaceConfig.bison_api_key || (isLongRun ? LONG_RUN_BISON_API_KEY : MAVERICK_BISON_API_KEY);
      if (apiKey) {
        try {
          const resp = await fetch(`${baseUrl}/leads/${bisonLeadId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json',
            },
          });
          if (resp.ok) {
            const body = await resp.json();
            customVariables = body?.data?.custom_variables ?? null;
            console.log(`✅ Fetched ${Array.isArray(customVariables) ? customVariables.length : 0} custom_variables from Bison for lead ${bisonLeadId}`);
          } else {
            console.warn(`⚠️ Bison /leads/${bisonLeadId} returned ${resp.status} — proceeding without custom_variables`);
          }
        } catch (e) {
          console.warn(`⚠️ Failed to fetch lead from Bison:`, e);
        }
      } else {
        console.warn(`⚠️ No Bison API key available for ${workspace_name} — skipping custom_variables fetch`);
      }
    } else {
      console.warn(`⚠️ No bison_lead_id on lead_replies — cannot fetch custom_variables`);
    }

    console.log(
      `✅ Context: ${priorReplies.length} prior replies, lead_meta=${!!leadResult.data}, ` +
      `current_sentiment=${currentSentiment.sentiment ?? 'none'}, custom_vars=${customVariables?.length ?? 0}`
    );

    // === Pick template variant + substitute placeholders ===
    const hasPhone = !!(lead_phone && lead_phone.trim().length > 0);
    const templateText = hasPhone ? template.template_text_with_phone : template.template_text_no_phone;

    const rawFirst = (lead_name || '').split(' ')[0] || '';
    const firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase();

    const placeholderMap = buildPlaceholderMap({
      firstName,
      leadEmail: lead_email,
      leadPhone: lead_phone || null,
      customVariables,
    });

    const { result: processedTemplate, resolved: resolvedPlaceholders, missing: missingPlaceholders } = substitutePlaceholders(templateText, placeholderMap);
    console.log(`📝 Template placeholders — resolved: [${resolvedPlaceholders.join(', ')}], missing: [${missingPlaceholders.join(', ')}]`);

    // === Build system + user prompt ===
    const systemPrompt = `You are a professional email assistant helping insurance agents reply to interested leads on behalf of ${workspace_name}.

Your task: use the provided template as the foundation and make minor adjustments so the reply feels natural and personalized to the lead's most recent message and the broader conversation history.

CRITICAL — ANTI-HALLUCINATION RULES (violating any of these is a failed reply):
- NEVER invent or guess specific facts: addresses, phone numbers, dates of birth, agent names, dollar amounts, dates, or any personally identifiable information.
- The ONLY facts you may state are: (a) facts present in the template after substitution, (b) facts in the lead's "On-file details" section, or (c) facts the lead themselves wrote in this thread.
- If a {placeholder} comes through as "(not on file — please confirm)" or as the literal {placeholder} text, you MUST drop the entire surrounding sentence. Do NOT improvise a value, do NOT rephrase to fill the gap with invented content. Better to send a shorter, less specific reply than one with a fabricated detail.
- NAME CONSISTENCY: If the lead signed their email with a different name than the database "first_name" (e.g. database says "James" but they signed "Mike"), address them by the name THEY SIGNED WITH. The signature is the truth; the database may be stale.
- If you cannot construct a sentence without inventing a fact, omit the sentence and let the rest of the reply stand on its own.

Style rules:
- Keep all template details intact (phone numbers, agent names, signatures, CC routing) — but only if they came from the template, not invented.
- DO NOT add greetings like "Dear" or "Hi" at the start — the template already has the right opening (or the natural rephrasing should preserve its tone).
- DO NOT add a closing signature — the template already includes the signature.
- Keep the same structure and key information from the template.
- Make minor, natural adjustments only — do not rewrite the reply from scratch.
- Make it sound like a human wrote it, not a robot.
- Reference prior conversation context where natural; otherwise stay close to the template.
- Output the reply email body only, with no preamble or explanation.`;

    const sections: string[] = [];

    // Lead profile
    sections.push(`## Lead profile
- Name: ${lead_name}
- Email: ${lead_email}
- Company: ${leadMeta.company || 'unknown'}
- Title: ${leadMeta.title || 'unknown'}
- Phone on file: ${lead_phone || 'none'}
- Pipeline stage: ${leadMeta.pipeline_stage || 'unknown'}
- Interested flag: ${leadMeta.interested ?? 'unknown'}${leadMeta.interested_at ? ` (since ${leadMeta.interested_at})` : ''}`);

    // On-file details from Bison custom_variables
    const detailsLines: string[] = [];
    if (placeholderMap.full_address) detailsLines.push(`- Full address: ${placeholderMap.full_address}`);
    else if (placeholderMap.street_address || placeholderMap.city || placeholderMap.state || placeholderMap.zip) {
      if (placeholderMap.street_address) detailsLines.push(`- Street: ${placeholderMap.street_address}`);
      if (placeholderMap.city) detailsLines.push(`- City: ${placeholderMap.city}`);
      if (placeholderMap.state) detailsLines.push(`- State: ${placeholderMap.state}`);
      if (placeholderMap.zip) detailsLines.push(`- ZIP: ${placeholderMap.zip}`);
    }
    if (placeholderMap.dob) detailsLines.push(`- Date of birth: ${placeholderMap.dob}`);
    if (placeholderMap.phone_number) detailsLines.push(`- Phone: ${placeholderMap.phone_number}`);
    if (placeholderMap.renewal_date) detailsLines.push(`- Renewal date: ${placeholderMap.renewal_date}`);
    if (placeholderMap.home_value) detailsLines.push(`- Home value: ${placeholderMap.home_value}`);
    if (placeholderMap.income) detailsLines.push(`- Income code: ${placeholderMap.income}`);

    if (detailsLines.length > 0) {
      sections.push(`## On-file details (from Bison custom_variables)
${detailsLines.join('\n')}`);
    } else {
      sections.push(`## On-file details
(No custom variables available for this lead — proceed using template defaults.)`);
    }

    // Workspace-specific instructions
    if (template.special_instructions) {
      sections.push(`## Workspace-specific instructions
${template.special_instructions}`);
    }

    // Conversation history
    if (priorReplies.length > 0) {
      const historyLines = priorReplies.map((r: any, i: number) => {
        const sentiment = r.sentiment || 'unclassified';
        return `[Reply ${i + 1} — ${r.reply_date} — sentiment=${sentiment}]\n${r.reply_text || '(no text)'}`;
      }).join('\n\n');
      sections.push(`## Conversation history (${priorReplies.length} prior repl${priorReplies.length === 1 ? 'y' : 'ies'}, oldest first)
${historyLines}`);
    } else {
      sections.push(`## Conversation history
(This is the first reply from this lead — no prior history.)`);
    }

    // Sentiment classification of the latest reply
    sections.push(`## Sentiment classification of the latest reply
- Sentiment: ${currentSentiment.sentiment || 'unclassified'}
- AI reasoning: ${currentSentiment.ai_reasoning || 'none'}
- Confidence: ${currentSentiment.confidence_score ?? 'unknown'}%
- Source: ${currentSentiment.sentiment_source || 'unknown'}`);

    // The latest reply being responded to
    sections.push(`## Latest reply (the one you're responding to)
"${original_message}"`);

    // Template (with placeholders already substituted)
    sections.push(`## Template to adapt (placeholders already filled with on-file data)
"""
${processedTemplate}
"""`);

    // Reviewer feedback (redraft path only) — appears AFTER all grounding
    // context so the anti-hallucination rules above remain in effect.
    if (isRedraft) {
      const feedbackTrimmed = String(feedback).slice(0, 2000);
      const previousTrimmed = String(previous_draft ?? '').slice(0, MAX_REPLY_CHARS);
      sections.push(`## Reviewer feedback (this is a redraft)
A previous draft was generated and reviewed by a human. They asked for it to be redone with this feedback:

"${feedbackTrimmed}"

Previous draft (for context — DO NOT just repeat it; address the feedback):
"""
${previousTrimmed}
"""

Generate a NEW reply that addresses the reviewer's feedback while still following all template, grounding, and anti-hallucination rules above. The reviewer's feedback supersedes the AI's prior choices on tone, phrasing, or content selection — but does NOT override the rule against fabricating facts. If the reviewer asks you to use information that isn't in the resolved facts, the original message, the conversation thread, or the lead's signature, refuse and stick to the grounded sources.`);
    }

    sections.push(`Generate the reply email body now.`);

    const userPrompt = sections.join('\n\n');
    console.log(`🤖 Calling ${REPLY_MODEL} (user prompt: ${userPrompt.length} chars)`);

    // === Call Claude ===
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: REPLY_MODEL,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error(`❌ Claude API error (status=${claudeResponse.status}, model=${REPLY_MODEL}):`, errorText);
      return new Response(JSON.stringify({
        success: false,
        error: 'AI generation failed',
        details: errorText,
        status: claudeResponse.status,
        model: REPLY_MODEL,
      }), { status: 500, headers: corsHeaders });
    }

    const claudeData = await claudeResponse.json();
    const generatedReply = claudeData.content[0].text;
    console.log(`✅ AI reply generated (model=${REPLY_MODEL}, ${generatedReply.length} chars)`);

    // === Save unless preview ===
    if (!preview_mode) {
      const { error: saveError } = await supabase.from('sent_replies').insert({
        reply_uuid,
        workspace_name,
        lead_name,
        lead_email,
        generated_reply_text: generatedReply,
        cc_emails: template.cc_emails,
        status: 'generated',
        sent_by: 'ai_system',
      });
      if (saveError) {
        console.error('Error saving generated reply:', saveError);
      } else {
        console.log(`💾 Generated reply saved to database`);
      }
    }

    // Build a (placeholder_name → resolved_value) map for downstream auditing.
    // Only includes keys that had a real value substituted — this is the
    // "ground truth" the audit uses to distinguish legitimate personalization
    // from invention. Key names are the original casing from the template.
    const placeholderValues: Record<string, string> = {};
    for (const key of resolvedPlaceholders) {
      const v = placeholderMap[key.toLowerCase()];
      if (v != null && String(v).trim() !== '') {
        placeholderValues[key] = String(v);
      }
    }

    // Compact thread snapshot — same data the drafter used, returned so the
    // auditor can verify draft facts against earlier turns (e.g. renewal
    // dates that came up in prior agent outreach which the lead's reply quoted).
    const threadHistory = priorReplies.map((r: any) => ({
      reply_date: r.reply_date,
      reply_text: r.reply_text || '',
      sentiment: r.sentiment ?? null,
    }));

    return new Response(JSON.stringify({
      success: true,
      generated_reply: generatedReply,
      cc_emails: template.cc_emails,
      template_used: hasPhone ? 'with_phone' : 'no_phone',
      model_used: REPLY_MODEL,
      thread_replies_included: priorReplies.length,
      thread_history: threadHistory,
      placeholders_resolved: resolvedPlaceholders,
      placeholders_missing: missingPlaceholders,
      placeholder_values: placeholderValues,
      custom_variables_count: customVariables?.length ?? 0,
    }), { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error('Error generating AI reply:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error',
    }), { status: 500, headers: corsHeaders });
  }
});
