import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * SYNC CLIENT PIPELINE - Comprehensive Solution
 *
 * This function populates the client_leads table with ALL interested replies
 * from Email Bison using the /api/replies?status=interested endpoint.
 *
 * Request body:
 * {
 *   "workspace_name": "Kim Wallace"  // Optional - if not provided, syncs all active clients
 * }
 */

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const MAVERICK_API_KEY = Deno.env.get('EMAIL_BISON_API_KEY') || Deno.env.get('MAVERICK_BISON_API_KEY')!;
    const MAVERICK_BASE_URL = 'https://send.maverickmarketingllc.com/api';

    const LONGRUN_API_KEY = Deno.env.get('LONG_RUN_BISON_API_KEY')!;
    const LONGRUN_BASE_URL = 'https://send.longrun.agency/api';

    const body = await req.json();
    const targetWorkspaceName = body?.workspace_name;

    console.log('🔄 Sync Client Pipeline');
    if (targetWorkspaceName) {
      console.log(`   Target: ${targetWorkspaceName} (single client)`);
    } else {
      console.log(`   Target: ALL active clients`);
    }

    // Fetch workspaces with API keys
    let query = supabase
      .from('client_registry')
      .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key')
      .eq('is_active', true);

    if (targetWorkspaceName) {
      query = query.eq('workspace_name', targetWorkspaceName);
    }

    const { data: workspaces, error: wsError } = await query.order('workspace_name');

    if (wsError || !workspaces || workspaces.length === 0) {
      throw new Error(`No workspaces found: ${wsError?.message}`);
    }

    console.log(`Found ${workspaces.length} workspace(s) to sync`);

    const results: any[] = [];

    // Process each workspace SEQUENTIALLY
    for (let i = 0; i < workspaces.length; i++) {
      const workspace = workspaces[i];
      const { workspace_name, bison_workspace_id, bison_instance, bison_api_key } = workspace;

      console.log(`\n[${i + 1}/${workspaces.length}] ${workspace_name} (${bison_instance} - ID: ${bison_workspace_id})`);

      // Use workspace-specific API key if available, otherwise fall back to super-admin key
      const apiKey = bison_api_key || (bison_instance === 'Maverick' ? MAVERICK_API_KEY : LONGRUN_API_KEY);
      const baseUrl = bison_instance === 'Maverick' ? MAVERICK_BASE_URL : LONGRUN_BASE_URL;
      const useWorkspaceKey = !!bison_api_key;

      try {
        // STEP 1: Switch workspace (only needed for super-admin keys)
        if (!useWorkspaceKey) {
          const switchResponse = await fetch(`${baseUrl}/workspaces/v1.1/switch-workspace`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ team_id: bison_workspace_id }),
          });

          if (!switchResponse.ok) {
            console.error(`  Failed to switch workspace`);
            results.push({ workspace_name, status: 'failed', error: 'workspace_switch_failed', leads_synced: 0 });
            continue;
          }

          // Wait for workspace switch
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.log(`  Using workspace-specific API key (no switch needed)`);
        }

        // STEP 2: Fetch ALL interested replies using status=interested filter
        console.log(`  Fetching interested replies...`);
        const allReplies: any[] = [];
        let page = 1;
        let hasMore = true;
        const perPage = 100;

        while (hasMore) {
          const repliesResponse = await fetch(
            `${baseUrl}/replies?status=interested&per_page=${perPage}&page=${page}`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
              },
            }
          );

          if (!repliesResponse.ok) {
            console.error(`  Failed to fetch page ${page}`);
            break;
          }

          const data = await repliesResponse.json();
          const replies = data.data || [];
          allReplies.push(...replies);

          console.log(`    Page ${page}: ${replies.length} replies (Total: ${allReplies.length})`);

          if (page >= data.meta?.last_page) {
            hasMore = false;
          } else {
            page++;
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        console.log(`  Found ${allReplies.length} interested replies`);

        // STEP 3: Deduplicate by email (keep most recent reply per email)
        const repliesByEmail = new Map();
        for (const reply of allReplies) {
          const email = (reply.from_email_address || '').toLowerCase();
          const existing = repliesByEmail.get(email);

          if (!existing || reply.id > existing.id) {
            repliesByEmail.set(email, reply);
          }
        }

        const uniqueReplies = Array.from(repliesByEmail.values());
        console.log(`  Deduplicated to ${uniqueReplies.length} unique leads`);

        // STEP 4: Fetch full lead details if workspace API key is available
        console.log(`  Processing leads with ${useWorkspaceKey ? 'FULL' : 'BASIC'} data...`);
        const leadsToInsert = [];

        for (const reply of uniqueReplies) {
          const nameParts = (reply.from_name || '').split(' ');
          const domain = bison_instance === 'Maverick'
            ? 'send.maverickmarketingllc.com'
            : 'send.longrun.agency';
          const conversationUrl = reply.lead_id
            ? `https://${domain}/leads/${reply.lead_id}`
            : null;

          let leadData: any = {
            airtable_id: `bison_reply_${reply.id}`,
            workspace_name,
            lead_email: reply.from_email_address || 'unknown@email.com',
            first_name: nameParts[0] || null,
            last_name: nameParts.slice(1).join(' ') || null,
            date_received: reply.date_received,
            interested: true,
            pipeline_stage: 'interested',
            bison_reply_id: reply.id,
            bison_reply_uuid: reply.uuid || null,
            bison_lead_id: reply.lead_id?.toString() || null,
            bison_conversation_url: conversationUrl,
            last_synced_at: new Date().toISOString(),
          };

          // Fetch full lead details using workspace API key
          if (useWorkspaceKey && reply.lead_id) {
            try {
              const leadResponse = await fetch(`${baseUrl}/leads/${reply.lead_id}`, {
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Accept': 'application/json',
                },
              });

              if (leadResponse.ok) {
                const leadDetails = await leadResponse.json();
                const lead = leadDetails.data;

                // Extract phone from custom variables if not directly available
                const phoneVariable = lead.custom_variables?.find((v: any) =>
                  v.name.toLowerCase().includes('phone')
                );

                leadData = {
                  ...leadData,
                  client_name: lead.name || null,
                  phone: lead.phone || phoneVariable?.value || null,
                  title: lead.title || null,
                  company: lead.company || null,
                  address: lead.address || null,
                  city: lead.city || null,
                  state: lead.state || null,
                  zip: lead.zip || null,
                  birthday: lead.birthday || null,
                  renewal_date: lead.renewal_date || null,
                  custom_variables: lead.custom_variables || null,
                  tags: lead.tags || null,
                  lead_status: lead.status || null,
                };
              }

              // Small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
              console.error(`    Failed to fetch lead ${reply.lead_id}: ${error.message}`);
            }
          }

          leadsToInsert.push(leadData);
        }

        console.log(`  Prepared ${leadsToInsert.length} leads (${useWorkspaceKey ? 'with full details' : 'basic data'})`);

        // Insert in batches
        const BATCH_SIZE = 100;
        let totalInserted = 0;

        for (let j = 0; j < leadsToInsert.length; j += BATCH_SIZE) {
          const batch = leadsToInsert.slice(j, j + BATCH_SIZE);

          const { error } = await supabase
            .from('client_leads')
            .upsert(batch, {
              onConflict: 'airtable_id',
              ignoreDuplicates: false,
            });

          if (!error) {
            totalInserted += batch.length;
          } else {
            console.error(`  Batch insert error:`, error.message);
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`  ✅ Synced ${totalInserted} leads to pipeline`);

        results.push({
          workspace_name,
          status: 'success',
          total_replies: allReplies.length,
          unique_leads: uniqueReplies.length,
          leads_synced: totalInserted,
        });

      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        results.push({
          workspace_name,
          status: 'error',
          error: error.message,
          leads_synced: 0,
        });
      }

      // Delay between workspaces
      if (i < workspaces.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    const summary = {
      total_workspaces: workspaces.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status !== 'success').length,
      total_leads_synced: results.reduce((sum, r) => sum + (r.leads_synced || 0), 0),
      results,
    };

    console.log(`\n✅ Sync complete: ${summary.total_leads_synced} total leads synced`);

    return new Response(
      JSON.stringify(summary, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
