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
    const { month } = await req.json();

    if (!month) {
      throw new Error('month is required (e.g., "2025-11")');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Initializing ZIP batches for all agencies for ${month}`);

    // Get all ZIP codes from client_zipcodes for this month (with pagination)
    let allZipData: Array<{ workspace_name: string; zip: string; state: string }> = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data: zipData, error: zipError } = await supabase
        .from('client_zipcodes')
        .select('workspace_name, zip, state')
        .eq('month', month)
        .order('workspace_name', { ascending: true })
        .order('zip', { ascending: true })
        .range(from, from + pageSize - 1);

      if (zipError) throw zipError;

      if (!zipData || zipData.length === 0) break;

      allZipData = allZipData.concat(zipData);
      if (zipData.length < pageSize) break;
      from += pageSize;
    }

    if (allZipData.length === 0) {
      throw new Error(`No ZIP codes found for month ${month}`);
    }

    console.log(`Found ${allZipData.length} ZIP codes for ${month}`);

    // Group ZIPs by workspace_name
    const workspaceZips = new Map<string, Array<{ zip: string; state: string }>>();

    for (const row of allZipData) {
      if (!workspaceZips.has(row.workspace_name)) {
        workspaceZips.set(row.workspace_name, []);
      }
      workspaceZips.get(row.workspace_name)!.push({
        zip: row.zip,
        state: row.state
      });
    }

    console.log(`Processing ${workspaceZips.size} agencies`);

    const results = [];
    const BATCH_SIZE = 25;

    // Process each workspace
    for (const [workspaceName, zips] of workspaceZips.entries()) {
      console.log(`Processing ${workspaceName}: ${zips.length} ZIPs`);

      // Split into batches of 25
      const batches = [];
      for (let i = 0; i < zips.length; i += BATCH_SIZE) {
        batches.push(zips.slice(i, i + BATCH_SIZE));
      }

      console.log(`  Split into ${batches.length} batches`);

      // Create batch entries
      const batchEntries = [];
      for (let batchNum = 1; batchNum <= batches.length; batchNum++) {
        const batchZips = batches[batchNum - 1];

        for (const { zip, state } of batchZips) {
          batchEntries.push({
            workspace_name: workspaceName,
            month: month,
            zip: zip,
            state: state,
            batch_number: batchNum,
            pulled_at: null,
            raw_contacts_uploaded: 0,
            qualified_contacts: 0,
            deliverable_contacts: 0,
            uploaded_to_bison: false,
          });
        }
      }

      // Insert batches into database
      const { error: insertError } = await supabase
        .from('zip_batch_pulls')
        .upsert(batchEntries, {
          onConflict: 'workspace_name,month,zip',
          ignoreDuplicates: false
        });

      if (insertError) {
        console.error(`Error inserting batches for ${workspaceName}:`, insertError);
        results.push({
          workspace_name: workspaceName,
          success: false,
          error: insertError.message,
          zip_count: 0,
          batch_count: 0
        });
      } else {
        console.log(`  ✅ Created ${batches.length} batches for ${workspaceName}`);
        results.push({
          workspace_name: workspaceName,
          success: true,
          zip_count: zips.length,
          batch_count: batches.length,
          batches: batches.map((b, i) => ({
            batch_number: i + 1,
            zip_count: b.length
          }))
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalZips = results.reduce((sum, r) => sum + r.zip_count, 0);
    const totalBatches = results.reduce((sum, r) => sum + r.batch_count, 0);

    return new Response(
      JSON.stringify({
        success: true,
        month: month,
        agencies_processed: workspaceZips.size,
        agencies_succeeded: successCount,
        total_zips: totalZips,
        total_batches: totalBatches,
        results: results,
        message: `Initialized ${totalBatches} batches across ${successCount} agencies for ${month}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error initializing ZIP batches:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
