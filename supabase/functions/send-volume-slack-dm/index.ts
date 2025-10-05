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
  const criticalClients = clients.filter(c => c.emails > 0 && c.projectedPercentage < 80).slice(0, 5);
  const topPerformers = clients.filter(c => c.isProjectedAboveTarget).slice(0, 5);

  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📊 Sending Volume Report - Month to Date",
        emoji: true
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Overall Progress:* ${overallPercentage}% (${formatNumber(totalEmails)} / ${formatNumber(totalTargets)})\n*On Track to Meet Target:* ${onTrackCount} / ${clients.length} clients\n*Day ${dateRanges.currentDay} of ${dateRanges.daysInMonth}*`
      }
    },
    {
      type: "divider"
    }
  ];

  // Critical clients section
  if (criticalClients.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*🚨 Critical Clients (Behind Pace):*"
      }
    });

    criticalClients.forEach((client) => {
      const emoji = client.projectedPercentage < 50 ? '🔴' : '🟡';
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *${client.name}*\n• Current: ${formatNumber(client.emails)} (${client.targetPercentage.toFixed(1)}%)\n• Projected: ${formatNumber(client.projection)} (${client.projectedPercentage.toFixed(1)}% of target)\n• Need/day: ${formatNumber(client.dailyQuota)}`
        }
      });
    });

    blocks.push({
      type: "divider"
    });
  }

  // Top performers section
  if (topPerformers.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*✅ Top Performers (On Track):*"
      }
    });

    topPerformers.forEach((client) => {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🟢 *${client.name}*\n• Current: ${formatNumber(client.emails)} (${client.targetPercentage.toFixed(1)}%)\n• Projected: ${formatNumber(client.projection)} (${client.projectedPercentage.toFixed(1)}% of target)`
        }
      });
    });
  }

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
    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');
    const slackWebhookUrl = Deno.env.get('SLACK_VOLUME_WEBHOOK_URL');

    if (!emailBisonApiKey) {
      throw new Error('EMAIL_BISON_API_KEY not found');
    }
    if (!airtableApiKey) {
      throw new Error('AIRTABLE_API_KEY not found');
    }
    if (!slackWebhookUrl) {
      throw new Error('SLACK_VOLUME_WEBHOOK_URL not found in Supabase secrets');
    }

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

    // Fetch client data from Airtable "Positive Replies" view
    const airtableBaseId = 'appONMVSIf5czukkf';
    const clientsTable = '👨‍💻 Clients';
    const viewName = 'Positive Replies';

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

    // Fetch Email Bison stats using SEQUENTIAL workspace switching
    const clients: any[] = [];

    for (const workspace of workspaces) {
      try {
        const airtableRecord = allClientRecords.find(
          (record: any) => record.fields['Workspace Name'] === workspace.name
        );

        if (!airtableRecord) {
          continue;
        }

        const fields = airtableRecord.fields;
        const clientName = fields['Client Company Name'] || 'Unknown Client';

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

        const monthlySendingTarget = fields['Monthly Sending Target'] || 0;

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
        message: 'Slack message sent successfully',
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
