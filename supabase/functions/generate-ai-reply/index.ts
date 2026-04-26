// AI Reply Generation Edge Function
//
// Generates personalized replies using:
//   - The workspace's reply template (with/without phone variant)
//   - Full conversation history for the lead (no count cap; truncate individual replies > MAX_REPLY_CHARS)
//   - The latest reply's sentiment classification (from the webhook AI pass)
//   - Lead master metadata from client_leads (company, title, pipeline_stage, etc.)
//
// Model is env-driven (ANTHROPIC_REPLY_MODEL) so rotation is one secret update, not a redeploy.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Model is env-driven so rotation = one secret update, not a redeploy.
// Defaults to Haiku 4.5 if the secret is unset.
const REPLY_MODEL = Deno.env.get('ANTHROPIC_REPLY_MODEL') || 'claude-haiku-4-5-20251001';

// Cap on a single prior reply's body in the prompt. Guards against forwarded
// threads / signature dumps blowing up token counts. No cap on the number of replies.
const MAX_REPLY_CHARS = 10_000;

interface GenerateReplyRequest {
  reply_uuid: string;
  workspace_name: string;
  lead_name: string;
  lead_email: string;
  lead_phone?: string;
  original_message: string;
  preview_mode?: boolean;
}

interface GenerateReplyResponse {
  success: boolean;
  generated_reply: string;
  cc_emails: string[];
  template_used: 'with_phone' | 'no_phone';
  model_used: string;
  thread_replies_included: number;
  error?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const requestData: GenerateReplyRequest = await req.json();
    const {
      reply_uuid,
      workspace_name,
      lead_name,
      lead_email,
      lead_phone,
      original_message,
      preview_mode = false,
    } = requestData;

    console.log(`📧 Generating AI reply for ${workspace_name} - ${lead_name} (model=${REPLY_MODEL})`);

    if (!ANTHROPIC_API_KEY) {
      console.error('Missing ANTHROPIC_API_KEY');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: corsHeaders },
      );
    }

    // === Parallel context fetch ===
    // 1. Template for this workspace
    // 2. Current reply's sentiment fields (set by universal-bison-webhook)
    // 3. Full thread history for this lead (chronological, oldest first)
    // 4. Lead master record from client_leads for richer metadata
    const [templateResult, currentReplyResult, threadResult, leadResult] = await Promise.all([
      supabase
        .from('reply_templates')
        .select('*')
        .eq('workspace_name', workspace_name)
        .single(),
      supabase
        .from('lead_replies')
        .select('sentiment, ai_reasoning, confidence_score, sentiment_source')
        .eq('id', reply_uuid)
        .maybeSingle(),
      supabase
        .from('lead_replies')
        .select('reply_text, reply_date, sentiment, is_interested')
        .eq('lead_email', lead_email)
        .eq('workspace_name', workspace_name)
        .neq('id', reply_uuid)
        .order('reply_date', { ascending: true }),
      supabase
        .from('client_leads')
        .select('company, title, pipeline_stage, interested, interested_at')
        .eq('lead_email', lead_email)
        .eq('workspace_name', workspace_name)
        .maybeSingle(),
    ]);

    const template = templateResult.data;
    if (templateResult.error || !template) {
      console.error('Template not found:', templateResult.error);
      return new Response(
        JSON.stringify({ success: false, error: `No template found for workspace: ${workspace_name}` }),
        { status: 404, headers: corsHeaders },
      );
    }

    const currentSentiment = currentReplyResult.data || {};
    const priorReplies = (threadResult.data || []).map((r: any) => ({
      ...r,
      reply_text: (r.reply_text || '').slice(0, MAX_REPLY_CHARS),
    }));
    const leadMeta: any = leadResult.data || {};

    console.log(
      `✅ Context fetched: ${priorReplies.length} prior replies, ` +
      `lead_meta=${!!leadResult.data}, current_sentiment=${currentSentiment.sentiment ?? 'none'}`
    );

    // === Pick template variant + substitute placeholders ===
    const hasPhone = !!(lead_phone && lead_phone.trim().length > 0);
    const templateText = hasPhone
      ? template.template_text_with_phone
      : template.template_text_no_phone;

    let processedTemplate = templateText;
    const rawFirst = (lead_name || '').split(' ')[0] || '';
    const firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase();
    processedTemplate = processedTemplate.replace(/{first_name}/g, firstName);
    if (hasPhone && lead_phone) {
      processedTemplate = processedTemplate.replace(/{phone_number}/g, lead_phone);
    }

    // === Build system + user prompt ===
    const systemPrompt = `You are a professional email assistant helping insurance agents reply to interested leads on behalf of ${workspace_name}.

Your task: use the provided template as the foundation and make minor adjustments so the reply feels natural and personalized to the lead's most recent message and the broader conversation history.

Rules:
- Keep all template details intact (phone numbers, agent names, signatures, CC routing).
- DO NOT add greetings like "Dear" or "Hi" at the start — the template already has the right opening.
- DO NOT add a closing signature — the template already includes the signature.
- Keep the same structure and key information from the template.
- Make minor, natural adjustments only — do not rewrite the reply.
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

    // Conversation history
    if (priorReplies.length > 0) {
      const historyLines = priorReplies
        .map((r: any, i: number) => {
          const sentiment = r.sentiment || 'unclassified';
          return `[Reply ${i + 1} — ${r.reply_date} — sentiment=${sentiment}]\n${r.reply_text || '(no text)'}`;
        })
        .join('\n\n');
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

    // Template
    sections.push(`## Template to adapt
"""
${processedTemplate}
"""`);

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
        messages: [
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error(`❌ Claude API error (status=${claudeResponse.status}, model=${REPLY_MODEL}):`, errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'AI generation failed',
          details: errorText,
          status: claudeResponse.status,
          model: REPLY_MODEL,
        }),
        { status: 500, headers: corsHeaders },
      );
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
        // Don't fail the request — generation succeeded
      } else {
        console.log(`💾 Generated reply saved to database`);
      }
    }

    const response: GenerateReplyResponse = {
      success: true,
      generated_reply: generatedReply,
      cc_emails: template.cc_emails,
      template_used: hasPhone ? 'with_phone' : 'no_phone',
      model_used: REPLY_MODEL,
      thread_replies_included: priorReplies.length,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error: any) {
    console.error('Error generating AI reply:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Unknown error' }),
      { status: 500, headers: corsHeaders },
    );
  }
});
