import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_BISON_BASE_URL = 'https://send.maverickmarketingllc.com/api';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const emailBisonApiKey = Deno.env.get('EMAIL_BISON_API_KEY');
    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');

    if (!emailBisonApiKey || !airtableApiKey) {
      throw new Error('Missing API keys');
    }

    console.log('Starting campaign sync...');

    const airtableBaseId = 'appONMVSIf5czukkf';
    const clientsTable = '👨‍💻 Clients';
    const campaignsTable = 'Campaigns Performance';

    // Step 1: Fetch all workspaces from Email Bison
    const workspacesResponse = await fetch(`${EMAIL_BISON_BASE_URL}/workspaces/v1.1`, {
      headers: {
        'Authorization': `Bearer ${emailBisonApiKey}`,
        'Accept': 'application/json',
      },
    });

    const workspacesData = await workspacesResponse.json();
    const workspaces = workspacesData.data || [];
    console.log(`Found ${workspaces.length} workspaces in Email Bison`);

    // Step 2: Fetch all clients from Airtable to get workspace name → client record ID mapping
    let allClientRecords: any[] = [];
    let offset = null;

    do {
      const url = new URL(`https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(clientsTable)}`);
      url.searchParams.append('view', 'Positive Replies');
      if (offset) {
        url.searchParams.append('offset', offset);
      }

      const airtableResponse = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const airtableData = await airtableResponse.json();
      allClientRecords = allClientRecords.concat(airtableData.records || []);
      offset = airtableData.offset;
    } while (offset);

    // Create workspace name → client record ID map
    const workspaceToClientMap = new Map();
    allClientRecords.forEach((record: any) => {
      const workspaceName = record.fields['Workspace Name'];
      if (workspaceName) {
        workspaceToClientMap.set(workspaceName, record.id);
      }
    });

    console.log(`Mapped ${workspaceToClientMap.size} workspace names to client IDs`);

    // Step 3: For each workspace, fetch campaigns and sync to Airtable
    let totalSynced = 0;
    let totalUpdated = 0;
    let totalCreated = 0;

    for (const workspace of workspaces) {
      const clientRecordId = workspaceToClientMap.get(workspace.name);

      if (!clientRecordId) {
        console.log(`Skipping workspace "${workspace.name}" - no matching client in Airtable`);
        continue;
      }

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

      // Fetch campaigns for this workspace
      const campaignsResponse = await fetch(
        `${EMAIL_BISON_BASE_URL}/campaigns?limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${emailBisonApiKey}`,
            'Accept': 'application/json',
          },
        }
      );

      const campaignsData = await campaignsResponse.json();
      const campaigns = campaignsData.data || [];

      console.log(`Found ${campaigns.length} campaigns for ${workspace.name}`);

      // Sync each campaign to Airtable
      for (const campaign of campaigns) {
        try {
          // Check if campaign already exists in Airtable
          const searchUrl = `https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(campaignsTable)}?filterByFormula=` +
            encodeURIComponent(`{Campaign ID}=${campaign.id}`);

          const searchResponse = await fetch(searchUrl, {
            headers: {
              'Authorization': `Bearer ${airtableApiKey}`,
            },
          });

          const searchData = await searchResponse.json();
          const existingRecord = searchData.records?.[0];

          const campaignData = {
            'Campaign ID': campaign.id,
            'Campaign UUID': campaign.uuid,
            'Campaign Name': campaign.name,
            'Campaign Status': campaign.status,
            'Emails Sent': campaign.emails_sent,
            'Bounced': campaign.bounced,
            'Replies Received': campaign.replied,
            'Unique Replies Received': campaign.unique_replies,
            'Completion Percentage': campaign.completion_percentage,
            'Total Leads': campaign.total_leads,
            'Total Leads Contacted': campaign.total_leads_contacted,
            'Max Emails Per Day': campaign.max_emails_per_day,
            'Max New Leads Per Day': campaign.max_new_leads_per_day,
            'Plain Text enabled?': campaign.plain_text,
            'Created At': campaign.created_at,
            'Client Linked': [clientRecordId], // Link to client
          };

          if (existingRecord) {
            // Update existing record
            await fetch(`https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(campaignsTable)}/${existingRecord.id}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${airtableApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ fields: campaignData }),
            });
            totalUpdated++;
          } else {
            // Create new record
            await fetch(`https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(campaignsTable)}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${airtableApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ fields: campaignData }),
            });
            totalCreated++;
          }

          totalSynced++;

          // Rate limit: Airtable allows 5 requests per second
          await new Promise(resolve => setTimeout(resolve, 250));

        } catch (error) {
          console.error(`Error syncing campaign ${campaign.id}:`, error);
        }
      }
    }

    console.log(`Sync complete: ${totalSynced} campaigns synced (${totalCreated} created, ${totalUpdated} updated)`);

    return new Response(
      JSON.stringify({
        success: true,
        total_synced: totalSynced,
        created: totalCreated,
        updated: totalUpdated,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
