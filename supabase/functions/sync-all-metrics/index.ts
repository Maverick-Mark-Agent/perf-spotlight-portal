import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_BISON_BASE_URL = 'https://send.maverickmarketingllc.com/api';

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

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

    console.log('🔄 Starting complete metrics sync...');

    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Fetch all workspaces from Email Bison
    console.log('📥 Fetching workspaces from Email Bison...');
    const workspacesResponse = await fetch(`${EMAIL_BISON_BASE_URL}/workspaces/v1.1`, {
      headers: {
        'Authorization': `Bearer ${emailBisonApiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!workspacesResponse.ok) {
      throw new Error(`Email Bison API error: ${workspacesResponse.status}`);
    }

    const workspacesData = await workspacesResponse.json();
    const workspaces = workspacesData.data || [];
    console.log(`  Found ${workspaces.length} workspaces`);

    // Get all active clients from client_registry
    const { data: clientRegistry } = await supabase
      .from('client_registry')
      .select('*')
      .eq('is_active', true);

    const clientMap = new Map();
    (clientRegistry || []).forEach((client: any) => {
      clientMap.set(client.workspace_name, client);
    });

    let syncedCount = 0;
    let errors: string[] = [];

    // Sync each workspace
    for (const workspace of workspaces) {
      try {
        const clientData = clientMap.get(workspace.name);

        // Skip if not in client registry
        if (!clientData) {
          console.log(`⏭️  Skipping ${workspace.name} (not in client_registry)`);
          continue;
        }

        console.log(`🔄 Syncing ${workspace.name}...`);

        // Switch to workspace
        const switchResponse = await fetch(
          `${EMAIL_BISON_BASE_URL}/workspaces/v1.1/switch-workspace`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${emailBisonApiKey}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ team_id: workspace.id }),
          }
        );

        if (!switchResponse.ok) {
          errors.push(`Failed to switch to ${workspace.name}`);
          continue;
        }

        // Fetch MTD stats
        const mtdStatsResponse = await fetch(
          `${EMAIL_BISON_BASE_URL}/workspaces/v1.1/stats?start_date=${formatDate(firstOfMonth)}&end_date=${formatDate(today)}`,
          {
            headers: {
              'Authorization': `Bearer ${emailBisonApiKey}`,
              'Accept': 'application/json',
            },
          }
        );

        const mtdStats = await mtdStatsResponse.json();
        const emailsSent = mtdStats.data?.emails_sent || 0;
        const repliesReceived = mtdStats.data?.positive_replies || 0;

        // Fetch last 7 days stats
        const last7DaysStart = new Date(today);
        last7DaysStart.setDate(today.getDate() - 7);

        const last7Response = await fetch(
          `${EMAIL_BISON_BASE_URL}/workspaces/v1.1/stats?start_date=${formatDate(last7DaysStart)}&end_date=${formatDate(today)}`,
          {
            headers: {
              'Authorization': `Bearer ${emailBisonApiKey}`,
              'Accept': 'application/json',
            },
          }
        );

        const last7Stats = await last7Response.json();
        const repliesLast7Days = last7Stats.data?.positive_replies || 0;

        // Fetch last 30 days stats
        const last30DaysStart = new Date(today);
        last30DaysStart.setDate(today.getDate() - 30);

        const last30Response = await fetch(
          `${EMAIL_BISON_BASE_URL}/workspaces/v1.1/stats?start_date=${formatDate(last30DaysStart)}&end_date=${formatDate(today)}`,
          {
            headers: {
              'Authorization': `Bearer ${emailBisonApiKey}`,
              'Accept': 'application/json',
            },
          }
        );

        const last30Stats = await last30Response.json();
        const repliesLast30Days = last30Stats.data?.positive_replies || 0;

        // Calculate projections
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const currentDay = today.getDate();
        const dailyAverage = currentDay > 0 ? emailsSent / currentDay : 0;
        const projectionEmails = Math.round(dailyAverage * daysInMonth);

        const dailyRepliesAverage = currentDay > 0 ? repliesReceived / currentDay : 0;
        const projectionReplies = Math.round(dailyRepliesAverage * daysInMonth);

        // Calculate progress percentages
        const mtdProgress = clientData.monthly_kpi_target > 0
          ? (repliesReceived / clientData.monthly_kpi_target) * 100
          : 0;

        const projectionProgress = clientData.monthly_kpi_target > 0
          ? (projectionReplies / clientData.monthly_kpi_target) * 100
          : 0;

        // Upsert MTD metrics
        const { error: metricsError } = await supabase
          .from('client_metrics')
          .upsert({
            workspace_name: workspace.name,
            metric_date: formatDate(today),
            metric_type: 'mtd',
            emails_sent_mtd: emailsSent,
            positive_replies_mtd: repliesReceived,
            positive_replies_last_7_days: repliesLast7Days,
            positive_replies_last_30_days: repliesLast30Days,
            projection_emails_eom: projectionEmails,
            projection_positive_replies_eom: projectionReplies,
            mtd_leads_progress: mtdProgress,
            projection_replies_progress: projectionProgress,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'workspace_name,metric_date,metric_type'
          });

        if (metricsError) {
          errors.push(`Metrics sync failed for ${workspace.name}: ${metricsError.message}`);
          continue;
        }

        syncedCount++;
        console.log(`  ✅ ${workspace.name} synced successfully`);

      } catch (error) {
        const errorMsg = `Error syncing ${workspace.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`  ❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`\n✅ Sync complete: ${syncedCount}/${workspaces.length} workspaces synced`);
    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} errors occurred`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCount,
        total: workspaces.length,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Fatal error in sync-all-metrics:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
