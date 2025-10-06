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
    if (payload.event?.type !== 'LEAD_INTERESTED') {
      return new Response(
        JSON.stringify({ error: 'Not a LEAD_INTERESTED event', received: payload.event?.type }),
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
      ? `${payload.event.instance_url}/workspaces/${payload.event.workspace_id}/leads/${lead.id}`
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
