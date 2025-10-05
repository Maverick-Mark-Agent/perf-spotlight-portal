import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const bisonApiKey = Deno.env.get('BISON_API_KEY')!;
    const bisonBaseUrl = Deno.env.get('BISON_BASE_URL')!;

    // Fetch all workspaces from Email Bison
    console.log('Fetching workspaces from Email Bison...');
    const workspacesResponse = await fetch(`${bisonBaseUrl}/workspaces`, {
      headers: {
        'Authorization': `Bearer ${bisonApiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!workspacesResponse.ok) {
      throw new Error(`Failed to fetch workspaces: ${workspacesResponse.statusText}`);
    }

    const workspacesData = await workspacesResponse.json();
    const workspacesToSync = workspacesData.data.map((w: any) => w.name);

    console.log(`Found ${workspacesToSync.length} workspaces to sync`);

    const results = [];

    // Sync each workspace
    for (const workspace of workspacesToSync) {
      console.log(`Syncing workspace: ${workspace}`);

      try {
        const syncResponse = await fetch(
          `${supabaseUrl}/functions/v1/sync-bison-leads?workspace=${encodeURIComponent(workspace)}&days=30`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const syncResult = await syncResponse.json();
        results.push({
          workspace,
          success: syncResponse.ok,
          result: syncResult,
        });

        console.log(`Sync result for ${workspace}:`, syncResult);
      } catch (error) {
        console.error(`Error syncing ${workspace}:`, error);
        results.push({
          workspace,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Scheduled sync completed',
        timestamp: new Date().toISOString(),
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in scheduled sync:', error);
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
