import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listActiveClients() {
  console.log('📋 Fetching Active Clients from Database...\n');

  // Get all active clients from client_registry
  const { data: clients, error: clientError } = await supabase
    .from('client_registry')
    .select('*')
    .eq('is_active', true)
    .order('workspace_name');

  if (clientError) {
    console.error('❌ Error fetching clients:', clientError);
    return;
  }

  if (!clients || clients.length === 0) {
    console.log('⚠️  No active clients found in database.');
    return;
  }

  console.log(`✅ Found ${clients.length} active clients:\n`);
  console.log('═'.repeat(120));
  console.log(
    'WORKSPACE NAME'.padEnd(35) +
    'DISPLAY NAME'.padEnd(30) +
    'MONTHLY TARGET'.padEnd(20) +
    'BILLING TYPE'.padEnd(20) +
    'PRICE/RETAINER'
  );
  console.log('═'.repeat(120));

  for (const client of clients) {
    const workspaceName = (client.workspace_name || 'N/A').padEnd(35);
    const displayName = (client.display_name || '-').padEnd(30);
    const target = (client.monthly_kpi_target?.toString() || '0').padEnd(20);
    const billingType = (client.billing_type || 'N/A').padEnd(20);
    const price = client.billing_type === 'per_lead'
      ? `$${client.price_per_lead || 0}/lead`
      : `$${client.retainer_amount || 0}/mo`;

    console.log(workspaceName + displayName + target + billingType + price);
  }

  console.log('═'.repeat(120));
  console.log(`\n📊 Summary:`);
  console.log(`   Total Active Clients: ${clients.length}`);
  console.log(`   Per-Lead Clients: ${clients.filter(c => c.billing_type === 'per_lead').length}`);
  console.log(`   Retainer Clients: ${clients.filter(c => c.billing_type === 'retainer').length}`);
  console.log(`   Total Monthly Target: ${clients.reduce((sum, c) => sum + (c.monthly_kpi_target || 0), 0)} contacts`);

  // Now get actual cleaned counts for current month
  const currentMonth = '2025-11'; // Update this as needed

  console.log(`\n\n📈 Cleaned Contacts for ${currentMonth}:`);
  console.log('═'.repeat(120));

  const { data: cleanedData, error: cleanedError } = await supabase
    .from('monthly_cleaned_leads')
    .select('*')
    .eq('month', currentMonth)
    .order('client_name');

  if (cleanedError) {
    console.error('❌ Error fetching cleaned contacts:', cleanedError);
  } else if (cleanedData && cleanedData.length > 0) {
    console.log(
      'CLIENT/WORKSPACE'.padEnd(40) +
      'CLEANED'.padEnd(15) +
      'TARGET'.padEnd(15) +
      'GAP'.padEnd(15) +
      'STATUS'
    );
    console.log('═'.repeat(120));

    for (const row of cleanedData) {
      const name = (row.workspace_name || row.client_name).padEnd(40);
      const cleaned = row.cleaned_count.toString().padEnd(15);
      const target = (row.target_count?.toString() || '-').padEnd(15);
      const gap = (row.gap?.toString() || '-').padEnd(15);
      const status = row.gap && row.gap < 0 ? '✅ Over' : row.gap && row.gap > 0 ? '⚠️  Under' : '✓ Met';

      console.log(name + cleaned + target + gap + status);
    }
  } else {
    console.log(`⚠️  No cleaned contact data found for ${currentMonth}`);
  }

  console.log('\n✨ Done!\n');
}

listActiveClients().catch(console.error);
