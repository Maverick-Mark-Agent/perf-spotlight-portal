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

    console.log('=== Starting Master Sync for All Active Clients ===');

    // Get all active clients from client_registry
    const { data: activeClients, error: registryError } = await supabase
      .from('client_registry')
      .select('workspace_id, workspace_name, bison_workspace_id, bison_instance, monthly_sending_target')
      .eq('is_active', true)
      .gt('monthly_sending_target', 0)
      .order('workspace_name');

    if (registryError) {
      throw new Error(`Failed to fetch active clients: ${registryError.message}`);
    }

    console.log(`Found ${activeClients.length} active clients to sync`);

    const results: any[] = [];

    // Process each workspace SEQUENTIALLY
    for (let i = 0; i < activeClients.length; i++) {
      const client = activeClients[i];
      const workspaceName = client.workspace_name;
      const bisonWorkspaceId = client.bison_workspace_id;

      console.log(`\n[${i + 1}/${activeClients.length}] Processing ${workspaceName} (Workspace ID: ${bisonWorkspaceId})...`);

      try {
        // 1. Switch to workspace
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

        // 2. CRITICAL: Wait 2 seconds for workspace switch to fully propagate
        console.log(`Waiting for workspace switch to propagate...`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 3. Fetch ALL interested replies (paginated)
        console.log(`Fetching interested replies...`);
        let allReplies: any[] = [];
        let page = 1;
        let hasMore = true;
        const perPage = 100;

        while (hasMore) {
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

          allReplies = allReplies.concat(replies);

          if (page >= repliesData.meta.last_page) {
            hasMore = false;
          } else {
            page++;
          }

          // Small delay between pages
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`Fetched ${allReplies.length} total interested replies`);

        // 4. Transform to client_leads format
        const leadsToUpsert = allReplies.map(reply => {
          const nameParts = (reply.from_name || '').split(' ');
          const firstName = nameParts[0] || null;
          const lastName = nameParts.slice(1).join(' ') || null;

          return {
            airtable_id: `bison_${bisonWorkspaceId}_${reply.id}`,
            workspace_name: workspaceName,
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

        // 5. Delete existing leads for this workspace (fresh start)
        const { error: deleteError } = await supabase
          .from('client_leads')
          .delete()
          .eq('workspace_name', workspaceName);

        if (deleteError) {
          console.error(`Warning: Error deleting existing leads:`, deleteError.message);
        }

        // 6. Insert in batches with better error handling
        let inserted = 0;
        let failed = 0;
        const batchSize = 50; // Smaller batches for reliability

        for (let j = 0; j < leadsToUpsert.length; j += batchSize) {
          const batch = leadsToUpsert.slice(j, j + batchSize);

          const { error: insertError, count } = await supabase
            .from('client_leads')
            .insert(batch)
            .select('id', { count: 'exact' });

          if (insertError) {
            console.error(`Batch ${Math.floor(j / batchSize) + 1} error:`, insertError.message);
            failed += batch.length;
          } else {
            inserted += (count || batch.length);
          }
        }

        results.push({
          workspace: workspaceName,
          success: true,
          total_replies: allReplies.length,
          inserted: inserted,
          failed: failed,
        });

        console.log(`✓ ${workspaceName}: ${inserted} leads inserted, ${failed} failed`);

      } catch (error) {
        console.error(`✗ ${workspaceName}: ${error.message}`);
        results.push({
          workspace: workspaceName,
          success: false,
          error: error.message,
        });
      }

      // Wait between workspaces to be respectful to the API
      if (i < activeClients.length - 1) {
        console.log('Waiting 2 seconds before next workspace...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n=== Sync Complete ===');
    console.log(`Total workspaces: ${results.length}`);
    console.log(`Successful: ${results.filter(r => r.success).length}`);
    console.log(`Failed: ${results.filter(r => !r.success).length}`);

    return new Response(
      JSON.stringify({
        success: true,
        total_workspaces: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Master sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
