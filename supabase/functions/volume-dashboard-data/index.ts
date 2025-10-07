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
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const last7DaysStart = new Date(today);
  last7DaysStart.setDate(today.getDate() - 7);

  const last14DaysStart = new Date(today);
  last14DaysStart.setDate(today.getDate() - 14);

  const last30DaysStart = new Date(today);
  last30DaysStart.setDate(today.getDate() - 30);

  return {
    today: formatDate(today),
    mtdStart: formatDate(firstOfMonth),
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
      throw new Error('Supabase credentials not found');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching volume dashboard data...');

    const dateRanges = getDateRanges();
    console.log('Date ranges:', dateRanges);

    // Fetch ALL workspaces from Email Bison (single call, no switching)
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

    // Create a map of workspace names for quick lookup
    const workspaceMap = new Map();
    workspaces.forEach((ws: any) => {
      workspaceMap.set(ws.name, {
        id: ws.id,
        name: ws.name,
      });
    });

    // Fetch client settings from Supabase client_registry
    const { data: clientRegistry, error: registryError } = await supabase
      .from('client_registry')
      .select('workspace_name, display_name, monthly_sending_target, is_active')
      .eq('is_active', true);

    if (registryError) {
      console.error('Error fetching client registry:', registryError);
      throw registryError;
    }

    // Create a map of client settings by workspace name
    const clientSettingsMap = new Map();
    (clientRegistry || []).forEach((client: any) => {
      clientSettingsMap.set(client.workspace_name, {
        displayName: client.display_name || client.workspace_name,
        sendingTarget: client.monthly_sending_target || 0,
      });
    });

    console.log(`Fetched ${clientRegistry.length} client records from Supabase client_registry`);

    // Fetch Email Bison stats using SEQUENTIAL workspace switching
    console.log('Fetching Email Bison stats via sequential workspace switching...');

    const clients: any[] = [];

    // Loop through workspaces SEQUENTIALLY (not in parallel to avoid conflicts)
    for (const workspace of workspaces) {
      try {
        const settings = clientSettingsMap.get(workspace.name);

        // Skip if no settings or no sending target
        if (!settings || settings.sendingTarget === 0) {
          console.log(`Skipping workspace "${workspace.name}" - no sending target in client_registry`);
          continue;
        }

        const clientName = settings.displayName;
        const monthlySendingTarget = settings.sendingTarget;

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

        // Fetch stats for different time periods from Email Bison
        const [mtdStats, todayStats, last7DaysStats, last30DaysStats] = await Promise.all([
          fetch(
            `${EMAIL_BISON_BASE_URL}/workspaces/v1.1/stats?start_date=${dateRanges.mtdStart}&end_date=${dateRanges.today}`,
            {
              headers: {
                'Authorization': `Bearer ${emailBisonApiKey}`,
                'Accept': 'application/json',
              },
            }
          ).then(r => r.json()),
          fetch(
            `${EMAIL_BISON_BASE_URL}/workspaces/v1.1/stats?start_date=${dateRanges.today}&end_date=${dateRanges.today}`,
            {
              headers: {
                'Authorization': `Bearer ${emailBisonApiKey}`,
                'Accept': 'application/json',
              },
            }
          ).then(r => r.json()),
          fetch(
            `${EMAIL_BISON_BASE_URL}/workspaces/v1.1/stats?start_date=${dateRanges.last7DaysStart}&end_date=${dateRanges.today}`,
            {
              headers: {
                'Authorization': `Bearer ${emailBisonApiKey}`,
                'Accept': 'application/json',
              },
            }
          ).then(r => r.json()),
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

        // Extract email volumes from Email Bison API
        const emailsMTD = mtdStats.data?.emails_sent || 0;
        const emailsToday = todayStats.data?.emails_sent || 0;
        const emailsLast7Days = last7DaysStats.data?.emails_sent || 0;
        const emailsLast30Days = last30DaysStats.data?.emails_sent || 0;

        console.log(`${clientName}: MTD=${emailsMTD}, Today=${emailsToday}, Last7=${emailsLast7Days}, Last30=${emailsLast30Days}`);

        // Calculate daily quota and status
        const dailyQuota = monthlySendingTarget / dateRanges.daysInMonth;
        const daysElapsed = dateRanges.currentDay;
        const expectedByNow = dailyQuota * daysElapsed;
        const isOnTrack = emailsMTD >= expectedByNow;

        // Calculate projection
        const dailyAverage = daysElapsed > 0 ? emailsMTD / daysElapsed : 0;
        const projectedEOM = Math.round(dailyAverage * dateRanges.daysInMonth);

        // Calculate percentages
        const targetPercentage = monthlySendingTarget > 0
          ? (emailsMTD / monthlySendingTarget) * 100
          : 0;

        const projectedPercentage = monthlySendingTarget > 0
          ? (projectedEOM / monthlySendingTarget) * 100
          : 0;

        const variance = emailsMTD - monthlySendingTarget;
        const projectedVariance = projectedEOM - monthlySendingTarget;
        const isAboveTarget = emailsMTD >= monthlySendingTarget;
        const isProjectedAboveTarget = projectedEOM >= monthlySendingTarget;

        // Calculate last 14 days (for week-before comparison)
        const emailsLast14Days = emailsLast7Days; // Placeholder - can add separate API call if needed

        clients.push({
          id: workspace.id,
          name: clientName,
          emails: emailsMTD,
          emailsToday,
          emailsLast7Days,
          emailsLast14Days,
          emailsLast30Days,
          target: monthlySendingTarget,
          projection: projectedEOM,
          targetPercentage,
          projectedPercentage,
          variance,
          projectedVariance,
          isAboveTarget,
          isProjectedAboveTarget,
          dailyQuota: Math.round(dailyQuota),
          expectedByNow: Math.round(expectedByNow),
          isOnTrack,
          dailyAverage: Math.round(dailyAverage),
          distanceToTarget: Math.abs(emailsMTD - monthlySendingTarget),
          rank: 0, // Will be set after sorting
        });

      } catch (error) {
        console.error(`Error fetching stats for workspace ${workspace.name}:`, error);
      }
    }

    // Sort clients: On Pace → Near Target → Behind Pace, then 0 emails at bottom
    clients.sort((a: any, b: any) => {
      // First, push 0 email clients to the bottom
      if (a.emails === 0 && b.emails !== 0) return 1;
      if (a.emails !== 0 && b.emails === 0) return -1;

      // Categorize by projection status (matching UI logic)
      const getCategory = (client: any) => {
        if (client.projectedPercentage >= 100) return 1; // On Pace
        if (client.projectedPercentage >= 80) return 2;  // Near Target
        return 3; // Behind Pace
      };

      const categoryA = getCategory(a);
      const categoryB = getCategory(b);

      // Sort by category: On Pace (1) → Near Target (2) → Behind Pace (3)
      if (categoryA !== categoryB) {
        return categoryA - categoryB;
      }

      // Within same category, sort by target percentage (highest first for On Pace, lowest first for others)
      if (categoryA === 1) {
        return b.targetPercentage - a.targetPercentage; // On Pace: highest % first
      }
      return a.targetPercentage - b.targetPercentage; // Near/Behind: lowest % first (needs most attention)
    });

    // Assign ranks after sorting
    clients.forEach((client, index) => {
      client.rank = index + 1;
    });

    console.log(`Processed ${clients.length} clients for Volume Dashboard`);

    return new Response(JSON.stringify({ clients }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in volume-dashboard-data function:', error);
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
