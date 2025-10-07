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

  return {
    today: formatDate(today),
    mtdStart: formatDate(firstOfMonth),
    daysInMonth: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(),
    currentDay: today.getDate(),
  };
};

// Format number with commas
const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

// Generate Slack message blocks
const generateSlackMessage = (clients: any[], dateRanges: any) => {
  const totalEmails = clients.reduce((sum, c) => sum + c.emails, 0);
  const totalTargets = clients.reduce((sum, c) => sum + c.target, 0);
  const overallPercentage = totalTargets > 0 ? ((totalEmails / totalTargets) * 100).toFixed(1) : '0.0';

  const onTrackCount = clients.filter(c => c.isProjectedAboveTarget).length;
  const criticalClients = clients.filter(c => !c.isProjectedAboveTarget);
  const topPerformers = clients.filter(c => c.isProjectedAboveTarget);

  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📊 Daily Sending Volume Report",
        emoji: true
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Day ${dateRanges.currentDay} of ${dateRanges.daysInMonth}* | ${onTrackCount} of ${clients.length} clients on track to meet target`
      }
    },
    {
      type: "divider"
    }
  ];

  // Critical clients section - ALL clients behind pace
  if (criticalClients.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*🚨 Clients Needing Attention (Behind Pace):*"
      }
    });

    criticalClients.forEach((client) => {
      let emoji = '🟡';
      let action = '';

      if (client.emails === 0) {
        emoji = '🔴';
        action = '\n⚠️ *URGENT: No emails sent - Add contacts and start campaign*';
      } else if (client.projectedPercentage < 50) {
        emoji = '🔴';
        action = '\n⚠️ *Action: Add contacts or fix campaign*';
      } else if (client.dailyAverage < client.dailyQuota) {
        action = '\n⚠️ *Action: Add contacts or fix campaign*';
      }

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *${client.name}*\n• *Daily Avg:* ${formatNumber(client.dailyAverage)}/day (need ${formatNumber(client.dailyQuota)}/day)\n• *MTD:* ${formatNumber(client.emails)} / ${formatNumber(client.target)} (${client.targetPercentage.toFixed(1)}%)\n• *Projected EOM:* ${formatNumber(client.projection)} (${client.projectedPercentage.toFixed(0)}% of target)${action}`
        }
      });
    });

    blocks.push({
      type: "divider"
    });
  }

  // Top performers section - ALL clients on track
  if (topPerformers.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*✅ Clients On Track:*"
      }
    });

    topPerformers.forEach((client) => {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🟢 *${client.name}*\n• *Daily Avg:* ${formatNumber(client.dailyAverage)}/day (need ${formatNumber(client.dailyQuota)}/day)\n• *MTD:* ${formatNumber(client.emails)} / ${formatNumber(client.target)} (${client.targetPercentage.toFixed(1)}%)\n• *Projected EOM:* ${formatNumber(client.projection)} (${client.projectedPercentage.toFixed(0)}% of target)`
        }
      });
    });
  }

  blocks.push({
    type: "divider"
  });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Overall Progress:* ${formatNumber(totalEmails)} / ${formatNumber(totalTargets)} emails sent (${overallPercentage}% of monthly target)`
    }
  });

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `_Report generated: ${new Date().toLocaleString()}_`
      }
    ]
  });

  return { blocks };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const emailBisonApiKey = Deno.env.get('EMAIL_BISON_API_KEY');
    const slackWebhookUrl = Deno.env.get('SLACK_VOLUME_WEBHOOK_URL');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!emailBisonApiKey) {
      throw new Error('EMAIL_BISON_API_KEY not found');
    }
    if (!slackWebhookUrl) {
      throw new Error('SLACK_VOLUME_WEBHOOK_URL not found in Supabase secrets');
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not found');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching volume dashboard data for Slack...');

    const dateRanges = getDateRanges();

    // Fetch ALL workspaces from Email Bison
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
    const clients: any[] = [];

    for (const workspace of workspaces) {
      try {
        const settings = clientSettingsMap.get(workspace.name);

        // Skip if no settings or no sending target
        if (!settings || settings.sendingTarget === 0) {
          console.log(`  Skipping ${workspace.name} - no sending target in client_registry`);
          continue;
        }

        const clientName = settings.displayName;
        const monthlySendingTarget = settings.sendingTarget;

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
          console.error(`Failed to switch to workspace ${workspace.name}`);
          continue;
        }

        // Fetch MTD stats
        const mtdStatsResponse = await fetch(
          `${EMAIL_BISON_BASE_URL}/workspaces/v1.1/stats?start_date=${dateRanges.mtdStart}&end_date=${dateRanges.today}`,
          {
            headers: {
              'Authorization': `Bearer ${emailBisonApiKey}`,
              'Accept': 'application/json',
            },
          }
        );

        const mtdStats = await mtdStatsResponse.json();
        const emailsMTD = mtdStats.data?.emails_sent || 0;

        // Calculate daily quota and status
        const dailyQuota = monthlySendingTarget / dateRanges.daysInMonth;
        const daysElapsed = dateRanges.currentDay;

        // Calculate projection
        const dailyAverage = daysElapsed > 0 ? emailsMTD / daysElapsed : 0;
        const projectedEOM = Math.round(dailyAverage * dateRanges.daysInMonth);

        const targetPercentage = monthlySendingTarget > 0
          ? (emailsMTD / monthlySendingTarget) * 100
          : 0;

        const projectedPercentage = monthlySendingTarget > 0
          ? (projectedEOM / monthlySendingTarget) * 100
          : 0;

        const isProjectedAboveTarget = projectedEOM >= monthlySendingTarget;

        clients.push({
          name: clientName,
          emails: emailsMTD,
          target: monthlySendingTarget,
          projection: projectedEOM,
          targetPercentage,
          projectedPercentage,
          isProjectedAboveTarget,
          dailyQuota: Math.round(dailyQuota),
          dailyAverage: Math.round(dailyAverage),
        });

      } catch (error) {
        console.error(`Error fetching stats for workspace ${workspace.name}:`, error);
      }
    }

    // Sort clients by projection status
    clients.sort((a: any, b: any) => {
      if (a.emails === 0 && b.emails !== 0) return 1;
      if (a.emails !== 0 && b.emails === 0) return -1;

      const getCategory = (client: any) => {
        if (client.projectedPercentage >= 100) return 1;
        if (client.projectedPercentage >= 80) return 2;
        return 3;
      };

      const categoryA = getCategory(a);
      const categoryB = getCategory(b);

      if (categoryA !== categoryB) {
        return categoryA - categoryB;
      }

      if (categoryA === 1) {
        return b.targetPercentage - a.targetPercentage;
      }
      return a.targetPercentage - b.targetPercentage;
    });

    // Generate and send Slack message
    const slackMessage = generateSlackMessage(clients, dateRanges);

    console.log('Sending message to Slack...');
    const slackResponse = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackMessage),
    });

    if (!slackResponse.ok) {
      const errorText = await slackResponse.text();
      throw new Error(`Slack API error: ${slackResponse.status} - ${errorText}`);
    }

    console.log('Slack message sent successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Slack message sent successfully (using Supabase client_registry)',
        clientsProcessed: clients.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in send-volume-slack-dm function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
