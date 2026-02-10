import { createClient } from '@supabase/supabase-js';

const AIRTABLE_API_KEY = 'patHeVyZPZSelZQiv.0b42c8d2a6197c847c5e85824a4b8ab09d985659f9e4ecd0703c308ff8fd1730';
const AIRTABLE_BASE_ID = 'appONMVSIf5czukkf';
const AIRTABLE_TABLE = '👨‍💻 Clients';
const AIRTABLE_VIEW = 'Positive Replies';

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchAirtableClients() {
  console.log('📥 Fetching clients from Airtable...');

  const allRecords = [];
  let offset = null;

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`);
    url.searchParams.append('view', AIRTABLE_VIEW);
    if (offset) {
      url.searchParams.append('offset', offset);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status}`);
    }

    const data = await response.json();
    allRecords.push(...(data.records || []));
    offset = data.offset;

  } while (offset);

  console.log(`  ✅ Fetched ${allRecords.length} client records from Airtable\n`);
  return allRecords;
}

async function updateClientRegistry(airtableClients) {
  console.log('🔄 Updating client_registry...\n');

  let updated = 0;
  let errors = 0;

  for (const record of airtableClients) {
    const fields = record.fields;

    // Extract values from Airtable
    const workspaceName = fields['Workspace Name'];
    const displayName = fields['Client Company Name'];
    const monthlyKPI = fields['Monthly KPI'] || 0;
    const pricePerLead = fields['Price Per Lead'] || 0;
    const threeDayAvg = fields['3-Day Sending Average'] || 0;
    const monthlySendingTarget = threeDayAvg * 26; // Formula from Airtable
    const positiveRepliesMTD = fields['Positive Replies MTD'] || 0;
    const payout = positiveRepliesMTD * pricePerLead; // Current month payout
    const retainer = fields['Retainer'] || 0;

    if (!workspaceName) {
      console.log(`⏭️  Skipping record (no workspace name): ${displayName || 'Unknown'}`);
      continue;
    }

    console.log(`  Processing: ${displayName || workspaceName}`);
    console.log(`    - Monthly KPI: ${monthlyKPI}`);
    console.log(`    - Price per Lead: $${pricePerLead}`);
    console.log(`    - Sending Target: ${monthlySendingTarget}`);
    console.log(`    - Current Payout: $${payout.toFixed(2)}`);

    try {
      // Check if client exists in registry
      const { data: existing } = await supabase
        .from('client_registry')
        .select('workspace_id')
        .eq('workspace_name', workspaceName)
        .single();

      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('client_registry')
          .update({
            display_name: displayName || workspaceName,
            monthly_kpi_target: monthlyKPI,
            price_per_lead: pricePerLead,
            monthly_sending_target: monthlySendingTarget,
            payout: payout,
            retainer_amount: retainer,
            airtable_record_id: record.id,
            updated_at: new Date().toISOString(),
          })
          .eq('workspace_name', workspaceName);

        if (updateError) {
          console.log(`    ❌ Error updating: ${updateError.message}`);
          errors++;
        } else {
          console.log(`    ✅ Updated`);
          updated++;
        }
      } else {
        console.log(`    ⚠️  Not in client_registry (needs Email Bison workspace_id)`);
      }
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      errors++;
    }

    console.log('');
  }

  console.log('=' .repeat(60));
  console.log(`✅ Updated ${updated} clients`);
  if (errors > 0) {
    console.log(`⚠️  ${errors} errors occurred`);
  }
  console.log('=' .repeat(60));
}

async function main() {
  console.log('\n🚀 Populating client_registry from Airtable\n');
  console.log('=' .repeat(60));

  try {
    // Fetch from Airtable
    const airtableClients = await fetchAirtableClients();

    // Update client_registry
    await updateClientRegistry(airtableClients);

    console.log('\n🎉 Population complete!\n');
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
