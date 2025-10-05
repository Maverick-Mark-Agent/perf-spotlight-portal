import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Backfilling date_received for Devin Hodo leads...');

    // Get all Devin Hodo leads with null date_received
    const { data: nullDateLeads, error: fetchError } = await supabase
      .from('client_leads')
      .select('id, created_at, lead_email')
      .eq('workspace_name', 'Devin Hodo')
      .is('date_received', null);

    if (fetchError) {
      throw new Error(`Error fetching leads: ${fetchError.message}`);
    }

    console.log(`Found ${nullDateLeads?.length || 0} leads with null date_received`);

    if (!nullDateLeads || nullDateLeads.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No leads to update', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update each lead individually
    let updated = 0;
    for (const lead of nullDateLeads) {
      const { error: updateError } = await supabase
        .from('client_leads')
        .update({ date_received: lead.created_at })
        .eq('id', lead.id);

      if (updateError) {
        console.error(`Failed to update lead ${lead.id}:`, updateError);
      } else {
        updated++;
        console.log(`✅ Updated ${lead.lead_email}: date_received = ${lead.created_at}`);
      }
    }

    console.log(`Successfully updated ${updated}/${nullDateLeads.length} leads`);

    return new Response(
      JSON.stringify({
        message: 'Backfill complete',
        total_found: nullDateLeads.length,
        updated: updated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
