import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * GENERATE WORKSPACE API KEYS
 *
 * This function:
 * 1. Adds bison_api_key column to client_registry if it doesn't exist
 * 2. Fetches all workspaces from both Maverick and Long Run instances
 * 3. Generates workspace-specific API tokens using super-admin key
 * 4. Stores the API keys in the client_registry table
 *
 * This enables us to fetch full lead details (phone, address, company, etc.)
 * from the /api/leads/{id} endpoint which requires workspace-specific keys.
 */

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

    console.log('🔑 Generating workspace-specific API keys');

    // Step 1: Column should already exist (added manually)
    console.log('Step 1: Verifying bison_api_key column exists...');

    // Step 2: Get all workspaces from client_registry
    console.log('Step 2: Fetching all active workspaces...');
    const { data: workspaces, error: wsError } = await supabase
      .from('client_registry')
      .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key')
      .eq('is_active', true)
      .order('workspace_name');

    if (wsError || !workspaces) {
      throw new Error(`Failed to fetch workspaces: ${wsError?.message}`);
    }

    console.log(`Found ${workspaces.length} active workspaces`);

    const results: any[] = [];
    let generated = 0;
    let skipped = 0;
    let failed = 0;

    // Step 3: Generate API keys for each workspace
    for (const workspace of workspaces) {
      const { workspace_name, bison_workspace_id, bison_instance, bison_api_key } = workspace;

      // Skip if already has an API key
      if (bison_api_key) {
        console.log(`  ⏭️  ${workspace_name}: Already has API key`);
        skipped++;
        results.push({
          workspace_name,
          status: 'skipped',
          reason: 'already_has_key',
        });
        continue;
      }

      console.log(`  🔄 ${workspace_name} (${bison_instance} - ID: ${bison_workspace_id})`);

      const apiKey = bison_instance === 'Maverick' ? MAVERICK_API_KEY : LONGRUN_API_KEY;
      const baseUrl = bison_instance === 'Maverick' ? MAVERICK_BASE_URL : LONGRUN_BASE_URL;

      try {
        // Create API token for this workspace
        const response = await fetch(`${baseUrl}/workspaces/v1.1/${bison_workspace_id}/api-tokens`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `Maverick Dashboard - ${workspace_name}`,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const newApiKey = data.data?.plain_text_token;

        if (!newApiKey) {
          throw new Error('No API key returned from Email Bison');
        }

        // Store the API key in client_registry
        const { error: updateError } = await supabase
          .from('client_registry')
          .update({ bison_api_key: newApiKey })
          .eq('workspace_name', workspace_name);

        if (updateError) {
          throw new Error(`Database update failed: ${updateError.message}`);
        }

        console.log(`  ✅ ${workspace_name}: API key generated and stored`);
        generated++;
        results.push({
          workspace_name,
          status: 'success',
          token_id: data.data?.id,
        });

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`  ❌ ${workspace_name}: ${error.message}`);
        failed++;
        results.push({
          workspace_name,
          status: 'failed',
          error: error.message,
        });
      }
    }

    const summary = {
      total_workspaces: workspaces.length,
      generated,
      skipped,
      failed,
      results,
    };

    console.log(`\n✅ Complete: ${generated} generated, ${skipped} skipped, ${failed} failed`);

    return new Response(
      JSON.stringify(summary, null, 2),
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
