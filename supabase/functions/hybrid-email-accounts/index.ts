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

    if (!emailBisonApiKey) {
      throw new Error('EMAIL_BISON_API_KEY not found');
    }
    if (!airtableApiKey) {
      throw new Error('AIRTABLE_API_KEY not found');
    }

    console.log('Fetching workspaces from Email Bison...');

    // Step 1: Fetch all workspaces
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

    console.log(`Fetched ${workspaces.length} workspaces`);

    // Step 2: Fetch sender emails from each workspace by switching context
    // NOTE: Email Bison API is session-based, must switch workspace to see its sender emails
    let allSenderEmails: any[] = [];

    for (const workspace of workspaces) {
      try {
        console.log(`Switching to workspace: ${workspace.name} (ID: ${workspace.id})`);

        // Switch to the workspace
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
          console.error(`Failed to switch to workspace ${workspace.name}: ${switchResponse.status}`);
          continue;
        }

        // Fetch ALL sender emails for this workspace with pagination
        let workspaceSenderEmails: any[] = [];
        let nextUrl: string | null = `${EMAIL_BISON_BASE_URL}/sender-emails?per_page=100`;

        // Loop through all pages
        while (nextUrl) {
          const bisonResponse = await fetch(nextUrl, {
            headers: {
              'Authorization': `Bearer ${emailBisonApiKey}`,
              'Accept': 'application/json',
            },
          });

          if (!bisonResponse.ok) {
            console.error(`Failed to fetch sender emails for workspace ${workspace.name}: ${bisonResponse.status}`);
            break;
          }

          const bisonData = await bisonResponse.json();
          const pageEmails = bisonData.data || [];

          // Add workspace context to each sender email
          pageEmails.forEach((email: any) => {
            email.workspace_id = workspace.id;
            email.workspace_name = workspace.name;
          });

          workspaceSenderEmails = workspaceSenderEmails.concat(pageEmails);

          // Check for next page
          nextUrl = bisonData.links?.next || null;

          console.log(`Fetched ${pageEmails.length} sender emails from ${workspace.name} (page ${bisonData.meta?.current_page || 1}/${bisonData.meta?.last_page || 1})`);
        }

        allSenderEmails = allSenderEmails.concat(workspaceSenderEmails);
        console.log(`Total fetched from ${workspace.name}: ${workspaceSenderEmails.length} sender emails`);

      } catch (error) {
        console.error(`Error fetching sender emails for workspace ${workspace.name}:`, error);
      }
    }

    const senderEmails = allSenderEmails;
    console.log(`Total sender emails fetched across all workspaces: ${senderEmails.length}`);

    // Fetch email accounts from Airtable for additional metadata (pricing, tags, etc.)
    console.log('Fetching email account metadata from Airtable...');

    const airtableBaseId = 'appONMVSIf5czukkf';
    const airtableTable = 'Email%20Accounts';

    let allAirtableRecords: any[] = [];
    let offset = null;

    do {
      const url = new URL(`https://api.airtable.com/v0/${airtableBaseId}/${airtableTable}`);
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
        break; // Continue without Airtable data if it fails
      }

      const airtableData = await airtableResponse.json();
      allAirtableRecords = allAirtableRecords.concat(airtableData.records || []);
      offset = airtableData.offset;

    } while (offset);

    console.log(`Fetched ${allAirtableRecords.length} records from Airtable`);

    // Create a map of Airtable data by email address for quick lookup
    const airtableMap = new Map();
    allAirtableRecords.forEach(record => {
      const email = record.fields['Email Account'];
      if (email) {
        airtableMap.set(email.toLowerCase(), record.fields);
      }
    });

    // Merge Email Bison data with Airtable metadata
    const mergedRecords = senderEmails.map((bisonEmail: any) => {
      const airtableData = airtableMap.get(bisonEmail.email.toLowerCase()) || {};

      return {
        id: bisonEmail.id,
        fields: {
          // Email Bison data (real-time metrics)
          'Email Account': bisonEmail.email,
          'Name': bisonEmail.name,
          'Status': bisonEmail.status,
          'Daily Limit': bisonEmail.daily_limit,
          'Total Sent': bisonEmail.emails_sent_count,
          'Total Replied': bisonEmail.total_replied_count,
          'Total Bounced': bisonEmail.bounced_count,
          'Total Opened': bisonEmail.total_opened_count,
          'Unique Replied': bisonEmail.unique_replied_count,
          'Unique Opened': bisonEmail.unique_opened_count,
          'Total Leads Contacted': bisonEmail.total_leads_contacted_count,
          'Interested Leads': bisonEmail.interested_leads_count,
          'Unsubscribed': bisonEmail.unsubscribed_count,
          'Account Type': bisonEmail.type,

          // Calculate reply rate
          'Reply Rate Per Account %': bisonEmail.emails_sent_count > 0
            ? (bisonEmail.unique_replied_count / bisonEmail.emails_sent_count) * 100
            : 0,

          // Workspace info from Email Bison
          'Workspace': bisonEmail.workspace_name || airtableData['Workspace'] || 'Unknown',
          'Workspace ID': bisonEmail.workspace_id,

          // Airtable metadata (pricing, tags, custom fields)
          'Price': airtableData['Price'] || 0,
          'Tag - Email Provider': airtableData['Tag - Email Provider'] || extractProviderFromTags(bisonEmail.tags),
          'Tag - Reseller': airtableData['Tag - Reseller'] || extractResellerFromTags(bisonEmail.tags),
          'Client': airtableData['Client'] || [],
          'Client Name (from Client)': airtableData['Client Name (from Client)'] || [],
          'Domain': airtableData['Domain'] || bisonEmail.email.split('@')[1] || '',
          'Volume Per Account': airtableData['Volume Per Account'] || bisonEmail.daily_limit,
          'Clients Daily Volume Target': airtableData['Clients Daily Volume Target'] || 0,

          // Tags from Email Bison (both array of names and full tag objects)
          'Tags': bisonEmail.tags.map((tag: any) => tag.name),
          'Tag Objects': bisonEmail.tags, // Full tag objects with id, name, default

          // Timestamps
          'Created At': bisonEmail.created_at,
          'Updated At': bisonEmail.updated_at,
        }
      };
    });

    console.log(`Merged ${mergedRecords.length} email accounts`);

    return new Response(JSON.stringify({ records: mergedRecords }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in hybrid-email-accounts function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Helper function to extract email provider from tags
function extractProviderFromTags(tags: any[]): string {
  if (!tags || tags.length === 0) return 'Unknown';

  const providerTags = ['Gmail', 'Microsoft', 'Outlook', 'Google', 'Yahoo', 'Custom'];
  for (const tag of tags) {
    if (providerTags.includes(tag.name)) {
      return tag.name;
    }
  }

  return 'Unknown';
}

// Helper function to extract reseller from tags
function extractResellerFromTags(tags: any[]): string {
  if (!tags || tags.length === 0) return 'Unknown';

  // Common reseller tags - adjust based on your actual tags in Email Bison
  const resellerTags = ['Instantly', 'Smartlead', 'Apollo', 'Saleshandy', 'Lemlist', 'Woodpecker'];
  for (const tag of tags) {
    if (resellerTags.includes(tag.name)) {
      return tag.name;
    }
  }

  // Return first non-provider tag as reseller
  const providerTags = ['Gmail', 'Microsoft', 'Outlook', 'Google', 'Yahoo', 'Custom'];
  for (const tag of tags) {
    if (!providerTags.includes(tag.name)) {
      return tag.name;
    }
  }

  return 'Unknown';
}
