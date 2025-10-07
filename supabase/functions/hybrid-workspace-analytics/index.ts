import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_BISON_BASE_URL = 'https://send.maverickmarketingllc.com/api';

// Helper function to format date as YYYY-MM-DD
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Get date ranges for different periods
const getDateRanges = () => {
  const today = new Date();

  // Current month (MTD)
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Previous month
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  // Last 7 days
  const last7DaysStart = new Date(today);
  last7DaysStart.setDate(today.getDate() - 7);

  // Last 14 days
  const last14DaysStart = new Date(today);
  last14DaysStart.setDate(today.getDate() - 14);

  // Last 30 days
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
    currentDay: today.getDate(),
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const emailBisonApiKey = Deno.env.get('EMAIL_BISON_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!emailBisonApiKey) {
      throw new Error('EMAIL_BISON_API_KEY not found');
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching KPI analytics with Email Bison as primary data source...');

    const dateRanges = getDateRanges();
    console.log('Date ranges:', dateRanges);

    // Fetch client registry for display names and active status
    console.log('Fetching client_registry for display names...');
    const { data: registryClients, error: registryError } = await supabase
      .from('client_registry')
      .select('*')
      .eq('is_active', true);

    if (registryError) {
      console.error('Error fetching client_registry:', registryError);
    }

    // Build lookup by workspace name
    const registryLookup: Record<string, any> = {};
    (registryClients || []).forEach(client => {
      registryLookup[client.workspace_name] = client;
    });
    console.log(`Loaded ${Object.keys(registryLookup).length} active clients from registry`);

    // Fetch all workspaces from Email Bison
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
    console.log(`Fetched ${workspaces.length} workspaces from Email Bison`);

    // Fetch Email Bison stats using SEQUENTIAL workspace switching
    console.log('Fetching Email Bison stats via sequential workspace switching (Supabase-only mode)...');

    const clients: any[] = [];

    // Loop through workspaces SEQUENTIALLY
    for (const workspace of workspaces) {
      try {
        // Check if workspace is active in client_registry
        const registryClient = registryLookup[workspace.name];
        if (!registryClient) {
          console.log(`Skipping workspace "${workspace.name}" - not in active client registry`);
          continue;
        }

        // Get all data from client_registry (no Airtable needed!)
        const clientName = registryClient.display_name || workspace.name;
        const monthlyKPI = registryClient.monthly_kpi_target || 0;
        const monthlySendingTarget = registryClient.monthly_sending_target || 0;
        const payout = registryClient.payout || 0;
        const pricePerLead = registryClient.price_per_lead || 0;

        // Switch to workspace
        console.log(`Switching to workspace: ${workspace.name} (ID: ${workspace.id})`);
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
          console.error(`Failed to switch to workspace ${workspace.name}`);
          continue;
        }

        // Fetch interested leads from Supabase client_leads table
        const { data: leads, error: leadsError } = await supabase
          .from('client_leads')
          .select('date_received, interested')
          .eq('workspace_name', workspace.name)
          .eq('interested', true);

        if (leadsError) {
          console.error(`Error fetching leads for ${workspace.name}:`, leadsError);
        }

        // Calculate metrics from Supabase leads using date_received
        const allLeads = leads || [];

        const positiveRepliesMTD = allLeads.filter(l =>
          new Date(l.date_received) >= new Date(dateRanges.currentMonthStart)
        ).length;

        const positiveRepliesCurrentMonth = positiveRepliesMTD;

        const positiveRepliesLast7Days = allLeads.filter(l => {
          const dateReceived = new Date(l.date_received);
          return dateReceived >= new Date(dateRanges.last7DaysStart) && dateReceived <= new Date(dateRanges.today);
        }).length;

        const positiveRepliesLast14Days = allLeads.filter(l => {
          const dateReceived = new Date(l.date_received);
          return dateReceived >= new Date(dateRanges.last14DaysStart) && dateReceived <= new Date(dateRanges.today);
        }).length;

        const positiveRepliesLast14To7Days = positiveRepliesLast14Days - positiveRepliesLast7Days;

        const positiveRepliesLast30Days = allLeads.filter(l => {
          const dateReceived = new Date(l.date_received);
          return dateReceived >= new Date(dateRanges.last30DaysStart) && dateReceived <= new Date(dateRanges.today);
        }).length;

        const positiveRepliesLastMonth = allLeads.filter(l => {
          const dateReceived = new Date(l.date_received);
          return dateReceived >= new Date(dateRanges.lastMonthStart) && dateReceived <= new Date(dateRanges.lastMonthEnd);
        }).length;

        // Get email stats from Email Bison (still needed for volume metrics)
        const mtdStats = await fetch(
          `${EMAIL_BISON_BASE_URL}/workspaces/v1.1/stats?start_date=${dateRanges.currentMonthStart}&end_date=${dateRanges.today}`,
          {
            headers: {
              'Authorization': `Bearer ${emailBisonApiKey}`,
              'Accept': 'application/json',
            },
          }
        ).then(r => r.json());

        const emailsSent = mtdStats.data?.emails_sent || 0;

        console.log(`${clientName}: MTD=${positiveRepliesMTD}, Last7=${positiveRepliesLast7Days}, Last30=${positiveRepliesLast30Days}, MonthlyKPI=${monthlyKPI}`);

        // Calculate projections and comparisons
        const daysElapsed = dateRanges.currentDay;
        const daysInMonth = dateRanges.daysInMonth;
        const dailyAverage = daysElapsed > 0 ? positiveRepliesMTD / daysElapsed : 0;
        const projectedReplies = Math.round(dailyAverage * daysInMonth);

        const currentProgress = monthlyKPI > 0 ? positiveRepliesMTD / monthlyKPI : 0;
        const projectionProgress = monthlyKPI > 0 ? projectedReplies / monthlyKPI : 0;

        // Week over week comparison
        const lastWeekVsWeekBeforeProgress = positiveRepliesLast14To7Days > 0
          ? (positiveRepliesLast7Days - positiveRepliesLast14To7Days) / positiveRepliesLast14To7Days
          : 0;

        // Month over month comparison
        const positiveRepliesLastVsThisMonth = positiveRepliesLastMonth > 0
          ? ((positiveRepliesMTD - positiveRepliesLastMonth) / positiveRepliesLastMonth) * 100
          : 0;

        // Calculate email projection (same formula as Airtable)
        const emailsDailyAvg = daysElapsed > 0 ? emailsSent / daysElapsed : 0;
        const projectionEmailsEOM = Math.round(emailsDailyAvg * daysInMonth);

        clients.push({
          id: registryClient.workspace_id.toString(),
          name: clientName,

          // PRIMARY KPI METRICS (from Supabase client_leads)
          leadsGenerated: positiveRepliesMTD,
          projectedReplies: projectedReplies,
          monthlyKPI: monthlyKPI,
          currentProgress: currentProgress,
          repliesProgress: projectionProgress,

          // Time period comparisons (from Supabase client_leads)
          positiveRepliesLast30Days: positiveRepliesLast30Days,
          positiveRepliesLast7Days: positiveRepliesLast7Days,
          positiveRepliesLast14Days: positiveRepliesLast14To7Days,
          positiveRepliesCurrentMonth: positiveRepliesCurrentMonth,
          positiveRepliesLastMonth: positiveRepliesLastMonth,
          lastWeekVsWeekBeforeProgress: lastWeekVsWeekBeforeProgress,
          positiveRepliesLastVsThisMonth: positiveRepliesLastVsThisMonth,

          // Email Bison supplemental metrics
          emailsSent: emailsSent,
          bounced: mtdStats.data?.bounced || 0,
          interested: positiveRepliesMTD,
          leadsTarget: 0,
          repliesTarget: monthlyKPI,

          // For billing/volume pages (from client_registry)
          emails: emailsSent,
          target: monthlySendingTarget,
          projection: projectionEmailsEOM,
          targetPercentage: monthlySendingTarget > 0
            ? (emailsSent / monthlySendingTarget) * 100
            : 0,
          projectedPercentage: monthlySendingTarget > 0
            ? (projectionEmailsEOM / monthlySendingTarget) * 100
            : 0,
          variance: emailsSent - monthlySendingTarget,
          projectedVariance: projectionEmailsEOM - monthlySendingTarget,
          isAboveTarget: emailsSent >= monthlySendingTarget,
          isProjectedAboveTarget: projectionEmailsEOM >= monthlySendingTarget,
          payout: payout,
        });

      } catch (error) {
        console.error(`Error fetching stats for workspace ${workspace.name}:`, error);
      }
    }

    console.log(`Processed ${clients.length} clients with Email Bison data`);

    return new Response(JSON.stringify({ clients }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in hybrid-workspace-analytics function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        clients: []
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
