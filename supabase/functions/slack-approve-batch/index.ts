import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * SLACK APPROVE BATCH SLASH COMMAND HANDLER
 *
 * Handles /approve-batch <batch_id> slash command from Slack
 *
 * Process:
 * 1. Parse batch_id from command text
 * 2. Validate batch exists and is pending
 * 3. Mark batch as approved
 * 4. Trigger upload-to-email-bison function
 * 5. Post confirmation to Slack channel
 *
 * Command Format:
 * /approve-batch <batch_id>
 *
 * Example:
 * /approve-batch 123e4567-e89b-12d3-a456-426614174000
 */

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse Slack command payload
    const formData = await req.formData();
    const text = formData.get('text') as string;
    const userName = formData.get('user_name') as string;
    const userId = formData.get('user_id') as string;

    if (!text) {
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: '❌ Usage: /approve-batch <batch_id>\n\nExample: /approve-batch 123e4567-e89b-12d3-a456-426614174000'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const batchId = text.trim();

    console.log(`Approving batch ${batchId} by ${userName}`);

    // Fetch batch
    const { data: batch, error: batchError } = await supabase
      .from('weekly_batches')
      .select('*')
      .eq('batch_id', batchId)
      .single();

    if (batchError || !batch) {
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: `❌ Batch not found: \`${batchId}\`\n\nPlease check the batch ID and try again.`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if already approved
    if (batch.slack_approved_at) {
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: `⚠️ Batch \`${batchId}\` was already approved by ${batch.slack_approved_by} on ${new Date(batch.slack_approved_at).toLocaleString()}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if already uploaded
    if (batch.bison_upload_status === 'added_to_campaign') {
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: `⚠️ Batch \`${batchId}\` has already been uploaded to Email Bison`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Mark batch as approved
    await supabase
      .from('weekly_batches')
      .update({
        slack_approved_by: userName || userId,
        slack_approved_at: new Date().toISOString(),
      })
      .eq('batch_id', batchId);

    console.log(`Batch ${batchId} approved by ${userName}`);

    // Trigger upload to Email Bison
    console.log('Triggering upload to Email Bison...');
    const uploadResponse = await fetch(
      `${supabaseUrl}/functions/v1/upload-to-email-bison`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ batch_id: batchId }),
      }
    );

    let uploadResult;
    let uploadSuccess = false;

    if (uploadResponse.ok) {
      uploadResult = await uploadResponse.json();
      uploadSuccess = uploadResult.success;
    } else {
      const errorText = await uploadResponse.text();
      uploadResult = { error: errorText };
    }

    // Post confirmation to channel
    if (slackWebhookUrl) {
      const confirmationMessage = {
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: uploadSuccess
                ? `✅ *Batch Approved & Uploaded*\n\n` +
                  `• *Batch ID:* \`${batchId}\`\n` +
                  `• *Client:* ${batch.workspace_name}\n` +
                  `• *Week:* ${batch.week_number}\n` +
                  `• *Contacts:* ${batch.contact_count.toLocaleString()}\n` +
                  `• *Approved by:* ${userName}\n` +
                  `• *Status:* Uploaded to Email Bison successfully`
                : `⚠️ *Batch Approved but Upload Failed*\n\n` +
                  `• *Batch ID:* \`${batchId}\`\n` +
                  `• *Client:* ${batch.workspace_name}\n` +
                  `• *Approved by:* ${userName}\n` +
                  `• *Error:* ${uploadResult.error || 'Unknown error'}\n\n` +
                  `Please check logs and retry upload manually.`
            }
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `_${new Date().toLocaleString()}_`
              }
            ]
          }
        ]
      };

      await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmationMessage),
      });
    }

    // Return immediate response to Slack command
    return new Response(
      JSON.stringify({
        response_type: 'in_channel',
        text: uploadSuccess
          ? `✅ Batch \`${batchId}\` approved and uploaded successfully! (${batch.contact_count.toLocaleString()} contacts)`
          : `⚠️ Batch \`${batchId}\` approved, but upload failed. Check channel for details.`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in slack-approve-batch function:', error);
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
