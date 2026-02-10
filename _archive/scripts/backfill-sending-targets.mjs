#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q';
const AIRTABLE_API_KEY = 'patHeVyZPZSelZQiv.0b42c8d2a6197c847c5e85824a4b8ab09d985659f9e4ecd0703c308ff8fd1730';
const AIRTABLE_BASE_ID = 'appONMVSIf5czukkf';
const AIRTABLE_TABLE = '👨‍💻 Clients';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Mapping from Airtable data (extracted from your audit)
const AIRTABLE_TARGETS = {
  'ATI': { display_name: 'ApolloTechné', target: 22750 },
  'Danny Schwartz': { display_name: 'Danny Schwartz', target: 45500 },
  'David Amiri': { display_name: 'David Amiri', target: 45500 },
  'Devin Hodo': { display_name: 'Devin Hodo', target: 45500 },
  'Jason Binyon': { display_name: 'Binyon Agency', target: 91000 },
  'Jeff Schroder': { display_name: 'Jeff Schroder', target: 45500 },
  'John Roberts': { display_name: 'John Roberts', target: 45500 },
  'Kim Wallace': { display_name: 'Kim Wallace', target: 91000 },
  'Kirk Hodgson': { display_name: 'Kirk Hodgson', target: 22750 },
  'Nick Sakha': { display_name: 'Nicholas Sakha', target: 136500 },
  'Radiant Energy': { display_name: 'Radiant Energy Partners', target: 45500 },
  'Rick Huemmer': { display_name: 'Rick Huemmer', target: 26000 },
  'Rob Russell': { display_name: 'Rob Russell', target: 45500 },
  'SMA Insurance': { display_name: 'SMA Insurance Services', target: 22750 },
  'StreetSmart Commercial': { display_name: 'StreetSmart Commercial', target: 22750 },
  'StreetSmart P&C': { display_name: 'StreetSmart P&C', target: 45500 },
  'StreetSmart Trucking': { display_name: 'StreetSmart Trucking', target: 45500 },
  'Insurance': { display_name: 'Maverick In-house', target: 26000 },
  'Workspark': { display_name: 'Workspark', target: 22750 },
  // Additional mappings based on workspace_name
  'Small Biz Heroes': { display_name: 'Small Biz Heroes', target: 0 },
};

// Clients with 0 targets in Airtable (we'll skip these for now)
const ZERO_TARGET_CLIENTS = [
  'Boring Book Keeping',
  'Gregg Blanchard',
  'Maison Energy',
  'Shane Miller',
  'Small Biz Heroes',
  'Tony Schmitz',
  'biz power benifits', // Biz Power Benefits
  'Ozment Media',
];

async function backfillTargets() {
  console.log('🚀 Starting backfill of monthly_sending_target values...\n');

  // Get all clients from client_registry
  const { data: clients, error: fetchError } = await supabase
    .from('client_registry')
    .select('workspace_name, display_name, monthly_sending_target, airtable_workspace_name')
    .eq('is_active', true);

  if (fetchError) {
    console.error('❌ Error fetching clients:', fetchError);
    process.exit(1);
  }

  console.log(`📊 Found ${clients.length} active clients in registry\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const client of clients) {
    const lookupName = client.airtable_workspace_name || client.workspace_name;
    const airtableData = AIRTABLE_TARGETS[lookupName];

    if (airtableData) {
      console.log(`✅ ${client.workspace_name}: Setting target to ${airtableData.target.toLocaleString()}`);

      const { error: updateError } = await supabase
        .from('client_registry')
        .update({
          monthly_sending_target: airtableData.target,
          display_name: airtableData.display_name // Also update display name if different
        })
        .eq('workspace_name', client.workspace_name);

      if (updateError) {
        console.error(`   ❌ Error updating ${client.workspace_name}:`, updateError);
      } else {
        updated++;
      }
    } else if (ZERO_TARGET_CLIENTS.includes(lookupName)) {
      console.log(`⏭️  ${client.workspace_name}: Skipping (has 0 target in Airtable)`);
      skipped++;
    } else {
      console.log(`⚠️  ${client.workspace_name}: Not found in Airtable mapping`);
      notFound++;
    }
  }

  console.log(`\n📈 Summary:`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️  Skipped (0 target): ${skipped}`);
  console.log(`   ⚠️  Not found: ${notFound}`);
  console.log(`   📊 Total: ${clients.length}`);

  // Verify the updates
  const { data: verifyData, error: verifyError } = await supabase
    .from('client_registry')
    .select('workspace_name, display_name, monthly_sending_target')
    .eq('is_active', true)
    .gt('monthly_sending_target', 0)
    .order('monthly_sending_target', { ascending: false });

  if (verifyError) {
    console.error('\n❌ Error verifying updates:', verifyError);
  } else {
    console.log(`\n✅ Verification: ${verifyData.length} clients now have sending targets:\n`);
    verifyData.forEach(c => {
      console.log(`   ${c.display_name.padEnd(30)} ${c.monthly_sending_target.toLocaleString().padStart(10)}`);
    });
  }
}

backfillTargets().catch(console.error);
