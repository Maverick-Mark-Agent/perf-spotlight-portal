import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * SYNC ALL INTERESTED STATS - THE CORRECT SOLUTION
 *
 * Uses Email Bison's /workspaces/v1.1/stats endpoint which returns:
 * {
 *   "interested": 15,  ← This is the count we need!
 *   "interested_percentage": 34.09,
 *   "emails_sent": 19737,
 *   ...
 * }
 *
 * This is how volume-dashboard-data works successfully!
 */

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const MAVERICK_API_KEY = Deno.env.get('MAVERICK_BISON_API_KEY') || Deno.env.get('EMAIL_BISON_API_KEY')!;
    const MAVERICK_BASE_URL = 'https://send.maverickmarketingllc.com/api';

    const LONGRUN_API_KEY = Deno.env.get('LONG_RUN_BISON_API_KEY')!;
    const LONGRUN_BASE_URL = 'https://send.longrun.agency/api';

    console.log('🚀 Syncing interested stats for all workspaces...');

    // Date ranges
    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const allTimeStart = new Date(2020, 0, 1); // Start from 2020

    const dateRanges = {
      today: formatDate(today),
      currentMonthStart: formatDate(currentMonthStart),
      allTimeStart: formatDate(allTimeStart),
    };

    console.log('Date ranges:', dateRanges);

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

    // Process each workspace SEQUENTIALLY with delays (like volume-dashboard-data does)
    for (let i = 0; i < workspaces.length; i++) {
      const workspace = workspaces[i];
      const { workspace_name, bison_workspace_id, bison_instance } = workspace;

      console.log(`\n[${i + 1}/${workspaces.length}] ${workspace_name} (${bison_instance} - ID: ${bison_workspace_id})`);

      const apiKey = bison_instance === 'Maverick' ? MAVERICK_API_KEY : LONGRUN_API_KEY;
      const baseUrl = bison_instance === 'Maverick' ? MAVERICK_BASE_URL : LONGRUN_BASE_URL;

      try {
        // STEP 1: Switch workspace
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
          results.push({ workspace_name, status: 'failed', error: 'workspace_switch_failed' });
          continue;
        }

        // Wait for workspace switch
        await new Promise(resolve => setTimeout(resolve, 200));

        // STEP 2: Fetch stats for October MTD and All-Time
        const [octoberStats, allTimeStats] = await Promise.all([
          fetch(
            `${baseUrl}/workspaces/v1.1/stats?start_date=${dateRanges.currentMonthStart}&end_date=${dateRanges.today}`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
              },
            }
          ).then(r => r.json()),
          fetch(
            `${baseUrl}/workspaces/v1.1/stats?start_date=${dateRanges.allTimeStart}&end_date=${dateRanges.today}`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
              },
            }
          ).then(r => r.json()),
        ]);

        const octoberInterested = octoberStats.data?.interested || 0;
        const allTimeInterested = allTimeStats.data?.interested || 0;

        console.log(`  October MTD: ${octoberInterested} | All-Time: ${allTimeInterested}`);

        // STEP 3: Store in client_metrics table
        const metricsRecord = {
          workspace_name,
          metric_type: 'interested_stats',
          emails_sent_mtd: 0, // Not needed for this sync
          positive_replies_mtd: octoberInterested,
          projection_emails_eom: 0,
          projection_positive_replies_eom: 0,
          last_synced: new Date().toISOString(),
          bison_data: {
            october_interested: octoberInterested,
            all_time_interested: allTimeInterested,
            synced_at: new Date().toISOString(),
          },
        };

        const { error: metricsError } = await supabase
          .from('client_metrics')
          .upsert(metricsRecord, {
            onConflict: 'workspace_name,metric_type',
          });

        if (metricsError) {
          console.error(`  Failed to store metrics:`, metricsError.message);
        }

        results.push({
          workspace_name,
          status: 'success',
          october_interested: octoberInterested,
          all_time_interested: allTimeInterested,
        });

      } catch (error) {
        console.error(`  Error processing ${workspace_name}:`, error);
        results.push({
          workspace_name,
          status: 'error',
          error: error.message,
        });
      }

      // Small delay between workspaces
      if (i < workspaces.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const summary = {
      total_workspaces: workspaces.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status !== 'success').length,
      results,
    };

    console.log('\n✅ Sync complete!');
    console.log(`   Successful: ${summary.successful}/${summary.total_workspaces}`);

    return new Response(
      JSON.stringify(summary, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
