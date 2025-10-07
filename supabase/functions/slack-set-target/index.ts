import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const slackSigningSecret = Deno.env.get('SLACK_SIGNING_SECRET');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse Slack request
    const formData = await req.formData();
    const text = formData.get('text')?.toString() || '';
    const userId = formData.get('user_id')?.toString() || '';
    const userName = formData.get('user_name')?.toString() || '';
    const responseUrl = formData.get('response_url')?.toString() || '';

    console.log(`Slash command received from ${userName}: /set-target ${text}`);

    // Parse command: /set-target <workspace_name> <target>
    // Support quoted workspace names: /set-target "John Roberts" 45500
    const match = text.match(/^(?:"([^"]+)"|(\S+))\s+(\d+)$/);

    if (!match) {
      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: '❌ Invalid format. Usage: `/set-target <workspace_name> <target>`\n\nExamples:\n• `/set-target "John Roberts" 45500`\n• `/set-target Danny 45500`'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const workspaceName = match[1] || match[2];
    const target = parseInt(match[3], 10);

    console.log(`Setting target for "${workspaceName}" to ${target}`);

    // Update client_registry
    const { data: updatedClient, error: updateError } = await supabase
      .from('client_registry')
      .update({ monthly_sending_target: target })
      .eq('workspace_name', workspaceName)
      .select('workspace_name, display_name, monthly_sending_target')
      .single();

    if (updateError || !updatedClient) {
      console.error('Update error:', updateError);

      // Try to find similar workspace names
      const { data: similarClients } = await supabase
        .from('client_registry')
        .select('workspace_name, display_name')
        .ilike('workspace_name', `%${workspaceName}%`)
        .limit(5);

      let suggestions = '';
      if (similarClients && similarClients.length > 0) {
        suggestions = '\n\n*Did you mean one of these?*\n' +
          similarClients.map(c => `• \`${c.workspace_name}\``).join('\n');
      }

      return new Response(
        JSON.stringify({
          response_type: 'ephemeral',
          text: `❌ Client not found: "${workspaceName}"${suggestions}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send success response
    const successMessage = {
      response_type: 'in_channel',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ *Client target updated by <@${userId}>*`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Client:*\n${updatedClient.display_name}`
            },
            {
              type: 'mrkdwn',
              text: `*Monthly Target:*\n${target.toLocaleString()} emails`
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `This client will now appear in volume reports and daily Slack notifications.`
            }
          ]
        }
      ]
    };

    return new Response(
      JSON.stringify(successMessage),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in slack-set-target function:', error);
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }),
      {
        status: 200, // Slack expects 200 even for errors
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
