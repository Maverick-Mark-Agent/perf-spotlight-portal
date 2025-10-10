import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * BACKFILL ALL WORKSPACES - Comprehensive Solution
 *
 * This Edge Function backfills ALL interested leads for ALL active workspaces.
 *
 * Key Strategy:
 * - Processes ONE workspace at a time with LONG delays (5+ seconds)
 * - Deduplicates by email (keeps most recent reply)
 * - Uses upsert with proper conflict handling
 * - Returns detailed report of all operations
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const MAVERICK_API_KEY = Deno.env.get('MAVERICK_BISON_API_KEY')!;
    const MAVERICK_BASE_URL = 'https://send.maverickmarketingllc.com/api';

    const LONGRUN_API_KEY = Deno.env.get('LONG_RUN_BISON_API_KEY')!;
    const LONGRUN_BASE_URL = 'https://send.longrun.agency/api';

    console.log('🚀 Starting comprehensive workspace backfill...');

    // Fetch all active workspaces
    const { data: workspaces, error: wsError } = await supabase
      .from('client_registry')
      .select('workspace_name, bison_workspace_id, bison_instance')
      .eq('is_active', true)
      .order('workspace_name');

    if (wsError || !workspaces) {
      throw new Error(`Failed to fetch workspaces: ${wsError?.message}`);
    }

    console.log(`Found ${workspaces.length} active workspaces`);

    const results: any[] = [];

    // Process each workspace ONE AT A TIME with long delays
    for (let i = 0; i < workspaces.length; i++) {
      const workspace = workspaces[i];
      const { workspace_name, bison_workspace_id, bison_instance } = workspace;

      console.log(`\n[${i + 1}/${workspaces.length}] Processing: ${workspace_name} (${bison_instance} - ID: ${bison_workspace_id})`);

      const apiKey = bison_instance === 'Maverick' ? MAVERICK_API_KEY : LONGRUN_API_KEY;
      const baseUrl = bison_instance === 'Maverick' ? MAVERICK_BASE_URL : LONGRUN_BASE_URL;

      try {
        // STEP 1: Switch workspace with LONG delay
        console.log(`  Switching to workspace ${bison_workspace_id}...`);
        const switchResponse = await fetch(`${baseUrl}/workspaces/v1.1/switch-workspace`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ team_id: bison_workspace_id }),
        });

        if (!switchResponse.ok) {
          console.error(`  Failed to switch workspace: ${switchResponse.status}`);
          results.push({ workspace_name, status: 'failed', error: 'workspace_switch_failed', inserted: 0 });
          continue;
        }

        // CRITICAL: Wait 3 seconds for workspace switch to fully propagate
        console.log(`  Waiting 3 seconds for workspace context to stabilize...`);
        await new Promise(resolve => setTimeout(resolve, 3000));

        // STEP 2: Fetch ALL interested replies with pagination
        console.log(`  Fetching interested replies...`);
        const allReplies: any[] = [];
        let page = 1;
        let hasMore = true;
        const perPage = 100;

        while (hasMore) {
          const repliesResponse = await fetch(
            `${baseUrl}/replies?interested=1&per_page=${perPage}&page=${page}`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
              },
            }
          );

          if (!repliesResponse.ok) {
            console.error(`  Failed to fetch page ${page}: ${repliesResponse.status}`);
            break;
          }

          const data = await repliesResponse.json();
          const replies = data.data || [];
          allReplies.push(...replies);

          console.log(`    Page ${page}: ${replies.length} replies (Total: ${allReplies.length})`);

          if (page >= data.meta?.last_page) {
            hasMore = false;
          } else {
            page++;
            // Small delay between pages
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        console.log(`  Found ${allReplies.length} total interested replies`);

        // STEP 3: Deduplicate by email (keep most recent reply per email)
        const repliesByEmail = new Map();
        for (const reply of allReplies) {
          const email = (reply.from_email_address || '').toLowerCase();
          const existing = repliesByEmail.get(email);

          // Keep the reply with highest ID (most recent)
          if (!existing || reply.id > existing.id) {
            repliesByEmail.set(email, reply);
          }
        }

        const uniqueReplies = Array.from(repliesByEmail.values());
        console.log(`  Deduplicated to ${uniqueReplies.length} unique leads`);

        // STEP 4: Transform and insert in batches
        const leadsToInsert = uniqueReplies.map(reply => {
          const nameParts = (reply.from_name || '').split(' ');
          return {
            airtable_id: `bison_reply_${reply.id}`,
            workspace_name,
            lead_email: reply.from_email_address || 'unknown@email.com',
            first_name: nameParts[0] || null,
            last_name: nameParts.slice(1).join(' ') || null,
            date_received: reply.date_received,
            interested: true,
            pipeline_stage: 'new',
            bison_reply_id: reply.id,
            bison_reply_uuid: reply.uuid || null,
            bison_lead_id: reply.lead_id?.toString() || null,
          };
        });

        const BATCH_SIZE = 100;
        let totalInserted = 0;

        for (let j = 0; j < leadsToInsert.length; j += BATCH_SIZE) {
          const batch = leadsToInsert.slice(j, j + BATCH_SIZE);

          const { error } = await supabase
            .from('client_leads')
            .upsert(batch, {
              onConflict: 'airtable_id',
              ignoreDuplicates: false,
            });

          if (!error) {
            totalInserted += batch.length;
          } else {
            console.error(`  Batch insert error:`, error.message);
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`  ✅ Successfully upserted ${totalInserted} leads`);

        results.push({
          workspace_name,
          status: 'success',
          total_replies: allReplies.length,
          unique_leads: uniqueReplies.length,
          inserted: totalInserted,
        });

      } catch (error) {
        console.error(`  ❌ Error processing ${workspace_name}:`, error);
        results.push({
          workspace_name,
          status: 'error',
          error: error.message,
          inserted: 0,
        });
      }

      // CRITICAL: Wait 5 seconds between workspaces to ensure clean session state
      if (i < workspaces.length - 1) {
        console.log(`  ⏳ Waiting 5 seconds before next workspace...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Generate summary
    const totalInserted = results.reduce((sum, r) => sum + (r.inserted || 0), 0);
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status !== 'success').length;

    const summary = {
      total_workspaces: workspaces.length,
      successful,
      failed,
      total_leads_inserted: totalInserted,
      results,
    };

    console.log('\n✅ Backfill complete!');
    console.log(`   Successful: ${successful}/${workspaces.length}`);
    console.log(`   Total leads inserted: ${totalInserted}`);

    return new Response(
      JSON.stringify(summary, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Backfill error:', error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
