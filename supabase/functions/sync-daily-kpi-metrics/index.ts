/**
 * sync-daily-kpi-metrics Edge Function
 *
 * Purpose: Daily scheduled job to populate client_metrics table with MTD data
 * Runs: Daily at 12:01 AM via pg_cron
 *
 * Flow:
 * 1. Fetch all active clients from client_registry
 * 2. For each client, fetch Email Bison stats using workspace-specific API key
 * 3. Calculate MTD metrics and projections
 * 4. Upsert to client_metrics table with metric_type='mtd'
 *
 * @created 2025-10-09
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DateRanges {
  today: string;
  currentMonthStart: string;
  lastMonthStart: string;
  lastMonthEnd: string;
  last7DaysStart: string;
  last14DaysStart: string;
  last30DaysStart: string;
  daysInMonth: number;
  daysElapsed: number;
}

// Helper function to format date as YYYY-MM-DD
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Get date ranges for metric calculations
const getDateRanges = (): DateRanges => {
  const today = new Date();

  // Current month (MTD)
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Previous month
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  // Last N days
  const last7DaysStart = new Date(today);
  last7DaysStart.setDate(today.getDate() - 7);

  const last14DaysStart = new Date(today);
  last14DaysStart.setDate(today.getDate() - 14);

  const last30DaysStart = new Date(today);
  last30DaysStart.setDate(today.getDate() - 30);

  return {
    today: formatDate(today),
    currentMonthStart: formatDate(currentMonthStart),
    lastMonthStart: formatDate(lastMonthStart),
    lastMonthEnd: formatDate(lastMonthEnd),
    last7DaysStart: formatDate(last7DaysStart),
    last14DaysStart: formatDate(last14DaysStart),
    last30DaysStart: formatDate(last30DaysStart),
    daysInMonth: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(),
    daysElapsed: today.getDate(),
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== SYNC DAILY KPI METRICS ===');
    const startTime = Date.now();

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const dateRanges = getDateRanges();

    console.log('Date ranges:', dateRanges);

    // Fetch all active clients with workspace-specific API keys
    const { data: clients, error: clientsError } = await supabase
      .from('client_registry')
      .select('workspace_name, display_name, monthly_kpi_target, monthly_sending_target, bison_api_key, bison_instance')
      .eq('is_active', true);

    if (clientsError) {
      throw new Error(`Failed to fetch clients: ${clientsError.message}`);
    }

    console.log(`Processing ${clients.length} active clients...`);

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    // Process each client
    for (const client of clients) {
      try {
        console.log(`\n[${client.workspace_name}] Fetching metrics...`);

        // Determine base URL based on instance
        const baseUrl = client.bison_instance === 'longrun'
          ? 'https://send.longrun.agency/api'
          : 'https://send.maverickmarketingllc.com/api';

        // Use workspace-specific API key (NO WORKSPACE SWITCHING!)
        const apiKey = client.bison_api_key;
        if (!apiKey) {
          console.warn(`[${client.workspace_name}] Missing API key, skipping...`);
          failCount++;
          results.push({
            workspace_name: client.workspace_name,
            status: 'skipped',
            error: 'Missing workspace API key',
          });
          continue;
        }

        // Fetch stats for multiple time periods + today's scheduled emails in parallel
        const [mtdStats, last7DaysStats, last14DaysStats, last30DaysStats, lastMonthStats, scheduledToday] = await Promise.all([
          // MTD (current month to today)
          fetch(
            `${baseUrl}/workspaces/v1.1/stats?start_date=${dateRanges.currentMonthStart}&end_date=${dateRanges.today}`,
            { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } }
          ).then(r => r.json()),

          // Last 7 days
          fetch(
            `${baseUrl}/workspaces/v1.1/stats?start_date=${dateRanges.last7DaysStart}&end_date=${dateRanges.today}`,
            { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } }
          ).then(r => r.json()),

          // Last 14 days
          fetch(
            `${baseUrl}/workspaces/v1.1/stats?start_date=${dateRanges.last14DaysStart}&end_date=${dateRanges.today}`,
            { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } }
          ).then(r => r.json()),

          // Last 30 days
          fetch(
            `${baseUrl}/workspaces/v1.1/stats?start_date=${dateRanges.last30DaysStart}&end_date=${dateRanges.today}`,
            { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } }
          ).then(r => r.json()),

          // Previous month
          fetch(
            `${baseUrl}/workspaces/v1.1/stats?start_date=${dateRanges.lastMonthStart}&end_date=${dateRanges.lastMonthEnd}`,
            { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } }
          ).then(r => r.json()),

          // Today's scheduled emails (future sends)
          fetch(
            `${baseUrl}/campaigns/sending-schedules?day=today`,
            { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } }
          ).then(r => r.json()),
        ]);

        // Extract reply/lead metrics
        const positiveRepliesMTD = mtdStats.data?.interested || 0;
        const positiveRepliesLast7Days = last7DaysStats.data?.interested || 0;
        const positiveRepliesLast14Days = last14DaysStats.data?.interested || 0;
        const positiveRepliesLast30Days = last30DaysStats.data?.interested || 0;
        const positiveRepliesLastMonth = lastMonthStats.data?.interested || 0;
        const allRepliesMTD = mtdStats.data?.unique_replies_per_contact || 0;
        const bouncedMTD = mtdStats.data?.bounced || 0;

        // Extract email sending volume metrics
        const emailsSentMTD = mtdStats.data?.emails_sent || 0;
        const emailsSentLast7Days = last7DaysStats.data?.emails_sent || 0;
        const emailsSentLast14Days = last14DaysStats.data?.emails_sent || 0;
        const emailsSentLast30Days = last30DaysStats.data?.emails_sent || 0;

        // Calculate today's scheduled emails (sum across all campaigns)
        let emailsScheduledToday = 0;
        try {
          if (scheduledToday?.data && Array.isArray(scheduledToday.data)) {
            emailsScheduledToday = scheduledToday.data.reduce((total: number, campaign: any) => {
              return total + (campaign?.emails_being_sent || 0);
            }, 0);
          }
        } catch (error) {
          console.warn(`[${client.workspace_name}] Error parsing scheduled emails:`, error);
        }

        // For "emails sent today", we approximate as the difference between MTD and yesterday's total
        // This is a rough estimate since we don't have exact daily breakdowns
        // Better solution would be to track daily in a separate table
        const emailsSentToday = 0; // TODO: Track daily sends in separate table for accurate count

        // Calculate projections
        const dailyAverage = dateRanges.daysElapsed > 0 ? positiveRepliesMTD / dateRanges.daysElapsed : 0;
        const projectedRepliesEOM = Math.round(dailyAverage * dateRanges.daysInMonth);

        const emailsDailyAvg = dateRanges.daysElapsed > 0 ? emailsSentMTD / dateRanges.daysElapsed : 0;
        const projectedEmailsEOM = Math.round(emailsDailyAvg * dateRanges.daysInMonth);

        // Calculate progress percentages
        const monthlyKPI = client.monthly_kpi_target || 0;
        const mtdLeadsProgress = monthlyKPI > 0 ? (positiveRepliesMTD / monthlyKPI) * 100 : 0;
        const projectionRepliesProgress = monthlyKPI > 0 ? (projectedRepliesEOM / monthlyKPI) * 100 : 0;

        // Week-over-week comparison
        const positiveReplies7To14Days = positiveRepliesLast14Days - positiveRepliesLast7Days;
        const lastWeekVsWeekBefore = positiveReplies7To14Days > 0
          ? ((positiveRepliesLast7Days - positiveReplies7To14Days) / positiveReplies7To14Days) * 100
          : 0;

        console.log(`[${client.workspace_name}] MTD: ${positiveRepliesMTD}, Projected EOM: ${projectedRepliesEOM}, Target: ${monthlyKPI}`);

        // Upsert to client_metrics table
        const { error: upsertError } = await supabase
          .from('client_metrics')
          .upsert({
            workspace_name: client.workspace_name,
            metric_date: dateRanges.today,
            metric_type: 'mtd',

            // Email volume metrics (MTD + rolling windows)
            emails_sent_mtd: emailsSentMTD,
            emails_sent_today: emailsSentToday,
            emails_sent_last_7_days: emailsSentLast7Days,
            emails_sent_last_14_days: emailsSentLast14Days,
            emails_sent_last_30_days: emailsSentLast30Days,
            emails_scheduled_today: emailsScheduledToday,
            projection_emails_eom: projectedEmailsEOM,

            // Lead/Reply metrics
            positive_replies_mtd: positiveRepliesMTD,
            positive_replies_last_7_days: positiveRepliesLast7Days,
            positive_replies_last_14_days: positiveRepliesLast14Days,
            positive_replies_last_30_days: positiveRepliesLast30Days,
            positive_replies_current_month: positiveRepliesMTD,
            positive_replies_last_month: positiveRepliesLastMonth,
            projection_positive_replies_eom: projectedRepliesEOM,

            // Supplemental metrics
            all_replies_mtd: allRepliesMTD,
            bounced_mtd: bouncedMTD,

            // Progress percentages
            mtd_leads_progress: mtdLeadsProgress,
            projection_replies_progress: projectionRepliesProgress,
            last_week_vs_week_before_progress: lastWeekVsWeekBefore,

            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'workspace_name,metric_date,metric_type'
          });

        if (upsertError) {
          throw new Error(`Upsert failed: ${upsertError.message}`);
        }

        successCount++;
        results.push({
          workspace_name: client.workspace_name,
          status: 'success',
          positive_replies_mtd: positiveRepliesMTD,
          projection_eom: projectedRepliesEOM,
          target: monthlyKPI,
          progress: Math.round(mtdLeadsProgress),
        });

      } catch (error) {
        console.error(`[${client.workspace_name}] Error:`, error);
        failCount++;
        results.push({
          workspace_name: client.workspace_name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const durationMs = Date.now() - startTime;

    console.log(`\n=== SYNC COMPLETE ===`);
    console.log(`Duration: ${durationMs}ms`);
    console.log(`Success: ${successCount}/${clients.length}`);
    console.log(`Failed: ${failCount}/${clients.length}`);

    return new Response(JSON.stringify({
      success: true,
      total_clients: clients.length,
      successful: successCount,
      failed: failCount,
      duration_ms: durationMs,
      date: dateRanges.today,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
