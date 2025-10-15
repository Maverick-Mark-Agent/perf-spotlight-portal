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
    const { workspace_name, month } = await req.json();

    if (!workspace_name || !month) {
      throw new Error('workspace_name and month are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not found');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if already initialized
    const { data: existing, error: checkError } = await supabase
      .from('zip_batch_pulls')
      .select('id')
      .eq('workspace_name', workspace_name)
      .eq('month', month)
      .limit(1);

    if (checkError) throw checkError;

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Batches already initialized',
          workspace_name,
          month
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all ZIPs for this client from client_zipcodes
    const { data: zipData, error: zipError } = await supabase
      .from('client_zipcodes')
      .select('zip, state')
      .eq('workspace_name', workspace_name)
      .eq('month', month)
      .order('zip', { ascending: true });

    if (zipError) throw zipError;

    if (!zipData || zipData.length === 0) {
      throw new Error(`No ZIPs found for ${workspace_name} in ${month}`);
    }

    // Create batches of 25
    const batchSize = 25;
    const batches: any[] = [];

    for (let i = 0; i < zipData.length; i += batchSize) {
      const batchNumber = Math.floor(i / batchSize) + 1;
      const zipBatch = zipData.slice(i, i + batchSize);

      zipBatch.forEach((zip) => {
        batches.push({
          workspace_name,
          month,
          zip: zip.zip,
          state: zip.state,
          batch_number: batchNumber,
          pulled_at: null,
          raw_contacts_uploaded: 0,
        });
      });
    }

    // Insert batches
    const { error: insertError } = await supabase
      .from('zip_batch_pulls')
      .insert(batches);

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Initialized ${batches.length} ZIP codes in ${Math.ceil(zipData.length / batchSize)} batches`,
        workspace_name,
        month,
        total_zips: zipData.length,
        total_batches: Math.ceil(zipData.length / batchSize)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in initialize-zip-batches:', error);
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
