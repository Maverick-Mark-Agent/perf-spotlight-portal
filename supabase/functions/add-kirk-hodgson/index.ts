import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Adding Kirk Hodgson to the system...');

    // Step 1: Add Kirk Hodgson to client_registry (using service role to bypass RLS)
    const { data: registryData, error: registryError } = await supabase
      .from('client_registry')
      .insert({
        workspace_id: 9999,
        workspace_name: 'Kirk Hodgson',
        display_name: 'Kirk Hodgson (HNW Receiver)',
        is_active: true,
        contact_tier: null,
        monthly_contact_target: 0,
        price_per_lead: 0,
        billing_type: 'per_lead'
      })
      .select();

    if (registryError && registryError.code !== '23505') { // Ignore duplicate key errors
      throw registryError;
    }

    console.log('✅ Added Kirk Hodgson to client_registry');

    // Step 2: Add Kirk Hodgson to client_zipcodes for November 2025
    const { data: zipData, error: zipError } = await supabase
      .from('client_zipcodes')
      .insert({
        zip: '00000-HNW',
        month: '2025-11',
        client_name: 'Kirk Hodgson (HNW Receiver)',
        workspace_name: 'Kirk Hodgson',
        agency_color: '#10B981',
        state: null,
        source: 'hnw_receiver'
      })
      .select();

    if (zipError && zipError.code !== '23505') { // Ignore duplicate key errors
      throw zipError;
    }

    console.log('✅ Added Kirk Hodgson to ZIP Dashboard for November');

    // Step 3: Add Kirk Hodgson to zip_batch_pulls so he shows up in Contact Pipeline Dashboard
    const { data: batchData, error: batchError } = await supabase
      .from('zip_batch_pulls')
      .insert({
        workspace_name: 'Kirk Hodgson',
        month: '2025-11',
        zip: '00000-HNW',
        state: null,
        batch_number: 1,
        raw_contacts_uploaded: 848,
        qualified_contacts: 848,
        deliverable_contacts: 0,
        uploaded_to_bison: false,
        csv_filename: 'hnw_from_kim_wallace.csv',
        pulled_at: new Date().toISOString()
      })
      .select();

    if (batchError && batchError.code !== '23505') {
      throw batchError;
    }

    console.log('✅ Added Kirk Hodgson to zip_batch_pulls');

    // Step 4: Check how many HNW contacts from Texas agencies
    const { data: storageFiles } = await supabase.storage
      .from('contact-csvs')
      .list('Kirk Hodgson/2025-11', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    const hnwFiles = storageFiles || [];

    return new Response(JSON.stringify({
      success: true,
      message: 'Kirk Hodgson successfully added to the system',
      details: {
        client_registry: registryError?.code === '23505' ? 'Already exists' : 'Created',
        zip_dashboard: zipError?.code === '23505' ? 'Already exists' : 'Created',
        zip_batch_pulls: batchError?.code === '23505' ? 'Already exists' : 'Created',
        hnw_contacts: 848,
        hnw_files_found: hnwFiles.length,
        workspace_id: 9999,
        agency_color: '#10B981'
      }
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error adding Kirk Hodgson:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      code: error.code,
      details: error.details || error
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
