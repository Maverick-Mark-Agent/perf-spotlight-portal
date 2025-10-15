import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Deploying ZIP pipeline tracking...');

    // Step 1: Create zip_pipeline_summary view
    const { error: view1Error } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE OR REPLACE VIEW public.zip_pipeline_summary AS
        SELECT
          zbp.workspace_name,
          zbp.month,
          COUNT(DISTINCT zbp.zip) AS total_zips,
          COUNT(DISTINCT zbp.zip) FILTER (WHERE zbp.raw_contacts_uploaded > 0) AS zips_pulled,
          COUNT(DISTINCT zbp.zip) FILTER (WHERE zbp.raw_contacts_uploaded = 0) AS zips_remaining,
          COALESCE(SUM(zbp.raw_contacts_uploaded), 0) AS total_raw_contacts,
          COALESCE(SUM(zbp.qualified_contacts), 0) AS total_qualified_contacts,
          COALESCE(SUM(zbp.deliverable_contacts), 0) AS total_deliverable_contacts,
          COUNT(DISTINCT zbp.batch_number) AS total_batches,
          COUNT(DISTINCT zbp.batch_number) FILTER (WHERE zbp.raw_contacts_uploaded > 0) AS batches_uploaded,
          COUNT(DISTINCT zbp.batch_number) FILTER (WHERE zbp.uploaded_to_bison = true) AS batches_sent_to_bison,
          CASE
            WHEN COUNT(DISTINCT zbp.zip) > 0
            THEN ROUND((COUNT(DISTINCT zbp.zip) FILTER (WHERE zbp.raw_contacts_uploaded > 0)::DECIMAL / COUNT(DISTINCT zbp.zip)) * 100, 1)
            ELSE 0
          END AS zip_completion_percentage,
          MIN(zbp.created_at) AS first_batch_created,
          MAX(zbp.pulled_at) AS last_pull_date
        FROM public.zip_batch_pulls zbp
        GROUP BY zbp.workspace_name, zbp.month;
      `
    });

    if (view1Error) throw view1Error;
    console.log('✅ Created zip_pipeline_summary view');

    // Step 2: Grant permissions
    const { error: grantError } = await supabase.rpc('exec_sql', {
      sql_query: `GRANT SELECT ON public.zip_pipeline_summary TO anon, authenticated;`
    });

    if (grantError) throw grantError;
    console.log('✅ Granted permissions on zip_pipeline_summary');

    // Step 3: Add Kirk Hodgson to client_registry
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

    // Step 4: Add Kirk Hodgson placeholder in client_zipcodes for November
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
        onConflict: 'zip,month'
      });

    if (kirkZipError) throw kirkZipError;
    console.log('✅ Added Kirk Hodgson to ZIP Dashboard for November');

    // Step 5: Create trigger function for auto-sync
    const { error: funcError } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE OR REPLACE FUNCTION public.sync_zip_agency_to_contact_pipeline()
        RETURNS TRIGGER AS $$
        DECLARE
          v_exists BOOLEAN;
        BEGIN
          SELECT EXISTS(
            SELECT 1 FROM public.client_registry
            WHERE workspace_name = NEW.workspace_name
          ) INTO v_exists;

          IF NOT v_exists THEN
            INSERT INTO public.client_registry (
              workspace_name,
              display_name,
              is_active,
              contact_tier,
              monthly_contact_target
            ) VALUES (
              NEW.workspace_name,
              NEW.client_name,
              true,
              'standard',
              1000
            ) ON CONFLICT (workspace_name) DO NOTHING;
          END IF;

          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `
    });

    if (funcError) throw funcError;
    console.log('✅ Created sync_zip_agency_to_contact_pipeline function');

    // Step 6: Create trigger
    const { error: triggerError } = await supabase.rpc('exec_sql', {
      sql_query: `
        DROP TRIGGER IF EXISTS trg_sync_zip_agency ON public.client_zipcodes;
        CREATE TRIGGER trg_sync_zip_agency
          AFTER INSERT ON public.client_zipcodes
          FOR EACH ROW
          EXECUTE FUNCTION public.sync_zip_agency_to_contact_pipeline();
      `
    });

    if (triggerError) throw triggerError;
    console.log('✅ Created trigger trg_sync_zip_agency');

    return new Response(JSON.stringify({
      success: true,
      message: 'ZIP pipeline tracking deployed successfully',
      details: [
        'Created zip_pipeline_summary view',
        'Added Kirk Hodgson to client_registry',
        'Added Kirk Hodgson to ZIP Dashboard for November',
        'Created auto-sync trigger for agencies'
      ]
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Deployment error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
