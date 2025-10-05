import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');

    if (!emailBisonApiKey) {
      throw new Error('EMAIL_BISON_API_KEY not found');
    }

    const body = await req.json().catch(() => ({}));
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const endDate = body.endDate || today.toISOString().split('T')[0];
    const startDate = body.startDate || thirtyDaysAgo.toISOString().split('T')[0];

    console.log(`Fetching campaign data from ${startDate} to ${endDate}`);

    // Fetch all workspaces
    console.log('Fetching workspaces from Email Bison...');
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

    // Fetch stats for each workspace by switching workspace context
    // NOTE: Email Bison API is session-based, must switch workspace to see its stats
    const schedules = [];

    for (const workspace of workspaces) {
      try {
        // Step 1: Switch to the workspace
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
          console.error(`Failed to switch to workspace ${workspace.name}: ${switchResponse.status}`);
          continue;
        }

        // Step 2: Fetch stats for the currently active workspace
        const statsResponse = await fetch(
          `${EMAIL_BISON_BASE_URL}/workspaces/v1.1/stats?start_date=${startDate}&end_date=${endDate}`,
          {
            headers: {
              'Authorization': `Bearer ${emailBisonApiKey}`,
              'Accept': 'application/json',
            },
          }
        );

        if (!statsResponse.ok) {
          console.error(`Failed to fetch stats for workspace ${workspace.name}: ${statsResponse.status}`);
          continue;
        }

        const statsData = await statsResponse.json();

        // Calculate scheduled emails (using emails_sent as proxy)
        // For actual scheduled emails, we'd need to fetch campaigns individually
        const emailsSent = statsData.data?.emails_sent || 0;

        // Estimate daily average
        const daysDiff = Math.max(1, Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
        const dailyAverage = emailsSent / daysDiff;

        schedules.push({
          clientName: workspace.name,
          todayEmails: Math.round(dailyAverage), // Estimate based on average
          tomorrowEmails: Math.round(dailyAverage), // Estimate
          totalScheduled: Math.round(dailyAverage * 2), // Today + Tomorrow
          threeDayAverage: Math.round(dailyAverage), // Daily average
        });

        console.log(`Fetched campaign stats for ${workspace.name}: ${emailsSent} emails sent`);
      } catch (error) {
        console.error(`Error fetching stats for workspace ${workspace.name}:`, error);
      }
    }

    // Calculate target volume per day (median of 3-day averages)
    const threeDayAverages = schedules
      .map(s => s.threeDayAverage)
      .filter(v => v > 0)
      .sort((a, b) => a - b);

    let targetVolumePerDay = 0;
    if (threeDayAverages.length > 0) {
      const mid = Math.floor(threeDayAverages.length / 2);
      const median = threeDayAverages.length % 2 === 0
        ? (threeDayAverages[mid - 1] + threeDayAverages[mid]) / 2
        : threeDayAverages[mid];
      targetVolumePerDay = median * 2; // Double for 2-day sending
    }

    console.log(`Processed ${schedules.length} client schedules`);

    return new Response(JSON.stringify({ schedules, targetVolumePerDay }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in email-bison-campaigns function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
