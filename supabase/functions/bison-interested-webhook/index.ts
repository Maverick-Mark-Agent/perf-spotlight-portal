import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  event: {
    type: string;
    name: string;
    instance_url: string;
    workspace_id: number;
    workspace_name: string;
  };
  data: {
    lead: {
      id: number;
      email: string;
      first_name: string | null;
      last_name: string | null;
      status: string;
      title: string | null;
      company: string | null;
      custom_variables: Array<{name: string; value: string}> | null;
    };
    reply: {
      id: number;
      uuid: string;
      date_received: string;
      from_name: string | null;
      from_email_address: string;
    };
    campaign: {
      id: number;
      name: string;
    };
    sender_email: {
      id: number;
      email: string;
      name: string;
    };
  };
}

async function cleanReplyWithAI(emailBody: string): Promise<string> {
  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!openaiApiKey) {
      console.warn('OpenAI API key not configured, using raw reply text')
      return emailBody.substring(0, 200) + (emailBody.length > 200 ? '...' : '')
    }

    const prompt = `You are an email content extraction specialist. Your task is to extract ONLY the main message content from email replies, removing all metadata, signatures, formatting, and special characters.

EXTRACTION RULES:
1. Extract only the actual message the sender intended to communicate
2. Remove ALL of the following:
   - Email signatures (names, titles, company info)
   - Contact information (emails, phone numbers, addresses)
   - Unsubscribe links and text
   - Email headers (From, To, Date, Subject lines)
   - Quoted/previous email threads (anything after phrases like "On [date]", "wrote:", "--Original Message--")
   - Auto-generated footers
   - Legal disclaimers
   - Social media links
   - Website URLs (unless specifically mentioned as part of the actual message)
   - Greeting lines if they're just "Hi [Name]" or similar
   - Sign-offs (Thanks, Best regards, Sincerely, etc.)
   - Marketing taglines
   - Special characters like \\n, \\t, \\r, <, >, /, \\, quotation marks, etc.
   - HTML tags or markup
   - Line breaks and extra whitespace

3. TEXT CLEANING:
   - Convert any remaining text to plain ASCII where possible
   - Replace multiple spaces with single spaces
   - Remove leading/trailing whitespace
   - Keep only standard punctuation (. , ! ? : ;)
   - Preserve numbers and basic letters

4. Output format:
   - Plain text only
   - NO explanations, headers, or meta-commentary
   - NO phrases like "Here is the extracted content:" or "The message says:"
   - Return ONLY the cleaned message text
   - If there's no meaningful content after extraction, return only: "No content"

CRITICAL: Return ONLY the extracted message. No additional text, formatting, or explanation.

Email to extract:
${emailBody}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const cleanedText = data.choices?.[0]?.message?.content?.trim() || emailBody

    // Limit to 200 characters for Agency Zoom notes
    return cleanedText.length > 200 ? cleanedText.substring(0, 200) + '...' : cleanedText
  } catch (error) {
    console.error('Error cleaning reply with AI:', error)
    // Fallback to simple truncation
    return emailBody.substring(0, 200) + (emailBody.length > 200 ? '...' : '')
  }
}

async function routeToExternalAPI(supabase: any, workspaceName: string, lead: any, reply: any, leadId: number) {
  try {
    // Get the external API configuration for this workspace
    const { data: client, error } = await supabase
      .from('client_registry')
      .select('external_api_url, external_api_token')
      .eq('workspace_name', workspaceName)
      .single()

    if (error || !client || !client.external_api_url) {
      // No external API configured for this workspace
      return
    }

    console.log(`📤 Routing lead to external API for ${workspaceName}: ${client.external_api_url}`)

    // Helper: Extract custom variable value
    const getCustomVar = (possibleNames: string[]) => {
      for (const name of possibleNames) {
        const variable = lead.custom_variables?.find((v: any) =>
          v.name?.toLowerCase() === name.toLowerCase()
        )
        if (variable?.value) {
          return variable.value
        }
      }
      return null
    }

    // Helper: Extract phone number
    const extractPhoneNumber = (customVariables: any[]) => {
      const phoneFieldNames = ['phone number', 'cell phone', 'cellphone', 'phone', 'mobile', 'cell', 'phone_number', 'company phone']

      for (const fieldName of phoneFieldNames) {
        const variable = customVariables?.find((v: any) =>
          v.name?.toLowerCase() === fieldName.toLowerCase()
        )
        if (variable?.value) {
          return variable.value
        }
      }

      return null
    }

    // Build the conversation URL
    const conversationUrl = reply?.uuid
      ? `https://send.maverickmarketingllc.com/inbox?reply_uuid=${reply.uuid}`
      : null

    // Clean the reply text using OpenAI
    // Note: bison-interested-webhook payload doesn't include reply body, so we'll use a simple note
    const replyText = reply?.from_email_address ? `Reply from ${reply.from_email_address}` : 'Interested lead from Email Bison'
    const cleanedReply = await cleanReplyWithAI(replyText)

    // Check if this is an Agency Zoom URL (requires special query param format)
    const isAgencyZoom = client.external_api_url.includes('agencyzoom.com')

    let response: Response

    if (isAgencyZoom) {
      // Agency Zoom expects query parameters, not JSON body
      const agencyZoomPayload = {
        firstname: lead.first_name || '',
        lastname: lead.last_name || '',
        email: lead.email || '',
        phone: extractPhoneNumber(lead.custom_variables) || '',
        notes: conversationUrl ? `${conversationUrl} - ${cleanedReply}` : cleanedReply,
        birthday: getCustomVar(['date of birth', 'dob', 'birthday', 'birth date']) || '',
        streetAddress: getCustomVar(['street address', 'address', 'street']) || '',
        city: getCustomVar(['city']) || '',
        state: getCustomVar(['state']) || '',
        zip: getCustomVar(['zip', 'zip code', 'zipcode']) || '',
        'expiration date': getCustomVar(['renewal', 'renewal date', 'policy renewal', 'expiry date']) || ''
      }

      // Build query string
      const queryParams = new URLSearchParams()
      Object.entries(agencyZoomPayload).forEach(([key, value]) => {
        if (value) {
          queryParams.append(key, value as string)
        }
      })

      // Send as POST with query parameters
      response = await fetch(`${client.external_api_url}?${queryParams.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
    } else {
      // Generic format for other CRMs (Zapier, etc.) - use JSON body
      const externalPayload: any = {
        first_name: lead.first_name || '',
        last_name: lead.last_name || '',
        email: lead.email || '',
        phone: extractPhoneNumber(lead.custom_variables) || '',
        company: lead.company || '',
        title: lead.title || '',
        address: getCustomVar(['street address', 'address', 'street']) || '',
        city: getCustomVar(['city']) || '',
        state: getCustomVar(['state']) || '',
        zip: getCustomVar(['zip', 'zip code', 'zipcode']) || '',
        date_of_birth: getCustomVar(['date of birth', 'dob', 'birthday', 'birth date']) || '',
        renewal_date: getCustomVar(['renewal', 'renewal date', 'policy renewal', 'expiry date']) || '',
        reply_text: cleanedReply,
        reply_date: reply?.date_received || new Date().toISOString(),
        conversation_url: conversationUrl,
        source: 'Bison Email Campaign',
        workspace: workspaceName,
        bison_lead_id: lead.id ? lead.id.toString() : null,
        interested: true,
        custom_variables: lead.custom_variables || []
      }

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      // Add authentication token if configured
      if (client.external_api_token) {
        headers['Authorization'] = `Bearer ${client.external_api_token}`
      }

      // Send to external API
      response = await fetch(client.external_api_url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(externalPayload)
      })
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ External API error for ${workspaceName}: ${response.status} ${response.statusText}`)
      console.error('Response body:', errorText)
      return
    }

    const result = await response.text()
    console.log(`✅ Lead successfully routed to external API for ${workspaceName}:`, result)

    // Update success timestamp on client_registry
    const { error: updateError } = await supabase
      .from('client_registry')
      .update({
        api_last_successful_call_at: new Date().toISOString(),
        api_consecutive_failures: 0,
        api_health_status: 'healthy',
        api_notes: 'External API integration working'
      })
      .eq('workspace_name', workspaceName)

    if (updateError) {
      console.error(`Error updating API health:`, updateError)
    }

    // Update external_api_sent_at on the lead record
    if (leadId) {
      const { error: leadUpdateError } = await supabase
        .from('client_leads')
        .update({
          external_api_sent_at: new Date().toISOString()
        })
        .eq('id', leadId)

      if (leadUpdateError) {
        console.error(`Error updating lead external_api_sent_at:`, leadUpdateError)
      } else {
        console.log(`✅ Updated external_api_sent_at for lead ${leadId}`)
      }
    }

  } catch (error) {
    console.error(`Error routing to external API for ${workspaceName}:`, error)
    // Don't throw - we don't want external API failures to break the main webhook
  }
}

serve(async (req) => {
  console.log('=== WEBHOOK REQUEST RECEIVED ===');
  console.log('Method:', req.method);
  console.log('Headers:', Object.fromEntries(req.headers));

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook payload
    const rawBody = await req.text();
    console.log('Raw body:', rawBody);

    const payload: WebhookPayload = JSON.parse(rawBody);
    console.log('Parsed payload:', JSON.stringify(payload, null, 2));

    console.log('Webhook event summary:', {
      event: payload.event?.type,
      workspace: payload.event?.workspace_name,
      lead: payload.data?.lead?.email,
    });

    // Verify this is a "Lead Interested" event
    // FIX: Email Bison sends event types in snake_case, not SCREAMING_SNAKE_CASE
    if (payload.event?.type !== 'lead_interested') {
      return new Response(
        JSON.stringify({ error: 'Not a lead_interested event', received: payload.event?.type }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lead = payload.data?.lead;
    const reply = payload.data?.reply;
    const campaign = payload.data?.campaign;

    if (!lead || !lead.email) {
      return new Response(
        JSON.stringify({ error: 'Missing lead data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build conversation URL
    const conversationUrl = payload.event?.instance_url
      ? `${payload.event.instance_url}/leads/${lead.id}`
      : null;

    // Extract phone from custom variables if available
    const phoneVariable = lead.custom_variables?.find(v =>
      v.name.toLowerCase().includes('phone')
    );

    // Extract lead data
    const leadData = {
      workspace_name: payload.event?.workspace_name || 'Unknown',
      first_name: lead.first_name,
      last_name: lead.last_name,
      lead_email: lead.email,
      phone: phoneVariable?.value || null,
      title: lead.title,
      company: lead.company,
      custom_variables: lead.custom_variables,
      bison_conversation_url: conversationUrl,
      pipeline_stage: 'interested', // LEAD_INTERESTED events go to Interested stage
      date_received: reply?.date_received ?? new Date().toISOString(), // Fixed: use ?? instead of ||
      lead_value: 0, // Default value
      tags: null, // Will be populated if we add tag fetching later
      interested: true, // Mark as interested
    };

    // Upsert lead to client_leads table
    // Use email + workspace as unique identifier
    console.log('Checking for existing lead:', {
      email: leadData.lead_email,
      workspace: leadData.workspace_name
    });

    const { data: existingLead, error: checkError } = await supabase
      .from('client_leads')
      .select('id, pipeline_stage')
      .eq('lead_email', leadData.lead_email)
      .eq('workspace_name', leadData.workspace_name)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking for existing lead:', checkError);
    }

    console.log('Existing lead found:', existingLead ? 'yes' : 'no');

    let result;

    if (existingLead) {
      // Update existing lead - preserve pipeline_stage if already moved
      const updateData = {
        ...leadData,
        pipeline_stage: existingLead.pipeline_stage, // Don't reset if already moved
        updated_at: new Date().toISOString(),
      };

      console.log('Updating existing lead with data:', updateData);

      result = await supabase
        .from('client_leads')
        .update(updateData)
        .eq('id', existingLead.id)
        .select()
        .single();

      console.log('Update result:', { success: !result.error, data: result.data, error: result.error });
    } else {
      // Insert new lead
      console.log('Creating new lead with data:', leadData);

      result = await supabase
        .from('client_leads')
        .insert([leadData])
        .select()
        .single();

      console.log('Insert result:', { success: !result.error, data: result.data, error: result.error });
    }

    if (result.error) {
      console.error('❌ Database operation failed:', result.error);
      return new Response(
        JSON.stringify({ error: result.error.message, details: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✨ NEW: Increment client_metrics for real-time KPI updates
    // Only increment if this is a NEW lead (not an update)
    if (!existingLead) {
      console.log('Incrementing interested_mtd metric for:', leadData.workspace_name);
      const { error: incrementError } = await supabase.rpc('increment_metric', {
        p_workspace_name: leadData.workspace_name,
        p_metric_name: 'interested_mtd',
        p_increment_by: 1
      });

      if (incrementError) {
        console.error('⚠️ Failed to increment metric (non-fatal):', incrementError);
        // Don't fail the webhook - metric will be corrected in daily sync
      } else {
        console.log('✅ Metric incremented successfully');
      }
    }

    // ✨ NEW: Forward to external APIs (Agency Zoom, etc.) if configured
    await routeToExternalAPI(supabase, leadData.workspace_name, lead, reply, result.data.id);

    const response = {
      success: true,
      action: existingLead ? 'updated' : 'created',
      lead_id: result.data.id,
      workspace: leadData.workspace_name,
    };

    console.log('✅ Webhook processed successfully:', response);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Webhook error:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
        type: error.constructor.name
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
