import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_BISON_BASE_URL = 'https://send.maverickmarketingllc.com/api';

// Simple in-memory cache with TTL (5 minutes)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

const getCachedData = (key: string): any | null => {
  const cached = cache.get(key);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`Cache HIT for key: ${key}`);
    return cached.data;
  }
  console.log(`Cache MISS for key: ${key}`);
  return null;
};

const setCachedData = (key: string, data: any): void => {
  cache.set(key, { data, timestamp: Date.now() });
};

// Helper function to parse percentage values from Airtable
const parsePercent = (v: unknown) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  const cleaned = s.endsWith('%') ? s.slice(0, -1) : s;
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
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

    // Get date range (default to last 30 days)
    const body = await req.json().catch(() => ({}));
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const endDate = body.endDate || today.toISOString().split('T')[0];
    const startDate = body.startDate || thirtyDaysAgo.toISOString().split('T')[0];

    console.log(`Fetching workspace analytics from ${startDate} to ${endDate}`);

    // Check cache first (unless timestamp is provided to bust cache)
    const cacheKey = `analytics-${startDate}-${endDate}`;
    if (!body.timestamp) {
      const cachedData = getCachedData(cacheKey);
      if (cachedData) {
        console.log('Returning cached data');
        return new Response(JSON.stringify(cachedData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fetch all workspaces from Email Bison
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

    console.log(`Fetched ${workspaces.length} workspaces`);

    // Fetch stats for each workspace by switching workspace context
    // OPTIMIZED: Use Promise.all to fetch all workspaces in parallel
    console.log('Fetching workspace stats in parallel...');

    const workspaceStatsPromises = workspaces.map(async (workspace: any) => {
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
          return null;
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
          return null;
        }

        const statsData = await statsResponse.json();
        console.log(`Fetched stats for ${workspace.name}: ${statsData.data?.emails_sent || 0} emails sent`);

        return {
          workspace_id: workspace.id,
          workspace_name: workspace.name,
          stats: statsData.data,
        };
      } catch (error) {
        console.error(`Error fetching stats for workspace ${workspace.name}:`, error);
        return null;
      }
    });

    // Wait for all workspace stats to be fetched in parallel
    const workspaceStatsResults = await Promise.all(workspaceStatsPromises);

    // Filter out null results (failed fetches)
    const workspaceStats = workspaceStatsResults.filter((ws: any) => ws !== null);

    console.log(`Fetched stats for ${workspaceStats.length} workspaces`);

    // Fetch client KPI data from Airtable "Positive Replies" view
    // NOTE: This is the PRIMARY data source for KPI Dashboard
    console.log('Fetching client KPI data from Airtable "Positive Replies" view...');
    const airtableBaseId = 'appONMVSIf5czukkf';
    const clientsTable = '👨‍💻 Clients';
    const viewName = 'Positive Replies'; // Filter to only active KPI clients

    let allClientRecords: any[] = [];
    let offset = null;

    do {
      const url = new URL(`https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(clientsTable)}`);
      url.searchParams.append('view', viewName);
      if (offset) {
        url.searchParams.append('offset', offset);
      }

      const airtableResponse = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!airtableResponse.ok) {
        console.error(`Airtable API error: ${airtableResponse.status}`);
        break;
      }

      const airtableData = await airtableResponse.json();
      allClientRecords = allClientRecords.concat(airtableData.records || []);
      offset = airtableData.offset;

    } while (offset);

    console.log(`Fetched ${allClientRecords.length} client records from Airtable "Positive Replies" view`);

    // Create map of Email Bison workspace stats by name (supplemental data)
    const workspaceStatsMap = new Map();
    workspaceStats.forEach((ws: any) => {
      workspaceStatsMap.set(ws.workspace_name, ws.stats);
    });

    console.log(`Email Bison workspaces: ${Array.from(workspaceStatsMap.keys()).join(', ')}`);

    // Use Airtable as PRIMARY source, enrich with Email Bison stats if available
    // FILTER: Only include clients that have BOTH Airtable record AND Email Bison workspace
    const clients = allClientRecords
      .filter((record: any) => {
        const clientName = record.fields['Client Company Name'];
        const workspaceName = record.fields['Workspace Name']; // Use Workspace Name field, not Client Name
        const hasWorkspace = workspaceName && workspaceStatsMap.has(workspaceName);
        if (!hasWorkspace && clientName) {
          console.log(`Filtering out client "${clientName}" (workspace: "${workspaceName}") - no Email Bison workspace found`);
        }
        return hasWorkspace;
      })
      .map((record: any) => {
        const clientName = record.fields['Client Company Name'] || 'Unknown Client';
        const workspaceName = record.fields['Workspace Name'];
        const airtableData = record.fields;

        // Get Email Bison stats (guaranteed to exist due to filter above)
        const bisonStats = workspaceStatsMap.get(workspaceName) || {};

      // PRIMARY: Airtable KPI metrics (calculated fields from Airtable formulas)
      const positiveRepliesMTD = airtableData['Positive Replies MTD'] || 0;
      const projectedPositiveReplies = airtableData['Projection: Positive Replies Received (by EOM)'] || 0;
      const monthlyKPI = airtableData['Monthly KPI'] || 0;
      const mtdProgress = airtableData['MTD - Leads Generated Progress'] || 0;
      const projectionProgress = airtableData['Projection Positive Replies % Progress'] || 0;

      // Time period metrics (all from Airtable)
      const positiveRepliesLast30Days = airtableData['Positive Replies Last 30 Days'] || 0;
      const positiveRepliesLast7Days = airtableData['Positive Replies Last 7 Days'] || 0;
      const positiveRepliesLast14Days = airtableData['Positive Replies Last 14-7 Days'] || 0;
      const positiveRepliesCurrentMonth = airtableData['Positive Replies Current Month'] || 0;
      const positiveRepliesLastMonth = airtableData['Positive Replies Last Month'] || 0;
      const lastWeekVsWeekBeforeProgress = airtableData['Last Week VS Week Before Positive Replies % Progress'] || 0;
      const positiveRepliesLastVsThisMonth = parsePercent(airtableData['Positive Replies Last VS This Month']);

      // Debug logging for field comparison - MTD should show current month-to-date (resets each month)
      console.log(`${clientName}: MTD=${positiveRepliesMTD}, CurrentMonth=${positiveRepliesCurrentMonth}, MonthlyKPI=${monthlyKPI}`);

      // SUPPLEMENTAL: Email Bison real-time stats (for additional context)
      const emailsSent = bisonStats?.emails_sent || 0;
      const bounced = bisonStats?.bounced || 0;
      const interested = bisonStats?.interested || 0;

      return {
        id: record.id,
        name: clientName,

        // PRIMARY KPI METRICS (from Airtable)
        leadsGenerated: positiveRepliesMTD, // Use MTD (resets each month, more accurate for monthly tracking)
        projectedReplies: projectedPositiveReplies,
        monthlyKPI: monthlyKPI,
        currentProgress: mtdProgress, // Already a decimal/percentage from Airtable
        repliesProgress: projectionProgress, // Already a decimal/percentage from Airtable

        // Time period comparisons (from Airtable)
        positiveRepliesLast30Days,
        positiveRepliesLast7Days,
        positiveRepliesLast14Days,
        positiveRepliesCurrentMonth,
        positiveRepliesLastMonth,
        lastWeekVsWeekBeforeProgress,
        positiveRepliesLastVsThisMonth,

        // SUPPLEMENTAL Email Bison metrics
        emailsSent,
        bounced,
        interested,
        leadsTarget: 0,
        repliesTarget: monthlyKPI,

        // For billing page (using Airtable volume targets)
        emails: emailsSent,
        target: airtableData['Monthly Sending Target'] || 0,
        projection: airtableData['Projection: Emails Sent by EOM'] || 0,
        targetPercentage: airtableData['Monthly Sending Target'] > 0
          ? (emailsSent / airtableData['Monthly Sending Target']) * 100
          : 0,
        projectedPercentage: airtableData['Monthly Sending Target'] > 0
          ? (airtableData['Projection: Emails Sent by EOM'] / airtableData['Monthly Sending Target']) * 100
          : 0,
        variance: emailsSent - (airtableData['Monthly Sending Target'] || 0),
        projectedVariance: (airtableData['Projection: Emails Sent by EOM'] || 0) - (airtableData['Monthly Sending Target'] || 0),
        isAboveTarget: emailsSent >= (airtableData['Monthly Sending Target'] || 0),
        isProjectedAboveTarget: (airtableData['Projection: Emails Sent by EOM'] || 0) >= (airtableData['Monthly Sending Target'] || 0),
        payout: airtableData['Payout'] || 0,
      };
    });

    console.log(`Merged ${clients.length} client records`);

    // Cache the result
    const result = { clients };
    setCachedData(cacheKey, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in hybrid-workspace-analytics function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
