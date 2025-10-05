import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');

    if (!emailBisonApiKey) {
      throw new Error('EMAIL_BISON_API_KEY not found');
    }
    if (!airtableApiKey) {
      throw new Error('AIRTABLE_API_KEY not found');
    }

    console.log('Testing Email Bison KPI data for John Roberts...');

    const dateRanges = getDateRanges();
    console.log('Date ranges:', dateRanges);

    // Fetch John Roberts from Airtable to get workspace info and target
    const airtableBaseId = 'appONMVSIf5czukkf';
    const clientsTable = '👨‍💻 Clients';
    const viewName = 'Positive Replies';

    const airtableUrl = new URL(`https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(clientsTable)}`);
    airtableUrl.searchParams.append('view', viewName);
    airtableUrl.searchParams.append('filterByFormula', `{Client Company Name}='John Roberts'`);

    const airtableResponse = await fetch(airtableUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${airtableApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!airtableResponse.ok) {
      throw new Error(`Airtable API error: ${airtableResponse.status}`);
    }

    const airtableData = await airtableResponse.json();
    const johnRobertsRecord = airtableData.records[0];

    if (!johnRobertsRecord) {
      throw new Error('John Roberts not found in Airtable');
    }

    const fields = johnRobertsRecord.fields;
    const workspaceName = fields['Workspace Name'];
    const monthlyKPI = fields['Monthly KPI'] || 0;

    // Get Airtable's current values for comparison
    const airtableMetrics = {
      positiveRepliesMTD: fields['Positive Replies MTD'] || 0,
      positiveRepliesCurrentMonth: fields['Positive Replies Current Month'] || 0,
      positiveRepliesLast7Days: fields['Positive Replies Last 7 Days'] || 0,
      positiveRepliesLast30Days: fields['Positive Replies Last 30 Days'] || 0,
      positiveRepliesLastMonth: fields['Positive Replies Last Month'] || 0,
    };

    console.log(`Found John Roberts: workspace="${workspaceName}", monthlyKPI=${monthlyKPI}`);
    console.log('Airtable metrics:', airtableMetrics);

    // Find workspace ID from Email Bison
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
    const workspace = workspacesData.data.find((ws: any) => ws.name === workspaceName);

    if (!workspace) {
      throw new Error(`Workspace "${workspaceName}" not found in Email Bison`);
    }

    console.log(`Found workspace ID: ${workspace.id}`);

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
      throw new Error('Failed to switch workspace');
    }

    console.log('Switched to John Roberts workspace');

    // Fetch stats for different time periods
    const [mtdStats, lastMonthStats, last7DaysStats, last14DaysStats, last30DaysStats] = await Promise.all([
      // MTD
      fetch(
        `${EMAIL_BISON_BASE_URL}/workspaces/v1.1/stats?start_date=${dateRanges.currentMonthStart}&end_date=${dateRanges.today}`,
        {
          headers: {
            'Authorization': `Bearer ${emailBisonApiKey}`,
            'Accept': 'application/json',
          },
        }
      ).then(r => r.json()),
      // Last month
      fetch(
        `${EMAIL_BISON_BASE_URL}/workspaces/v1.1/stats?start_date=${dateRanges.lastMonthStart}&end_date=${dateRanges.lastMonthEnd}`,
        {
          headers: {
            'Authorization': `Bearer ${emailBisonApiKey}`,
            'Accept': 'application/json',
          },
        }
      ).then(r => r.json()),
      // Last 7 days
      fetch(
        `${EMAIL_BISON_BASE_URL}/workspaces/v1.1/stats?start_date=${dateRanges.last7DaysStart}&end_date=${dateRanges.today}`,
        {
          headers: {
            'Authorization': `Bearer ${emailBisonApiKey}`,
            'Accept': 'application/json',
          },
        }
      ).then(r => r.json()),
      // Last 14 days
      fetch(
        `${EMAIL_BISON_BASE_URL}/workspaces/v1.1/stats?start_date=${dateRanges.last14DaysStart}&end_date=${dateRanges.today}`,
        {
          headers: {
            'Authorization': `Bearer ${emailBisonApiKey}`,
            'Accept': 'application/json',
          },
        }
      ).then(r => r.json()),
      // Last 30 days
      fetch(
        `${EMAIL_BISON_BASE_URL}/workspaces/v1.1/stats?start_date=${dateRanges.last30DaysStart}&end_date=${dateRanges.today}`,
        {
          headers: {
            'Authorization': `Bearer ${emailBisonApiKey}`,
            'Accept': 'application/json',
          },
        }
      ).then(r => r.json()),
    ]);

    console.log('Fetched all stats from Email Bison');

    // Extract Email Bison metrics
    const emailBisonMetrics = {
      positiveRepliesMTD: mtdStats.data?.interested || 0,
      positiveRepliesCurrentMonth: mtdStats.data?.interested || 0, // Same as MTD
      positiveRepliesLast7Days: last7DaysStats.data?.interested || 0,
      positiveRepliesLast14To7Days: (last14DaysStats.data?.interested || 0) - (last7DaysStats.data?.interested || 0),
      positiveRepliesLast30Days: last30DaysStats.data?.interested || 0,
      positiveRepliesLastMonth: lastMonthStats.data?.interested || 0,
      emailsSent: mtdStats.data?.emails_sent || 0,
      bounced: mtdStats.data?.bounced || 0,
      replyRate: mtdStats.data?.interested_percentage || 0,
      uniqueReplies: mtdStats.data?.unique_replies_per_contact || 0,
    };

    console.log('Email Bison metrics:', emailBisonMetrics);

    // Calculate projections and comparisons
    const daysElapsed = dateRanges.currentDay;
    const daysInMonth = dateRanges.daysInMonth;
    const dailyAverage = daysElapsed > 0 ? emailBisonMetrics.positiveRepliesMTD / daysElapsed : 0;
    const projectedReplies = Math.round(dailyAverage * daysInMonth);

    const currentProgress = monthlyKPI > 0 ? emailBisonMetrics.positiveRepliesMTD / monthlyKPI : 0;
    const projectionProgress = monthlyKPI > 0 ? projectedReplies / monthlyKPI : 0;

    // Week over week comparison
    const lastWeekVsWeekBeforeProgress = emailBisonMetrics.positiveRepliesLast14To7Days > 0
      ? (emailBisonMetrics.positiveRepliesLast7Days - emailBisonMetrics.positiveRepliesLast14To7Days) / emailBisonMetrics.positiveRepliesLast14To7Days
      : 0;

    // Month over month comparison
    const positiveRepliesLastVsThisMonth = emailBisonMetrics.positiveRepliesLastMonth > 0
      ? ((emailBisonMetrics.positiveRepliesMTD - emailBisonMetrics.positiveRepliesLastMonth) / emailBisonMetrics.positiveRepliesLastMonth) * 100
      : 0;

    const calculatedMetrics = {
      dailyAverage: dailyAverage.toFixed(2),
      projectedReplies,
      currentProgress: (currentProgress * 100).toFixed(1) + '%',
      projectionProgress: (projectionProgress * 100).toFixed(1) + '%',
      lastWeekVsWeekBeforeProgress: (lastWeekVsWeekBeforeProgress * 100).toFixed(1) + '%',
      positiveRepliesLastVsThisMonth: positiveRepliesLastVsThisMonth.toFixed(1) + '%',
    };

    console.log('Calculated metrics:', calculatedMetrics);

    // Return comparison data
    return new Response(
      JSON.stringify({
        client: 'John Roberts',
        workspaceName,
        monthlyKPI,
        dateRanges,
        airtableMetrics,
        emailBisonMetrics,
        calculatedMetrics,
        comparison: {
          mtdDifference: emailBisonMetrics.positiveRepliesMTD - airtableMetrics.positiveRepliesMTD,
          message: emailBisonMetrics.positiveRepliesMTD !== airtableMetrics.positiveRepliesMTD
            ? `⚠️ MISMATCH: Email Bison shows ${emailBisonMetrics.positiveRepliesMTD} but Airtable shows ${airtableMetrics.positiveRepliesMTD}`
            : '✅ Data matches between sources',
        },
        rawStats: {
          mtd: mtdStats.data,
          lastMonth: lastMonthStats.data,
          last7Days: last7DaysStats.data,
          last14Days: last14DaysStats.data,
          last30Days: last30DaysStats.data,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in email-bison-kpi-test function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
