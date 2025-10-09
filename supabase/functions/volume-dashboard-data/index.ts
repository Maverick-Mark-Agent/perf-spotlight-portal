import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAVERICK_BISON_BASE_URL = 'https://send.maverickmarketingllc.com/api';
const LONGRUN_BISON_BASE_URL = 'https://send.longrun.agency/api';

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
    const maverickBisonApiKey = Deno.env.get('EMAIL_BISON_API_KEY');
    const longrunBisonApiKey = Deno.env.get('LONG_RUN_BISON_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!maverickBisonApiKey) {
      throw new Error('EMAIL_BISON_API_KEY not found');
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not found');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching volume dashboard data...');

    const dateRanges = getDateRanges();
    console.log('Date ranges:', dateRanges);

    // Fetch client settings from Supabase client_registry (with workspace-specific API keys)
    const { data: clientRegistry, error: registryError } = await supabase
      .from('client_registry')
      .select('workspace_name, display_name, monthly_sending_target, is_active, bison_workspace_id, bison_instance, bison_api_key')
      .eq('is_active', true);

    if (registryError) {
      console.error('Error fetching client registry:', registryError);
      throw registryError;
    }

    // Create list of clients with their API keys and settings
    // Using workspace-specific API keys is MORE RELIABLE than switching workspaces with master key
    const clientsToFetch: any[] = [];

    (clientRegistry || []).forEach((client: any) => {
      // Skip clients without API keys or sending targets
      if (!client.bison_api_key || !client.monthly_sending_target || client.monthly_sending_target === 0) {
        console.log(`Skipping ${client.workspace_name} - missing API key or no sending target`);
        return;
      }

      // Determine base URL from instance
      const baseUrl = client.bison_instance === 'Long Run'
        ? LONGRUN_BISON_BASE_URL
        : MAVERICK_BISON_BASE_URL;

      clientsToFetch.push({
        workspaceName: client.workspace_name,
        displayName: client.display_name || client.workspace_name,
        sendingTarget: client.monthly_sending_target,
        apiKey: client.bison_api_key,
        baseUrl: baseUrl,
        workspaceId: client.bison_workspace_id,
        instance: client.bison_instance,
      });
    });

    console.log(`Fetched ${clientRegistry.length} client records from Supabase client_registry`);
    console.log(`Found ${clientsToFetch.length} clients with API keys and sending targets`);

    // Fetch Email Bison stats using workspace-specific API keys (NO workspace switching needed!)
    console.log('Fetching Email Bison stats using workspace-specific API keys...');

    const clients: any[] = [];

    // Helper function to fetch data for a single client using their workspace-specific API key
    const fetchClientData = async (client: any) => {
      try {
        const { workspaceName, displayName, sendingTarget, apiKey, baseUrl } = client;

        console.log(`Fetching data for ${displayName}...`);

        // Fetch scheduled emails for today AND MTD stats in parallel
        const [sendingScheduleResponse, mtdStats, last7DaysStats, last30DaysStats] = await Promise.all([
          // Get today's scheduled emails using sending-schedules endpoint
          fetch(
            `${baseUrl}/campaigns/sending-schedules?day=today`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
              },
            }
          ).then(r => r.json()),
          // Get MTD stats
          fetch(
            `${baseUrl}/workspaces/v1.1/stats?start_date=${dateRanges.mtdStart}&end_date=${dateRanges.today}`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
              },
            }
          ).then(r => r.json()),
          // Get last 7 days stats
          fetch(
            `${baseUrl}/workspaces/v1.1/stats?start_date=${dateRanges.last7DaysStart}&end_date=${dateRanges.today}`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
              },
            }
          ).then(r => r.json()),
          // Get last 30 days stats
          fetch(
            `${baseUrl}/workspaces/v1.1/stats?start_date=${dateRanges.last30DaysStart}&end_date=${dateRanges.today}`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
              },
            }
          ).then(r => r.json()),
        ]);

        // Extract email volumes
        const emailsMTD = mtdStats.data?.emails_sent || 0;
        const emailsLast7Days = last7DaysStats.data?.emails_sent || 0;
        const emailsLast30Days = last30DaysStats.data?.emails_sent || 0;

        // Calculate scheduled emails for TODAY from sending-schedules endpoint
        let emailsScheduledToday = 0;
        try {
          if (sendingScheduleResponse?.data && Array.isArray(sendingScheduleResponse.data)) {
            // Sum up emails_being_sent across all campaigns
            emailsScheduledToday = sendingScheduleResponse.data.reduce((total: number, item: any) => {
              const scheduled = item?.emails_being_sent || 0;
              return total + scheduled;
            }, 0);
            console.log(`✓ ${displayName}: ${emailsScheduledToday} emails scheduled for today across ${sendingScheduleResponse.data.length} campaigns`);
          } else {
            console.warn(`⚠ ${displayName}: Unexpected sending schedule response:`, sendingScheduleResponse);
          }
        } catch (scheduleError) {
          console.error(`✗ Error parsing sending schedule for ${displayName}:`, scheduleError);
        }

        const emailsToday = emailsScheduledToday;
        const monthlySendingTarget = sendingTarget;

        // Data consistency validation checks
        const validationIssues: string[] = [];

        // Check for negative values (impossible)
        if (emailsMTD < 0 || emailsToday < 0 || emailsLast7Days < 0 || emailsLast30Days < 0) {
          validationIssues.push('Negative email counts detected');
        }

        // Check for logical consistency: MTD should not exceed last 30 days
        if (emailsMTD > emailsLast30Days) {
          validationIssues.push(`MTD (${emailsMTD}) exceeds Last 30 Days (${emailsLast30Days})`);
        }

        // NOTE: We no longer validate emailsToday > emailsMTD because emailsToday is now SCHEDULED (future)
        // while emailsMTD is SENT (past). Scheduled can be higher than sent.
        // Previously: emailsToday was sent count (subset of MTD), now it's scheduled count (independent metric)

        // Check for logical consistency: Last 7 days should not exceed last 30 days
        if (emailsLast7Days > emailsLast30Days) {
          validationIssues.push(`Last 7 Days (${emailsLast7Days}) exceeds Last 30 Days (${emailsLast30Days})`);
        }

        // Check for absurdly high values (> 1 million per month is suspicious)
        if (emailsMTD > 1000000) {
          validationIssues.push(`Suspiciously high MTD value: ${emailsMTD}`);
        }

        // Check for absurdly high scheduled count (> 100k in one day is suspicious)
        if (emailsToday > 100000) {
          validationIssues.push(`Suspiciously high scheduled count for today: ${emailsToday}`);
        }

        // Log validation issues if any
        if (validationIssues.length > 0) {
          console.error(`⚠ Data validation issues for ${workspace.name}:`, validationIssues);
          // Don't return null - just log the issues for monitoring
        }

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

        console.log(`✓ ${displayName}: MTD=${emailsMTD}, Projected=${projectedEOM}, Scheduled Today=${emailsToday}`);

        return {
          id: client.workspaceId,
          name: displayName,
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
        };

      } catch (error) {
        console.error(`✗ Error fetching stats for client ${client.displayName}:`, error);
        return null;
      }
    };

    // Process all clients using their workspace-specific API keys
    // No workspace switching needed! Much faster and more reliable.
    console.log(`Processing ${clientsToFetch.length} clients with workspace-specific API keys...`);

    for (let i = 0; i < clientsToFetch.length; i++) {
      const client = clientsToFetch[i];
      console.log(`[${i + 1}/${clientsToFetch.length}] Processing ${client.displayName}...`);

      const result = await fetchClientData(client);
      if (result) {
        clients.push(result);
      }

      // Small delay between requests to be respectful to the API
      if (i < clientsToFetch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
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
