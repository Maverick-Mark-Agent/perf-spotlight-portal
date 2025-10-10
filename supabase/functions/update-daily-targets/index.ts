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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not found');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Updating daily sending targets...');

    const updates = [
      { workspace_name: 'Kim Wallace', daily_sending_target: 3500 },
      { workspace_name: 'Jason Binyon', daily_sending_target: 3500 },
      { workspace_name: 'Nick Sakha', daily_sending_target: 5250 },
      { workspace_name: 'Jeff Schroder', daily_sending_target: 1750 },
      { workspace_name: 'Rob Russell', daily_sending_target: 1750 },
      { workspace_name: 'StreetSmart P&C', daily_sending_target: 1750 },
      { workspace_name: 'StreetSmart Trucking', daily_sending_target: 1750 },
      { workspace_name: 'Kirk Hodgson', daily_sending_target: 875 },
      { workspace_name: 'SMA Insurance', daily_sending_target: 875 },
      { workspace_name: 'StreetSmart Commercial', daily_sending_target: 875 },
    ];

    const results = [];

    for (const update of updates) {
      const { error } = await supabase
        .from('client_registry')
        .update({ daily_sending_target: update.daily_sending_target })
        .eq('workspace_name', update.workspace_name);

      if (error) {
        console.error(`Failed to update ${update.workspace_name}:`, error);
        results.push({
          workspace_name: update.workspace_name,
          status: 'failed',
          error: error.message
        });
      } else {
        console.log(`✓ Updated ${update.workspace_name} to ${update.daily_sending_target}`);
        results.push({
          workspace_name: update.workspace_name,
          status: 'success',
          daily_sending_target: update.daily_sending_target
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated ${successCount}/${updates.length} clients`,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error updating daily targets:', error);
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
