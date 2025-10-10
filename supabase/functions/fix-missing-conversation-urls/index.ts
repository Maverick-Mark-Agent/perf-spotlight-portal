import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * FIX MISSING CONVERSATION URLS
 *
 * This function updates all leads that have bison_lead_id but no conversation URL.
 * Constructs the URL from lead_id and workspace instance.
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const targetWorkspaceName = body?.workspace_name;

    console.log('🔧 Fixing missing conversation URLs');
    if (targetWorkspaceName) {
      console.log(`   Target: ${targetWorkspaceName}`);
    } else {
      console.log(`   Target: ALL workspaces`);
    }

    // Get workspace registry to know which instance each workspace is on
    const { data: workspaces, error: wsError } = await supabase
      .from('client_registry')
      .select('workspace_name, bison_instance');

    if (wsError) throw wsError;

    const workspaceInstanceMap = new Map();
    workspaces.forEach(ws => {
      workspaceInstanceMap.set(ws.workspace_name, ws.bison_instance);
    });

    // Fetch leads with bison_lead_id but no conversation URL
    let query = supabase
      .from('client_leads')
      .select('id, workspace_name, bison_lead_id')
      .not('bison_lead_id', 'is', null)
      .is('bison_conversation_url', null);

    if (targetWorkspaceName) {
      query = query.eq('workspace_name', targetWorkspaceName);
    }

    const { data: leadsToFix, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    console.log(`Found ${leadsToFix.length} leads to fix`);

    let fixed = 0;
    const BATCH_SIZE = 100;

    for (let i = 0; i < leadsToFix.length; i += BATCH_SIZE) {
      const batch = leadsToFix.slice(i, i + BATCH_SIZE);

      const updates = batch.map(lead => {
        const instance = workspaceInstanceMap.get(lead.workspace_name);
        const domain = instance === 'Maverick'
          ? 'send.maverickmarketingllc.com'
          : 'send.longrun.agency';

        return {
          id: lead.id,
          bison_conversation_url: `https://${domain}/leads/${lead.bison_lead_id}`,
          last_synced_at: new Date().toISOString(),
        };
      });

      for (const update of updates) {
        const { error } = await supabase
          .from('client_leads')
          .update({
            bison_conversation_url: update.bison_conversation_url,
            last_synced_at: update.last_synced_at,
          })
          .eq('id', update.id);

        if (!error) {
          fixed++;
        } else {
          console.error(`Failed to update ${update.id}:`, error.message);
        }
      }

      console.log(`  Fixed ${fixed}/${leadsToFix.length} leads...`);
    }

    const result = {
      total_leads_checked: leadsToFix.length,
      urls_fixed: fixed,
    };

    console.log('✅ Fix complete:', result);

    return new Response(
      JSON.stringify(result, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
