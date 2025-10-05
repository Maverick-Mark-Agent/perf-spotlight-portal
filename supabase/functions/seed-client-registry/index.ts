import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_BISON_BASE_URL = 'https://send.maverickmarketingllc.com/api';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const emailBisonApiKey = Deno.env.get('EMAIL_BISON_API_KEY');
    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!emailBisonApiKey || !airtableApiKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('📥 Step 1: Fetching all workspaces from Email Bison...');
    const workspacesResponse = await fetch(`${EMAIL_BISON_BASE_URL}/workspaces`, {
      headers: {
        'Authorization': `Bearer ${emailBisonApiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!workspacesResponse.ok) {
      throw new Error(`Email Bison API error: ${workspacesResponse.status}`);
    }

    const workspacesData = await workspacesResponse.json();
    const workspaces = workspacesData.data || [];
    console.log(`  Found ${workspaces.length} workspaces in Email Bison`);

    console.log('📥 Step 2: Fetching client data from Airtable...');
    const airtableBaseId = 'appONMVSIf5czukkf';
    const clientsTable = '👨‍💻 Clients';
    const airtableResponse = await fetch(
      `https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(clientsTable)}?view=Positive%20Replies`,
      {
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!airtableResponse.ok) {
      throw new Error(`Airtable API error: ${airtableResponse.status}`);
    }

    const airtableData = await airtableResponse.json();
    const airtableRecords = airtableData.records || [];
    console.log(`  Found ${airtableRecords.length} client records in Airtable`);

    // Manual pricing data from CSV (will be loaded into registry)
    const pricingData: Record<string, any> = {
      'Shane Miller': { billing_type: 'retainer', retainer_amount: 2175, price_per_lead: 0 },
      'Kirk Hodgson': { billing_type: 'retainer', retainer_amount: 1500, price_per_lead: 0 },
      'StreetSmart Commercial': { billing_type: 'retainer', retainer_amount: 1500, price_per_lead: 0 },
      'SMA Insurance': { billing_type: 'retainer', retainer_amount: 2000, price_per_lead: 0 },
      'SAVANTY': { billing_type: 'retainer', retainer_amount: 688, price_per_lead: 0 },
      'StreetSmart Trucking': { billing_type: 'retainer', retainer_amount: 1500, price_per_lead: 0 },
      'Maison Energy': { billing_type: 'retainer', retainer_amount: 2500, price_per_lead: 0 },
      'Nick Sakha': { billing_type: 'per_lead', price_per_lead: 20, retainer_amount: 0 },
      'Tony Schmitz': { billing_type: 'per_lead', price_per_lead: 20, retainer_amount: 0 },
      'Devin Hodo': { billing_type: 'per_lead', price_per_lead: 25, retainer_amount: 0 },
      'Gregg Blanchard': { billing_type: 'per_lead', price_per_lead: 30, retainer_amount: 0 },
      'Danny Schwartz': { billing_type: 'per_lead', price_per_lead: 25, retainer_amount: 0 },
      'David Amiri': { billing_type: 'per_lead', price_per_lead: 25, retainer_amount: 0 },
      'Rob Russell': { billing_type: 'per_lead', price_per_lead: 25, retainer_amount: 0 },
      'John Roberts': { billing_type: 'per_lead', price_per_lead: 25, retainer_amount: 0 },
      'StreetSmart P&C': { billing_type: 'per_lead', price_per_lead: 25, retainer_amount: 0 },
      'Kim Wallace': { billing_type: 'per_lead', price_per_lead: 17.50, retainer_amount: 0 },
      'Jason Binyon': { billing_type: 'per_lead', price_per_lead: 15, retainer_amount: 0 },
    };

    console.log('🔄 Step 3: Building client registry entries...');
    const registryEntries: any[] = [];

    for (const workspace of workspaces) {
      // Find matching Airtable record
      const airtableRecord = airtableRecords.find(
        (record: any) => record.fields['Workspace Name'] === workspace.name
      );

      // Find pricing data
      const pricing = pricingData[workspace.name];

      const entry = {
        workspace_id: workspace.id,
        workspace_name: workspace.name,
        display_name: airtableRecord?.fields['Client Company Name'] || null,
        is_active: true,
        billing_type: pricing?.billing_type || 'per_lead', // default
        price_per_lead: pricing?.price_per_lead || 0,
        retainer_amount: pricing?.retainer_amount || 0,
        monthly_kpi_target: airtableRecord?.fields['Monthly KPI'] || 0,
        airtable_record_id: airtableRecord?.id || null,
        notes: pricing ? 'Pricing imported from CSV' : 'No pricing data available',
      };

      registryEntries.push(entry);
      console.log(`  ✓ ${workspace.name} (ID: ${workspace.id}) - ${entry.billing_type} - $${entry.price_per_lead || entry.retainer_amount}`);
    }

    console.log(`💾 Step 4: Inserting ${registryEntries.length} entries into client_registry...`);
    const { data, error } = await supabase
      .from('client_registry')
      .upsert(registryEntries, { onConflict: 'workspace_id' });

    if (error) {
      throw new Error(`Failed to insert registry entries: ${error.message}`);
    }

    console.log('✅ Client registry seeded successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        workspaces_processed: workspaces.length,
        entries_created: registryEntries.length,
        entries: registryEntries.map(e => ({
          name: e.workspace_name,
          type: e.billing_type,
          pricing: e.billing_type === 'retainer' ? `$${e.retainer_amount}/mo` : `$${e.price_per_lead}/lead`
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Seed error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
