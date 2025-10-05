import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

// Client pricing data from CSV
const clientPricingData = [
  // Retainer clients
  { workspace_name: 'Shane Miller', billing_type: 'retainer', retainer_amount: 2175, price_per_lead: 0 },
  { workspace_name: 'Ozment media', billing_type: 'retainer', retainer_amount: 560, price_per_lead: 0 },
  { workspace_name: 'Kirk Hodgson', billing_type: 'retainer', retainer_amount: 1500, price_per_lead: 0 },
  { workspace_name: 'StreetSmart Commercial', billing_type: 'retainer', retainer_amount: 1500, price_per_lead: 0 },
  { workspace_name: 'SMA Insurance', billing_type: 'retainer', retainer_amount: 2000, price_per_lead: 0 },
  { workspace_name: 'SAVANTY', billing_type: 'retainer', retainer_amount: 688, price_per_lead: 0 }, // 480 + 208 combined
  { workspace_name: 'StreetSmart Trucking', billing_type: 'retainer', retainer_amount: 1500, price_per_lead: 0 },
  { workspace_name: 'JMISON YERGLER', billing_type: 'retainer', retainer_amount: 1500, price_per_lead: 0 },
  { workspace_name: 'Jeff Schroder', billing_type: 'retainer', retainer_amount: 0, price_per_lead: 0, is_active: false },
  { workspace_name: 'RAIDAINT ENERGY', billing_type: 'retainer', retainer_amount: 2500, price_per_lead: 0 },

  // Per-lead clients
  { workspace_name: 'Nick Sahah', billing_type: 'per_lead', price_per_lead: 20, retainer_amount: 0 },
  { workspace_name: 'Tony S', billing_type: 'per_lead', price_per_lead: 20, retainer_amount: 0 },
  { workspace_name: 'Devin Hodo', billing_type: 'per_lead', price_per_lead: 25, retainer_amount: 0 },
  { workspace_name: 'Gregg Blanchard', billing_type: 'per_lead', price_per_lead: 30, retainer_amount: 0 },
  { workspace_name: 'Danny s', billing_type: 'per_lead', price_per_lead: 25, retainer_amount: 0 },
  { workspace_name: 'David Amiri', billing_type: 'per_lead', price_per_lead: 25, retainer_amount: 0 },
  { workspace_name: 'Rob Russell', billing_type: 'per_lead', price_per_lead: 25, retainer_amount: 0 },
  { workspace_name: 'John Roberts', billing_type: 'per_lead', price_per_lead: 25, retainer_amount: 0 },
  { workspace_name: 'StreetSmart P&C', billing_type: 'per_lead', price_per_lead: 25, retainer_amount: 0 },
  { workspace_name: 'Kim Wallace', billing_type: 'per_lead', price_per_lead: 17.50, retainer_amount: 0 },
  { workspace_name: 'Jason Binyon', billing_type: 'per_lead', price_per_lead: 15, retainer_amount: 0 },
];

async function seedClientPricing() {
  console.log('🌱 Seeding client pricing data...');

  for (const client of clientPricingData) {
    const { data, error } = await supabase
      .from('client_pricing')
      .upsert(client, {
        onConflict: 'workspace_name',
        ignoreDuplicates: false
      });

    if (error) {
      console.error(`❌ Error seeding ${client.workspace_name}:`, error.message);
    } else {
      console.log(`✅ Seeded: ${client.workspace_name} (${client.billing_type})`);
    }
  }

  console.log('\n✨ Seeding complete!');

  // Verify
  const { data: allPricing, error: fetchError } = await supabase
    .from('client_pricing')
    .select('*')
    .order('workspace_name');

  if (!fetchError && allPricing) {
    console.log(`\n📊 Total clients in pricing table: ${allPricing.length}`);
    console.log(`   - Retainer clients: ${allPricing.filter(c => c.billing_type === 'retainer').length}`);
    console.log(`   - Per-lead clients: ${allPricing.filter(c => c.billing_type === 'per_lead').length}`);
  }
}

seedClientPricing().catch(console.error);
