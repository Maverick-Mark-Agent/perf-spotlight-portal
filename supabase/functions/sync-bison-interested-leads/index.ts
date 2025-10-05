import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BisonLead {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  title?: string;
  company?: string;
  custom_variables?: Array<{name: string; value: string}>;
  tags?: Array<{id: number; name: string}>;
  status?: string;
  lead_campaign_data?: Array<{campaign_id: number; interested: boolean}>;
  overall_stats?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bisonApiKey = Deno.env.get('BISON_API_KEY') || '77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d';
    const bisonBaseUrl = Deno.env.get('BISON_BASE_URL') || 'https://send.maverickmarketingllc.com/api';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Get workspace from query params
    const url = new URL(req.url);
    const workspaceName = url.searchParams.get('workspace');

    if (!workspaceName) {
      throw new Error('workspace parameter is required');
    }

    console.log(`Syncing INTERESTED leads for workspace: ${workspaceName}`);

    // 1. Find workspace ID in Email Bison
    const workspacesResponse = await fetch(`${bisonBaseUrl}/workspaces`, {
      headers: {
        'Authorization': `Bearer ${bisonApiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!workspacesResponse.ok) {
      throw new Error(`Failed to fetch workspaces: ${workspacesResponse.status}`);
    }

    const workspacesData = await workspacesResponse.json();
    const workspace = workspacesData.data.find((w: any) => w.name === workspaceName);

    if (!workspace) {
      throw new Error(`Workspace "${workspaceName}" not found`);
    }

    const workspaceId = workspace.id;
    console.log(`Found workspace ID: ${workspaceId}`);

    // 2. Delete ALL existing leads for this workspace to start fresh
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Deleting existing leads for workspace: ${workspaceName}`);
    const { error: deleteError } = await supabase
      .from('client_leads')
      .delete()
      .eq('workspace_name', workspaceName);

    if (deleteError) {
      console.error('Error deleting existing leads:', deleteError);
    } else {
      console.log('Successfully deleted existing leads');
    }

    // 3. Find the "Interested" tag ID for this workspace
    const tagsResponse = await fetch(`${bisonBaseUrl}/tags?workspace_id=${workspaceId}`, {
      headers: {
        'Authorization': `Bearer ${bisonApiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!tagsResponse.ok) {
      throw new Error(`Failed to fetch tags: ${tagsResponse.status}`);
    }

    const tagsData = await tagsResponse.json();
    const interestedTag = tagsData.data.find((tag: any) => tag.name === 'Interested');

    if (!interestedTag) {
      throw new Error('Interested tag not found for this workspace');
    }

    const interestedTagId = interestedTag.id;
    console.log(`Found Interested tag ID: ${interestedTagId}`);

    // 4. Fetch interested leads using tag filter
    let allLeads: BisonLead[] = [];
    let page = 1;
    let hasMore = true;

    console.log(`Fetching interested leads using tag filter...`);

    while (hasMore) {
      const leadsUrl = `${bisonBaseUrl}/leads?workspace_id=${workspaceId}&filters[tag_ids][]=${interestedTagId}&page=${page}&per_page=100`;
      console.log(`Fetching from URL: ${leadsUrl}`);

      const leadsResponse = await fetch(leadsUrl, {
        headers: {
          'Authorization': `Bearer ${bisonApiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!leadsResponse.ok) {
        throw new Error(`Failed to fetch leads: ${leadsResponse.status}`);
      }

      const leadsData = await leadsResponse.json();
      console.log(`API Response - Total: ${leadsData.meta?.total}, Page: ${page}, Returned: ${leadsData.data?.length || 0}`);

      allLeads = allLeads.concat(leadsData.data || []);

      console.log(`Page ${page}: Found ${leadsData.data?.length || 0} interested leads (${allLeads.length} total)`);

      // Check if there are more pages
      if (page >= leadsData.meta.last_page) {
        hasMore = false;
      } else {
        page++;
      }
    }

    console.log(`Total interested leads: ${allLeads.length}`);

    // 5. Transform to Supabase format
    const transformedRecords = allLeads.map(lead => {
      return {
        bison_reply_id: `lead_${lead.id}`,
        bison_lead_id: lead.id.toString(),
        workspace_name: workspaceName,

        // Contact info
        lead_email: lead.email,
        first_name: lead.first_name,
        last_name: lead.last_name,
        phone: lead.phone || null,
        address: lead.address || null,
        city: lead.city || null,
        state: lead.state || null,
        zip: lead.zip || null,

        // Professional info
        title: lead.title || null,
        company: lead.company || null,

        // Email Bison metadata
        custom_variables: lead.custom_variables || [],
        tags: lead.tags || [],
        lead_status: lead.status || null,
        lead_campaign_data: lead.lead_campaign_data || [],
        overall_stats: lead.overall_stats || null,

        // Reply details - not available from leads endpoint
        date_received: null,
        reply_received: null,
        email_subject: null,
        lead_value: 500, // Default value

        // Custom fields
        renewal_date: null,
        birthday: null,

        // Email Bison link
        bison_conversation_url: `https://send.maverickmarketingllc.com/leads/${lead.id}`,

        // Pipeline (default to new)
        pipeline_stage: 'new',
        pipeline_position: 0,

        last_synced_at: new Date().toISOString(),
      };
    });

    console.log(`Transformed ${transformedRecords.length} records`);

    // 6. Bulk insert to Supabase
    let syncedCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    // Insert in batches of 50
    const batchSize = 50;
    for (let i = 0; i < transformedRecords.length; i += batchSize) {
      const batch = transformedRecords.slice(i, i + batchSize);

      const { error } = await supabase
        .from('client_leads')
        .insert(batch);

      if (error) {
        console.error(`Batch insert error at index ${i}:`, error);
        errorCount += batch.length;
        errors.push({ batch_index: i, error });
      } else {
        syncedCount += batch.length;
        console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} leads`);
      }
    }

    console.log(`Sync complete: ${syncedCount} synced, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Interested leads synced successfully from Email Bison',
        stats: {
          totalInterestedLeads: allLeads.length,
          syncedCount,
          errorCount,
        },
        errors: errors.length > 0 ? errors : undefined,
        workspace: workspaceName,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in sync-bison-interested-leads:', error);
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
