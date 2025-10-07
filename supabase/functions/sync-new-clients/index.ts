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
    const emailBisonApiKey = Deno.env.get('EMAIL_BISON_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!emailBisonApiKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔄 Syncing new Email Bison workspaces to client_registry...');

    // Fetch all Email Bison workspaces
    const bisonResponse = await fetch('https://send.maverickmarketingllc.com/api/workspaces/v1.1', {
      headers: {
        'Authorization': `Bearer ${emailBisonApiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!bisonResponse.ok) {
      throw new Error(`Email Bison API error: ${bisonResponse.status}`);
    }

    const bisonData = await bisonResponse.json();
    const bisonWorkspaces = bisonData.data || [];

    console.log(`📊 Found ${bisonWorkspaces.length} workspaces in Email Bison`);

    // Fetch existing clients from registry
    const { data: existingClients, error: fetchError } = await supabase
      .from('client_registry')
      .select('workspace_name, workspace_id');

    if (fetchError) {
      throw new Error(`Error fetching registry: ${fetchError.message}`);
    }

    const existingWorkspaceNames = new Set(existingClients?.map(c => c.workspace_name) || []);
    const existingWorkspaceIds = new Set(existingClients?.map(c => c.workspace_id) || []);

    console.log(`📊 Found ${existingClients?.length || 0} clients in registry`);

    // Find new workspaces
    const newWorkspaces = bisonWorkspaces.filter(
      (w: any) => !existingWorkspaceNames.has(w.name) && !existingWorkspaceIds.has(w.id)
    );

    if (newWorkspaces.length === 0) {
      console.log('✅ No new workspaces to add');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No new workspaces to add',
          newClients: 0,
          totalClients: existingClients?.length || 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🆕 Found ${newWorkspaces.length} new workspaces to add`);

    // Add new workspaces to registry
    const newClients = newWorkspaces.map((workspace: any) => ({
      workspace_id: workspace.id,
      workspace_name: workspace.name,
      display_name: workspace.name,
      monthly_sending_target: 0,
      is_active: true,
    }));

    const { data: insertedClients, error: insertError } = await supabase
      .from('client_registry')
      .insert(newClients)
      .select();

    if (insertError) {
      throw new Error(`Error inserting new clients: ${insertError.message}`);
    }

    console.log(`✅ Added ${insertedClients?.length || 0} new clients`);

    // Send Slack notification for new clients (use same webhook as volume notifications)
    const slackWebhookUrl = Deno.env.get('SLACK_VOLUME_WEBHOOK_URL') || Deno.env.get('SLACK_NEW_CLIENT_WEBHOOK_URL');

    if (slackWebhookUrl && insertedClients && insertedClients.length > 0) {
      console.log('Sending Slack notification for new clients...');

      const blocks: any[] = [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `🆕 ${insertedClients.length} New Email Bison Client${insertedClients.length > 1 ? 's' : ''} Added`,
            emoji: true
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Please set monthly sending targets for the following clients to include them in volume reports:`
          }
        },
        {
          type: "divider"
        }
      ];

      insertedClients.forEach((client: any) => {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${client.display_name}*\n• Workspace: \`${client.workspace_name}\`\n• Current Target: 0 (excluded from reports)\n• To set target, reply: \`/set-target ${client.workspace_name} 45500\``
          }
        });
      });

      blocks.push({
        type: "divider"
      });

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "📝 *How to set targets:*\nReply to this message with: `/set-target <workspace_name> <target>`\n\nExample: `/set-target \"John Roberts\" 45500`"
        }
      });

      const slackResponse = await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks }),
      });

      if (!slackResponse.ok) {
        console.error('Failed to send Slack notification:', await slackResponse.text());
      } else {
        console.log('Slack notification sent successfully');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Added ${insertedClients?.length || 0} new clients`,
        newClients: insertedClients?.length || 0,
        totalClients: (existingClients?.length || 0) + (insertedClients?.length || 0),
        addedWorkspaces: insertedClients?.map((c: any) => c.workspace_name),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-new-clients function:', error);
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
