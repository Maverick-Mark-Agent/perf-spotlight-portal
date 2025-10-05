import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BisonReply {
  id: number;
  uuid: string;
  interested: boolean;
  automated_reply: boolean;
  type: string;
  date_received: string;
  from_name: string;
  from_email_address: string;
  subject: string;
  text_body: string;
  html_body: string;
  campaign_id: number | null;
  lead_id: number | null;
  sender_email_id: number;
}

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
  custom_fields: Record<string, any>;
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
    const daysBack = parseInt(url.searchParams.get('days') || '120');

    if (!workspaceName) {
      throw new Error('workspace parameter is required');
    }

    console.log(`Syncing leads for workspace: ${workspaceName}, last ${daysBack} days`);

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

    // Switch to the workspace context
    console.log(`Switching to workspace: ${workspaceName} (ID: ${workspaceId})`);
    const switchResponse = await fetch(`${bisonBaseUrl}/workspaces/v1.1/switch-workspace`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bisonApiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ team_id: workspaceId }),
    });

    if (!switchResponse.ok) {
      const errorData = await switchResponse.json();
      throw new Error(`Failed to switch workspace: ${JSON.stringify(errorData)}`);
    }

    console.log(`Successfully switched to workspace: ${workspaceName}`);

    // 2. Fetch all interested replies for this workspace
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    let allReplies: BisonReply[] = [];
    let page = 1;
    let hasMore = true;

    console.log(`Fetching interested replies since ${cutoffDate.toISOString()}`);

    while (hasMore) {
      // No need for workspace_id param since we've switched context
      const repliesUrl = `${bisonBaseUrl}/replies?page=${page}&per_page=100`;

      const repliesResponse = await fetch(repliesUrl, {
        headers: {
          'Authorization': `Bearer ${bisonApiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!repliesResponse.ok) {
        throw new Error(`Failed to fetch replies: ${repliesResponse.status}`);
      }

      const repliesData = await repliesResponse.json();

      // Filter for non-automated replies within date range
      // Since Email Bison doesn't auto-mark "interested", we pull all real replies
      const validReplies = repliesData.data.filter((reply: BisonReply) => {
        const replyDate = new Date(reply.date_received);
        // Exclude automated replies and untracked replies
        return !reply.automated_reply &&
               reply.type !== "Untracked Reply" &&
               replyDate >= cutoffDate;
      });

      allReplies = allReplies.concat(validReplies);

      console.log(`Page ${page}: Found ${validReplies.length} valid replies (${allReplies.length} total)`);

      // Check if there are more pages
      if (page >= repliesData.meta.last_page) {
        hasMore = false;
      } else {
        page++;
      }
    }

    console.log(`Total valid replies found: ${allReplies.length}`);

    // 3. Fetch full lead details for replies that have lead_id
    console.log(`Fetching full lead details for ${allReplies.length} replies...`);

    const leadDetailsMap = new Map<number, BisonLead & {
      title?: string;
      company?: string;
      custom_variables?: Array<{name: string; value: string}>;
      tags?: Array<{id: number; name: string}>;
      status?: string;
      lead_campaign_data?: any[];
      overall_stats?: any;
    }>();

    // Fetch unique leads (avoid duplicate fetches)
    const uniqueLeadIds = [...new Set(allReplies.filter(r => r.lead_id).map(r => r.lead_id!))];
    console.log(`Found ${uniqueLeadIds.length} unique leads to fetch`);

    for (const leadId of uniqueLeadIds) {
      try {
        const leadResponse = await fetch(`${bisonBaseUrl}/leads/${leadId}`, {
          headers: {
            'Authorization': `Bearer ${bisonApiKey}`,
            'Accept': 'application/json',
          },
        });

        if (leadResponse.ok) {
          const leadData = await leadResponse.json();
          leadDetailsMap.set(leadId, leadData.data);
        } else {
          console.warn(`Failed to fetch lead ${leadId}: ${leadResponse.status}`);
        }
      } catch (error) {
        console.error(`Error fetching lead ${leadId}:`, error);
      }
    }

    console.log(`Successfully fetched ${leadDetailsMap.size} lead details`);

    // 4. Transform to Supabase format with full lead data
    const transformedRecords = allReplies.map(reply => {
      // Get full lead data if available
      const leadData = reply.lead_id ? leadDetailsMap.get(reply.lead_id) : null;

      // Extract name parts from reply OR lead data
      let firstName: string | null = null;
      let lastName: string | null = null;

      if (leadData) {
        firstName = leadData.first_name;
        lastName = leadData.last_name;
      } else {
        // Fall back to reply from_name
        const nameParts = reply.from_name?.split(' ') || [];
        firstName = nameParts[0] || null;
        lastName = nameParts.slice(1).join(' ') || null;
      }

      return {
        bison_reply_id: reply.id.toString(),
        bison_lead_id: reply.lead_id?.toString() || null,
        workspace_name: workspaceName,

        // Contact info (from lead data if available, else from reply)
        lead_email: leadData?.email || reply.from_email_address,
        first_name: firstName,
        last_name: lastName,
        phone: leadData?.phone || null,
        address: leadData?.address || null,
        city: leadData?.city || null,
        state: leadData?.state || null,
        zip: leadData?.zip || null,

        // NEW: Company and title from lead data
        title: (leadData as any)?.title || null,
        company: (leadData as any)?.company || null,

        // Reply details
        date_received: reply.date_received,
        reply_received: reply.text_body || reply.html_body || null,
        email_subject: reply.subject || null,
        lead_value: 500, // Default value

        // Custom fields (will need to be filled in manually)
        renewal_date: null,
        birthday: null,

        // NEW: Email Bison metadata
        custom_variables: (leadData as any)?.custom_variables || [],
        tags: (leadData as any)?.tags || [],
        lead_status: (leadData as any)?.status || null,
        lead_campaign_data: (leadData as any)?.lead_campaign_data || [],
        overall_stats: (leadData as any)?.overall_stats || null,

        // Email Bison link - use Airtable pattern with reply UUID
        bison_reply_uuid: reply.uuid,
        bison_conversation_url: `https://send.maverickmarketingllc.com/inbox/replies/${reply.uuid}`,

        // Pipeline (default to interested)
        pipeline_stage: 'interested',
        pipeline_position: 0,

        last_synced_at: new Date().toISOString(),
      };
    });

    console.log(`Transformed ${transformedRecords.length} records`);

    // 5. Upsert to Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);

    let syncedCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    // Insert records one by one to handle duplicates gracefully
    for (const record of transformedRecords) {
      try {
        // Try to find existing record
        const { data: existing } = await supabase
          .from('client_leads')
          .select('id')
          .eq('bison_reply_id', record.bison_reply_id)
          .single();

        if (existing) {
          // Update existing record
          const { error } = await supabase
            .from('client_leads')
            .update(record)
            .eq('bison_reply_id', record.bison_reply_id);

          if (error) {
            console.error(`Update error for reply ${record.bison_reply_id}:`, error);
            errorCount++;
            errors.push({ reply_id: record.bison_reply_id, error });
          } else {
            syncedCount++;
          }
        } else {
          // Insert new record
          const { error } = await supabase
            .from('client_leads')
            .insert(record);

          if (error) {
            console.error(`Insert error for reply ${record.bison_reply_id}:`, error);
            errorCount++;
            errors.push({ reply_id: record.bison_reply_id, error });
          } else {
            syncedCount++;
          }
        }
      } catch (error) {
        console.error(`Error processing reply ${record.bison_reply_id}:`, error);
        errorCount++;
      }
    }

    console.log(`Sync complete: ${syncedCount} synced, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Leads synced successfully from Email Bison',
        stats: {
          totalValidReplies: allReplies.length,
          syncedCount,
          errorCount,
          daysBack,
        },
        errors: errors.length > 0 ? errors : undefined,
        workspace: workspaceName,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in sync-bison-leads:', error);
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
