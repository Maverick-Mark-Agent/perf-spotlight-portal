import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_BISON_BASE_URL = 'https://send.maverickmarketingllc.com/api';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const emailBisonApiKey = Deno.env.get('EMAIL_BISON_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!emailBisonApiKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get workspace_name from request
    const { workspace_name } = await req.json();

    if (!workspace_name) {
      throw new Error('workspace_name is required');
    }

    console.log(`Starting sync for workspace: ${workspace_name}`);

    // 1. Get workspace info from client_registry
    const { data: registryData, error: registryError } = await supabase
      .from('client_registry')
      .select('workspace_id, workspace_name, bison_workspace_id, bison_instance')
      .eq('workspace_name', workspace_name)
      .single();

    if (registryError || !registryData) {
      throw new Error(`Workspace not found in registry: ${workspace_name}`);
    }

    const bisonWorkspaceId = registryData.bison_workspace_id;
    console.log(`Found Bison workspace ID: ${bisonWorkspaceId}`);

    // 2. Switch to workspace
    console.log(`Switching to workspace ${bisonWorkspaceId}...`);
    const switchResponse = await fetch(
      `${EMAIL_BISON_BASE_URL}/workspaces/v1.1/switch-workspace`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${emailBisonApiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ team_id: bisonWorkspaceId }),
      }
    );

    if (!switchResponse.ok) {
      throw new Error(`Failed to switch workspace: ${switchResponse.status}`);
    }

    // Wait for workspace switch to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Fetch ALL interested replies from Email Bison (paginated)
    console.log(`Fetching interested replies from Email Bison...`);
    let allReplies: any[] = [];
    let page = 1;
    let hasMore = true;
    const perPage = 100;

    while (hasMore) {
      console.log(`Fetching page ${page}...`);

      const repliesResponse = await fetch(
        `${EMAIL_BISON_BASE_URL}/replies?interested=1&per_page=${perPage}&page=${page}`,
        {
          headers: {
            'Authorization': `Bearer ${emailBisonApiKey}`,
            'Accept': 'application/json',
          },
        }
      );

      if (!repliesResponse.ok) {
        throw new Error(`Failed to fetch replies: ${repliesResponse.status}`);
      }

      const repliesData = await repliesResponse.json();
      const replies = repliesData.data || [];

      console.log(`Page ${page}: ${replies.length} replies`);
      allReplies = allReplies.concat(replies);

      // Check if there are more pages
      if (page >= repliesData.meta.last_page) {
        hasMore = false;
      } else {
        page++;
      }

      // Respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Total interested replies fetched: ${allReplies.length}`);

    // 4. Transform replies to client_leads format
    // Note: Reply objects don't have nested lead data, only lead_id
    const leadsToInsert = allReplies.map(reply => {
      // Parse first/last name from from_name if available
      const nameParts = (reply.from_name || '').split(' ');
      const firstName = nameParts[0] || null;
      const lastName = nameParts.slice(1).join(' ') || null;

      return {
        airtable_id: `bison_reply_${reply.id}`, // Required field - use reply ID
        workspace_name: workspace_name,
        lead_email: reply.from_email_address || 'unknown@email.com',
        first_name: firstName,
        last_name: lastName,
        date_received: reply.date_received,
        interested: true,
        pipeline_stage: 'new',
        bison_reply_id: reply.id,
        bison_reply_uuid: reply.uuid || null,
        bison_lead_id: reply.lead_id?.toString() || null,
      };
    });

    console.log(`Transformed ${leadsToInsert.length} leads for insertion`);

    // 5. Delete existing leads for this workspace (fresh start)
    console.log(`Deleting existing leads for ${workspace_name}...`);
    const { error: deleteError } = await supabase
      .from('client_leads')
      .delete()
      .eq('workspace_name', workspace_name);

    if (deleteError) {
      console.error('Error deleting existing leads:', deleteError);
    }

    // 6. Insert new leads in batches
    const batchSize = 100;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < leadsToInsert.length; i += batchSize) {
      const batch = leadsToInsert.slice(i, i + batchSize);

      const { error: insertError } = await supabase
        .from('client_leads')
        .insert(batch);

      if (insertError) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
        errors += batch.length;
      } else {
        inserted += batch.length;
        console.log(`Inserted batch ${i / batchSize + 1}: ${batch.length} leads`);
      }
    }

    console.log(`Sync complete: ${inserted} inserted, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        workspace: workspace_name,
        stats: {
          total_fetched: allReplies.length,
          inserted: inserted,
          errors: errors,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
