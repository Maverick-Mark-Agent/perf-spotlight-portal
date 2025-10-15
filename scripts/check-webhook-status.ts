import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function checkStatus() {
  console.log('📊 Webhook Implementation Status Across All Clients\n');
  console.log('═'.repeat(100));

  const { data: clients } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_webhook_enabled, bison_api_key, is_active, bison_instance')
    .eq('is_active', true)
    .order('workspace_name');

  const totalActive = clients?.length || 0;
  const withWebhooks = clients?.filter(c => c.bison_webhook_enabled).length || 0;
  const withApiKeys = clients?.filter(c => c.bison_api_key).length || 0;
  const fullyConfigured = clients?.filter(c => c.bison_webhook_enabled && c.bison_api_key).length || 0;

  const missingApiKey = clients?.filter(c => !c.bison_api_key) || [];
  const missingWebhook = clients?.filter(c => c.bison_api_key && !c.bison_webhook_enabled) || [];

  console.log('📈 SUMMARY:\n');
  console.log(`Total Active Clients:     ${totalActive}`);
  console.log(`With API Keys:            ${withApiKeys}/${totalActive} (${Math.round(withApiKeys / totalActive * 100)}%)`);
  console.log(`With Webhooks Enabled:    ${withWebhooks}/${totalActive} (${Math.round(withWebhooks / totalActive * 100)}%)`);
  console.log(`Fully Configured:         ${fullyConfigured}/${totalActive} (${Math.round(fullyConfigured / totalActive * 100)}%)`);
  console.log('');

  console.log('✅ WORKING CLIENTS (Webhooks + API Keys):\n');
  const working = clients?.filter(c => c.bison_webhook_enabled && c.bison_api_key) || [];
  for (const client of working) {
    console.log(`   ✅ ${client.workspace_name.padEnd(35)} (${client.bison_instance})`);
  }
  console.log(`\n   Total: ${working.length} clients with automatic lead sync\n`);

  if (missingApiKey.length > 0) {
    console.log('❌ MISSING API KEY:\n');
    for (const client of missingApiKey) {
      console.log(`   ❌ ${client.workspace_name.padEnd(35)} (${client.bison_instance})`);
      console.log(`      → Need to create workspace API key in Email Bison`);
    }
    console.log('');
  }

  if (missingWebhook.length > 0) {
    console.log('⚠️  HAS API KEY BUT NO WEBHOOK:\n');
    for (const client of missingWebhook) {
      console.log(`   ⚠️  ${client.workspace_name.padEnd(35)} (${client.bison_instance})`);
      console.log(`      → Run: npx tsx scripts/create-workspace-webhooks.ts`);
    }
    console.log('');
  }

  console.log('═'.repeat(100));
  console.log('\n🎯 CURRENT STATE:\n');

  if (fullyConfigured === totalActive) {
    console.log('✅ ALL CLIENTS FULLY CONFIGURED!');
    console.log('   Every active client has automatic webhook-based lead syncing');
  } else {
    console.log(`✅ ${fullyConfigured} clients with automatic lead sync`);
    console.log(`⚠️  ${totalActive - fullyConfigured} client(s) need configuration`);
  }

  console.log('\n📝 HOW IT WORKS:\n');
  console.log('1. Lead marked as interested in Email Bison');
  console.log('2. Workspace-specific webhook fires immediately');
  console.log('3. Lead appears in client portal in real-time');
  console.log('4. Complete with custom variables, phone, address, etc.\n');

  console.log('═'.repeat(100));
}

checkStatus().catch(console.error);
