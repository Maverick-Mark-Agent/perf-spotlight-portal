import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * SLACK NOTIFY WEEKLY BATCH EDGE FUNCTION
 *
 * Sends Slack notification for weekly batch approval
 *
 * Process:
 * 1. Fetch pending batches scheduled for today
 * 2. Generate approval message with batch details
 * 3. Send to Slack with action buttons
 * 4. Track notification status
 *
 * Message Format:
 * - Client name, week number, contact count
 * - Breakdown: standard vs HNW contacts
 * - Renewal date range
 * - Approve/Reject buttons (manual for now, automated later)
 *
 * Workflow:
 * - Initial: Manual approval via Slack reply
 * - Future: Interactive buttons with Slack API integration
 */

interface WeeklyBatch {
  batch_id: string;
  workspace_name: string;
  month: string;
  week_number: number;
  scheduled_upload_date: string;
  contact_count: number;
  hnw_count: number;
  bison_upload_status: string;
}

/**
 * Generate Slack message blocks for batch approval
 */
function generateSlackMessage(batches: WeeklyBatch[], clientDisplayNames: Record<string, string>) {
  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📋 Weekly Contact Upload - Approval Required",
        emoji: true
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${batches.length} batch${batches.length !== 1 ? 'es' : ''} scheduled for upload today*\n_Please review and approve each batch below_`
      }
    },
    {
      type: "divider"
    }
  ];

  batches.forEach((batch) => {
    const clientName = clientDisplayNames[batch.workspace_name] || batch.workspace_name;
    const standardCount = batch.contact_count - batch.hnw_count;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${clientName}* - Week ${batch.week_number}\n` +
              `• *Batch ID:* \`${batch.batch_id}\`\n` +
              `• *Total Contacts:* ${batch.contact_count.toLocaleString()}\n` +
              `• *Standard:* ${standardCount.toLocaleString()} (Evergreen campaign)\n` +
              `• *High Net Worth:* ${batch.hnw_count.toLocaleString()} (HNW Evergreen campaign)\n` +
              `• *Upload Date:* ${batch.scheduled_upload_date}`
      }
    });

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `To approve: Reply with \`/approve-batch ${batch.batch_id}\``
        }
      ]
    });

    blocks.push({
      type: "divider"
    });
  });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: "*📌 Next Steps:*\n" +
            "1. Review contact counts for each client\n" +
            "2. Approve batches by replying with \`/approve-batch <batch_id>\`\n" +
            "3. Approved batches will be uploaded to Email Bison automatically"
    }
  });

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `_Notification sent: ${new Date().toLocaleString()}_`
      }
    ]
  });

  return { blocks };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const slackWebhookUrl = Deno.env.get('SLACK_VOLUME_WEBHOOK_URL');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not found');
    }
    if (!slackWebhookUrl) {
      throw new Error('SLACK_VOLUME_WEBHOOK_URL not found');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Checking for pending weekly batches...');

    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Fetch pending batches scheduled for today
    const { data: batches, error: batchesError } = await supabase
      .from('weekly_batches')
      .select('*')
      .eq('scheduled_upload_date', today)
      .eq('bison_upload_status', 'pending')
      .eq('slack_notification_sent', false);

    if (batchesError) {
      throw new Error(`Failed to fetch batches: ${batchesError.message}`);
    }

    if (!batches || batches.length === 0) {
      console.log('No pending batches scheduled for today');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending batches scheduled for today',
          batches_notified: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${batches.length} pending batches`);

    // Get client display names
    const workspaceNames = [...new Set(batches.map(b => b.workspace_name))];
    const { data: clients, error: clientsError } = await supabase
      .from('client_registry')
      .select('workspace_name, display_name')
      .in('workspace_name', workspaceNames);

    if (clientsError) {
      console.error('Error fetching client names:', clientsError);
    }

    const clientDisplayNames: Record<string, string> = {};
    (clients || []).forEach((client: any) => {
      clientDisplayNames[client.workspace_name] = client.display_name || client.workspace_name;
    });

    // Generate Slack message
    const slackMessage = generateSlackMessage(batches as WeeklyBatch[], clientDisplayNames);

    // Send to Slack
    console.log('Sending notification to Slack...');
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

    console.log('Slack notification sent successfully');

    // Update batches to mark notification as sent
    const batchIds = batches.map(b => b.batch_id);
    await supabase
      .from('weekly_batches')
      .update({
        slack_notification_sent: true,
        // Note: slack_message_ts would be set here if using Slack API directly
      })
      .in('batch_id', batchIds);

    // Log to audit
    await supabase.from('upload_audit_log').insert({
      workspace_name: batches[0].workspace_name,
      month: batches[0].month,
      action: 'slack_notification',
      status: 'success',
      contacts_processed: batches.reduce((sum, b) => sum + b.contact_count, 0),
      api_endpoint: slackWebhookUrl,
      api_response: {
        batches_notified: batches.length,
        batch_ids: batchIds,
      },
      performed_by: 'system',
    });

    return new Response(
      JSON.stringify({
        success: true,
        batches_notified: batches.length,
        batch_ids: batchIds,
        message: `Sent Slack notification for ${batches.length} pending batches`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in slack-notify-weekly-batch function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
