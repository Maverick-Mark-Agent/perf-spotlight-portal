import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Setting up ZIP pipeline...');

    // Step 1: Add Kirk Hodgson to client_registry
    const { error: kirkRegistryError } = await supabase
      .from('client_registry')
      .upsert({
        workspace_name: 'Kirk Hodgson',
        display_name: 'Kirk Hodgson (HNW Receiver)',
        is_active: true,
        contact_tier: 'premium',
        monthly_contact_target: 0,
        price_per_lead: 0
      }, {
        onConflict: 'workspace_name'
      });

    if (kirkRegistryError) throw kirkRegistryError;
    console.log('✅ Added Kirk Hodgson to client_registry');

    // Step 2: Add Kirk Hodgson placeholder in client_zipcodes for November
    const { error: kirkZipError } = await supabase
      .from('client_zipcodes')
      .upsert({
        zip: '00000-HNW',
        month: '2025-11',
        client_name: 'Kirk Hodgson (HNW Receiver)',
        workspace_name: 'Kirk Hodgson',
        agency_color: '#10B981',
        state: null,
        source: 'hnw_receiver'
      }, {
        onConflict: 'zip,month',
        ignoreDuplicates: false
      });

    if (kirkZipError) throw kirkZipError;
    console.log('✅ Added Kirk Hodgson to ZIP Dashboard for November');

    // Step 3: Query zip_pipeline_summary data and return it
    // We'll create the view via migration later, but for now return computed data
    const { data: zipBatchData, error: zipError } = await supabase
      .from('zip_batch_pulls')
      .select('*')
      .eq('month', '2025-11');

    if (zipError) throw zipError;

    // Compute summary by workspace
    const summaryMap = new Map();

    zipBatchData.forEach((row: any) => {
      if (!summaryMap.has(row.workspace_name)) {
        summaryMap.set(row.workspace_name, {
          workspace_name: row.workspace_name,
          month: row.month,
          total_zips: new Set(),
          zips_pulled: new Set(),
          total_raw_contacts: 0,
          total_qualified_contacts: 0,
          total_batches: new Set(),
          batches_uploaded: new Set()
        });
      }

      const summary = summaryMap.get(row.workspace_name);
      summary.total_zips.add(row.zip);
      summary.total_batches.add(row.batch_number);

      if (row.raw_contacts_uploaded > 0) {
        summary.zips_pulled.add(row.zip);
        summary.batches_uploaded.add(row.batch_number);
      }

      summary.total_raw_contacts += row.raw_contacts_uploaded || 0;
      summary.total_qualified_contacts += row.qualified_contacts || 0;
    });

    // Convert to array with computed fields
    const summaries = Array.from(summaryMap.values()).map(s => ({
      workspace_name: s.workspace_name,
      month: s.month,
      total_zips: s.total_zips.size,
      zips_pulled: s.zips_pulled.size,
      zips_remaining: s.total_zips.size - s.zips_pulled.size,
      total_raw_contacts: s.total_raw_contacts,
      total_qualified_contacts: s.total_qualified_contacts,
      total_batches: s.total_batches.size,
      batches_uploaded: s.batches_uploaded.size,
      zip_completion_percentage: s.total_zips.size > 0
        ? Math.round((s.zips_pulled.size / s.total_zips.size) * 1000) / 10
        : 0
    }));

    return new Response(JSON.stringify({
      success: true,
      message: 'ZIP pipeline setup completed successfully',
      kirk_hodgson_added: true,
      november_summary: summaries
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Setup error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
