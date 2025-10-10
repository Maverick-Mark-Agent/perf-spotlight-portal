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

// Generate Slack message blocks
const generateSlackMessage = (clients: any[]) => {
  const totalEmails = clients.reduce((sum, c) => sum + c.emails, 0);
  const totalDailyGoal = clients.reduce((sum, c) => sum + c.dailyQuota, 0);

  const blocks: any[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `📧 *${formatNumber(totalEmails)}* emails going out today\n🎯 *Total Daily Goal:* ${formatNumber(Math.round(totalDailyGoal))} emails`
      }
    },
    {
      type: "divider"
    }
  ];

  // Add each client's status
  clients.forEach((client) => {
    const status = client.dailyAverage >= client.dailyQuota ? '✅' : '⚠️';
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${status} *${client.name}*: ${formatNumber(client.dailyAverage)} emails going out vs ${formatNumber(client.dailyQuota)} needed`
      }
    });
  });

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

    // Transform database rows to match the format expected by Slack message
    const clients = metrics.map((row: any) => {
      const registry = row.client_registry;
      const emailsToday = row.emails_scheduled_today || 0; // SAME as Volume Dashboard
      const emailsMTD = row.emails_sent_mtd || 0;
      const dailyTarget = registry.daily_sending_target || 0;

      return {
        name: registry.display_name || registry.workspace_name,
        emails: emailsMTD,
        dailyQuota: dailyTarget,
        dailyAverage: emailsToday,
      };
    });

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
