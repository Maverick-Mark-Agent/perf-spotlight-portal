import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!airtableApiKey) {
      throw new Error('AIRTABLE_API_KEY not found');
    }

    // Get workspace_name from query params (optional - defaults to all)
    const url = new URL(req.url);
    const workspaceFilter = url.searchParams.get('workspace');

    console.log(`Syncing client leads${workspaceFilter ? ` for workspace: ${workspaceFilter}` : ' (all workspaces)'}`);

    // Fetch positive replies from Airtable
    const airtableBaseId = 'appONMVSIf5czukkf';
    const airtableTableName = 'Positive Replies';

    let allRecords: any[] = [];
    let offset = '';

    // Paginate through all Airtable records
    do {
      const airtableUrl = `https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(airtableTableName)}?pageSize=100${offset ? `&offset=${offset}` : ''}`;

      const airtableResponse = await fetch(airtableUrl, {
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!airtableResponse.ok) {
        throw new Error(`Airtable API error: ${airtableResponse.status}`);
      }

      const airtableData = await airtableResponse.json();
      allRecords = allRecords.concat(airtableData.records || []);
      offset = airtableData.offset || '';

      console.log(`Fetched ${allRecords.length} records so far...`);
    } while (offset);

    console.log(`Total Airtable records fetched: ${allRecords.length}`);

    // Filter by workspace if specified
    let recordsToSync = allRecords;
    if (workspaceFilter) {
      recordsToSync = allRecords.filter(record =>
        record.fields['Workspace Name'] === workspaceFilter
      );
      console.log(`Filtered to ${recordsToSync.length} records for workspace: ${workspaceFilter}`);
    }

    // Map Airtable stage to our pipeline stage
    function mapPipelineStage(airtableStatus: string | undefined): string {
      if (!airtableStatus) return 'new';

      const statusLower = airtableStatus.toLowerCase();
      if (statusLower.includes('follow')) return 'follow-up';
      if (statusLower.includes('quot')) return 'quoting';
      if (statusLower.includes('won')) return 'won';
      if (statusLower.includes('lost')) return 'lost';
      if (statusLower.includes('nurture')) return 'nurture';

      return 'new';
    }

    // Transform Airtable records to Supabase format
    const transformedRecords = recordsToSync.map(record => ({
      airtable_id: record.id,
      workspace_name: record.fields['Workspace Name'] || null,
      client_name: Array.isArray(record.fields['Client Name (from Client)'])
        ? record.fields['Client Name (from Client)'][0]
        : record.fields['Client Name (from Client)'],

      // Contact info
      lead_email: record.fields['Lead Email'] || null,
      first_name: record.fields['First Name'] || null,
      last_name: record.fields['Last Name'] || null,
      phone: record.fields['Phone'] || null,
      address: record.fields['Address'] || null,
      city: record.fields['City'] || null,
      state: record.fields['State'] || null,
      zip: record.fields['ZIP'] || null,

      // Lead details
      date_received: record.fields['Date Received']
        ? new Date(record.fields['Date Received']).toISOString()
        : null,
      reply_received: record.fields['Reply Received'] || null,
      email_sent: record.fields['Email Sent'] || null,
      email_subject: record.fields['Email Subject'] || null,
      lead_value: record.fields['Lead Value'] || 500,

      // Home insurance specific
      renewal_date: record.fields['Renewal Date'] || null,
      birthday: record.fields['Birthday'] || null,

      // Campaign info
      campaign_name: Array.isArray(record.fields['Campaign Name (from Campaign Linked)'])
        ? record.fields['Campaign Name (from Campaign Linked)'][0]
        : record.fields['Campaign Name (from Campaign Linked)'],
      sender_email: record.fields['Sender Email'] || null,
      icp: record.fields['ICP'] === true || record.fields['ICP'] === '✅',

      // Pipeline
      pipeline_stage: mapPipelineStage(record.fields['Lead Status']),
      notes: record.fields['MJ Notes'] || null,

      // Email Bison
      bison_conversation_url: record.fields['link'] || null,
      bison_lead_id: record.fields['Lead ID']?.toString() || null,

      last_synced_at: new Date().toISOString(),
    }));

    console.log(`Transformed ${transformedRecords.length} records for sync`);

    // Upsert to Supabase (insert or update based on airtable_id)
    const supabase = createClient(supabaseUrl, supabaseKey);

    let syncedCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    // Batch upsert (100 at a time)
    const batchSize = 100;
    for (let i = 0; i < transformedRecords.length; i += batchSize) {
      const batch = transformedRecords.slice(i, i + batchSize);

      const { data, error } = await supabase
        .from('client_leads')
        .upsert(batch, {
          onConflict: 'airtable_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`Batch ${i / batchSize + 1} error:`, error);
        errorCount += batch.length;
        errors.push({ batch: i / batchSize + 1, error });
      } else {
        syncedCount += batch.length;
        console.log(`Batch ${i / batchSize + 1}: Synced ${batch.length} records`);
      }
    }

    console.log(`Sync complete: ${syncedCount} synced, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Client leads synced successfully',
        stats: {
          totalAirtableRecords: allRecords.length,
          recordsToSync: transformedRecords.length,
          syncedCount,
          errorCount,
        },
        errors: errors.length > 0 ? errors : undefined,
        workspace: workspaceFilter || 'all',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in sync-client-leads:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
