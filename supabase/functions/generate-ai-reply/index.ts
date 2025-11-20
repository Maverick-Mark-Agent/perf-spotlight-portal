// AI Reply Generation Edge Function
// Uses Claude 3.5 Sonnet to generate personalized replies based on templates

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface GenerateReplyRequest {
  reply_uuid: string;
  workspace_name: string;
  lead_name: string;
  lead_email: string;
  lead_phone?: string;
  original_message: string;
  preview_mode?: boolean; // If true, don't save to sent_replies
}

interface GenerateReplyResponse {
  success: boolean;
  generated_reply: string;
  cc_emails: string[];
  template_used: 'with_phone' | 'no_phone';
  error?: string;
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body
    const requestData: GenerateReplyRequest = await req.json();
    const {
      reply_uuid,
      workspace_name,
      lead_name,
      lead_email,
      lead_phone,
      original_message,
      preview_mode = false
    } = requestData;

    console.log(`📧 Generating AI reply for ${workspace_name} - ${lead_name}`);

    // Step 1: Fetch template for this workspace
    const { data: template, error: templateError } = await supabase
      .from('reply_templates')
      .select('*')
      .eq('workspace_name', workspace_name)
      .single();

    if (templateError || !template) {
      console.error('Template not found:', templateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `No template found for workspace: ${workspace_name}`
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`✅ Found template for ${workspace_name}`);

    // Step 2: Determine which template to use (with or without phone)
    const hasPhone = lead_phone && lead_phone.trim().length > 0;
    const templateText = hasPhone
      ? template.template_text_with_phone
      : template.template_text_no_phone;

    console.log(`📝 Using template variant: ${hasPhone ? 'with_phone' : 'no_phone'}`);

    // Step 3: Replace placeholders in template
    let processedTemplate = templateText;

    // Replace {first_name} with actual first name
    const firstName = lead_name.split(' ')[0];
    processedTemplate = processedTemplate.replace(/{first_name}/g, firstName);

    // Replace {phone_number} if present
    if (hasPhone && lead_phone) {
      processedTemplate = processedTemplate.replace(/{phone_number}/g, lead_phone);
    }

    console.log(`📄 Template processed with placeholders replaced`);

    // Step 4: Call Claude API to generate personalized reply
    if (!ANTHROPIC_API_KEY) {
      console.error('Missing ANTHROPIC_API_KEY');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'AI service not configured'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`🤖 Calling Claude 3.5 Sonnet API...`);

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `You are a professional email assistant helping insurance agents reply to interested leads.

Context:
- Lead Name: ${lead_name}
- Lead Email: ${lead_email}
- Lead's Original Message: "${original_message}"

Template to use as a base:
"""
${processedTemplate}
"""

Instructions:
1. Use the template above as the foundation
2. Keep the tone professional, friendly, and conversational
3. Maintain all important details (phone numbers, office numbers, names of agents to CC)
4. Make minor adjustments to sound natural and personalized to the lead's original message
5. Do NOT add greetings like "Dear" or "Hi" at the start - the template already has the right opening
6. Do NOT add a closing signature - the template already includes the signature
7. Keep the same structure and key information from the template
8. Make it sound like a human wrote it, not a robot

Generate the reply email body now:`
          }
        ]
      })
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API error:', errorText);
      console.error('Claude API status:', claudeResponse.status);

      // Return detailed error for debugging
      return new Response(
        JSON.stringify({
          success: false,
          error: 'AI generation failed',
          details: errorText,
          status: claudeResponse.status,
          api_key_set: !!ANTHROPIC_API_KEY
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    const claudeData = await claudeResponse.json();
    const generatedReply = claudeData.content[0].text;

    console.log(`✅ AI reply generated successfully`);

    // Step 5: Save to sent_replies table (unless preview mode)
    if (!preview_mode) {
      const { error: saveError } = await supabase
        .from('sent_replies')
        .insert({
          reply_uuid,
          workspace_name,
          lead_name,
          lead_email,
          generated_reply_text: generatedReply,
          cc_emails: template.cc_emails,
          status: 'generated', // Not sent yet, just generated
          sent_by: 'ai_system'
        });

      if (saveError) {
        console.error('Error saving generated reply:', saveError);
        // Don't fail the request, just log it
      } else {
        console.log(`💾 Generated reply saved to database`);
      }
    }

    // Step 6: Return response
    const response: GenerateReplyResponse = {
      success: true,
      generated_reply: generatedReply,
      cc_emails: template.cc_emails,
      template_used: hasPhone ? 'with_phone' : 'no_phone'
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );

  } catch (error: any) {
    console.error('Error generating AI reply:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});
