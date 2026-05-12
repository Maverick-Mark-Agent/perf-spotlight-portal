import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get current date info
const getCurrentDateInfo = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const todayStr = today.toISOString().split('T')[0];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysElapsed = today.getDate();

  return { todayStr, daysInMonth, daysElapsed };
};

// Format number with commas
const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

// Generate Slack message blocks.
// Slack has a hard 50-block limit per message, and ~3000 chars per text field.
// We pack many clients into a single section's text body, splitting into
// additional sections only when the char limit is approached. This keeps the
// block count low (~5-6) regardless of how many clients we have.
const generateSlackMessage = (clients: any[]) => {
  const totalEmailsToday = clients.reduce((sum, c) => sum + c.dailyAverage, 0);
  const totalDailyGoal = clients.reduce((sum, c) => sum + c.dailyQuota, 0);

  const blocks: any[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `📧 *${formatNumber(totalEmailsToday)}* emails going out today\n🎯 *Total Daily Goal:* ${formatNumber(Math.round(totalDailyGoal))} emails`
      }
    },
    {
      type: "divider"
    }
  ];

  // Pack client lines into sections, each up to ~2800 chars to stay safely
  // under Slack's ~3000-char-per-text-field limit.
  const MAX_TEXT_CHARS = 2800;
  let currentLines: string[] = [];
  let currentLength = 0;

  const flushSection = () => {
    if (currentLines.length === 0) return;
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: currentLines.join('\n'),
      },
    });
    currentLines = [];
    currentLength = 0;
  };

  for (const client of clients) {
    const status = client.dailyAverage >= client.dailyQuota ? '✅' : '⚠️';
    const line = `${status} *${client.name}*: ${formatNumber(client.dailyAverage)} emails going out vs ${formatNumber(client.dailyQuota)} needed`;
    // +1 for the joining newline
    if (currentLength + line.length + 1 > MAX_TEXT_CHARS) {
      flushSection();
    }
    currentLines.push(line);
    currentLength += line.length + 1;
  }
  flushSection();

  // Hard cap at 50 blocks (Slack limit). Should never trigger with the packing
  // above, but defend against future field changes blowing out the budget.
  if (blocks.length > 50) {
    blocks.length = 49;
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `_…and ${clients.length} clients total — message truncated to fit Slack's block limit._` },
    });
  }

  return { blocks };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const slackWebhookUrl = Deno.env.get('SLACK_VOLUME_WEBHOOK_URL');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!slackWebhookUrl) {
      throw new Error('SLACK_VOLUME_WEBHOOK_URL not found in Supabase secrets');
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not found');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching volume data from database for Slack...');

    const { todayStr, daysInMonth, daysElapsed } = getCurrentDateInfo();

    // Query client_metrics with client_registry JOIN - same as Volume Dashboard
    const { data: metrics, error } = await supabase
      .from('client_metrics')
      .select(`
        *,
        client_registry!inner(
          workspace_name,
          display_name,
          monthly_sending_target,
          daily_sending_target,
          is_active
        )
      `)
      .eq('metric_type', 'mtd')
      .eq('metric_date', todayStr)
      .eq('client_registry.is_active', true)
      .order('emails_sent_mtd', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    if (!metrics || metrics.length === 0) {
      console.warn('No MTD data found for today:', todayStr);
      throw new Error('No data available - metrics may need to be synced');
    }

    console.log(`Found ${metrics.length} clients with MTD data`);

    // Clients to exclude from volume reports (0 emails going out vs 0 needed)
    const VOLUME_DASHBOARD_BLACKLIST = [
      'Maverick In-house',
      'LongRun',
      'Koppa Analytics',
      'Boring Book Keeping',
      'Radiant Energy',
      'Shane Miller',
      'ATI',
      'Ozment Media',
      'Littlegiant',
    ].map(name => name.toLowerCase().trim());

    // Transform database rows to match the format expected by Slack message
    const allClients = metrics.map((row: any) => {
      const registry = row.client_registry;
      const emailsToday = row.emails_scheduled_today || 0; // SAME as Volume Dashboard
      const emailsMTD = row.emails_sent_mtd || 0;
      const dailyTarget = registry.daily_sending_target || 0;

      const displayName = (registry.display_name || '').trim();
      const workspaceName = (registry.workspace_name || '').trim();
      const clientName = displayName || workspaceName;

      return {
        name: clientName,
        displayName,
        workspaceName,
        emails: emailsMTD,
        dailyQuota: dailyTarget,
        dailyAverage: emailsToday,
      };
    });

    // Filter out blacklisted clients - check both display_name and workspace_name
    const clients = allClients.filter((client) => {
      const displayNameLower = (client.displayName || '').toLowerCase().trim();
      const workspaceNameLower = (client.workspaceName || '').toLowerCase().trim();
      const clientNameLower = (client.name || '').toLowerCase().trim();

      const isExcluded = VOLUME_DASHBOARD_BLACKLIST.some(
        excluded => 
          excluded === displayNameLower ||
          excluded === workspaceNameLower ||
          excluded === clientNameLower
      );

      if (isExcluded) {
        console.log(`Filtering out blacklisted client: "${client.name}" (display: "${client.displayName}", workspace: "${client.workspaceName}")`);
      }

      return !isExcluded;
    });

    const filteredCount = allClients.length - clients.length;
    console.log(`Filtered ${filteredCount} blacklisted client(s) from Slack report (${allClients.length} total → ${clients.length} remaining)`);
    
    if (filteredCount > 0) {
      const clientNames = new Set(clients.map(c => c.name));
      const filteredNames = allClients
        .filter(c => !clientNames.has(c.name))
        .map(c => c.name);
      console.log(`Filtered client names: ${filteredNames.join(', ')}`);
    }

    // Generate and send Slack message
    const slackMessage = generateSlackMessage(clients);

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
        message: 'Slack message sent successfully (using database metrics)',
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
