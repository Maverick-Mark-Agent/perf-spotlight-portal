import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateWhatChanged() {
  console.log('=== INVESTIGATING: WHAT CHANGED BETWEEN OCT 13 AND OCT 14 ===\n');

  // Check ALL webhooks that came through on Oct 13 vs Oct 14
  console.log('1. WEBHOOK DELIVERIES - OCT 13:');
  const { data: oct13 } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .gte('created_at', '2025-10-13T00:00:00Z')
    .lt('created_at', '2025-10-14T00:00:00Z')
    .eq('workspace_name', 'Tony Schmitz')
    .order('created_at', { ascending: false });

  console.log(`Total webhooks on Oct 13: ${oct13?.length || 0}\n`);

  oct13?.forEach((wh, idx) => {
    console.log(`Webhook ${idx + 1}:`);
    console.log(`  Time: ${wh.created_at}`);
    console.log(`  Lead: ${wh.payload?.data?.lead?.email || 'N/A'}`);
    console.log(`  Lead Name: ${wh.payload?.data?.lead?.first_name} ${wh.payload?.data?.lead?.last_name}`);
    console.log(`  Success: ${wh.success}`);
    console.log();
  });

  console.log('\n2. WEBHOOK DELIVERIES - OCT 14 (early morning, real leads):');
  const { data: oct14 } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .gte('created_at', '2025-10-14T00:00:00Z')
    .lt('created_at', '2025-10-14T19:00:00Z') // Before our test webhooks
    .eq('workspace_name', 'Tony Schmitz')
    .order('created_at', { ascending: false });

  console.log(`Total webhooks on Oct 14 (real leads): ${oct14?.length || 0}\n`);

  oct14?.forEach((wh, idx) => {
    console.log(`Webhook ${idx + 1}:`);
    console.log(`  Time: ${wh.created_at}`);
    console.log(`  Lead: ${wh.payload?.data?.lead?.email || 'N/A'}`);
    console.log(`  Lead Name: ${wh.payload?.data?.lead?.first_name} ${wh.payload?.data?.lead?.last_name}`);
    console.log(`  Success: ${wh.success}`);
    console.log();
  });

  console.log('\n3. CRITICAL FINDING:');
  if (oct13 && oct13.length > 0) {
    console.log('✅ Oct 13 webhooks DID come through to Supabase!');
    console.log('This proves workspace-specific webhooks were working on Oct 13.');
  }

  if (oct14 && oct14.length > 0) {
    console.log('✅ Oct 14 early morning webhooks also came through!');
    console.log('This means it was still working overnight.');
  }

  console.log('\n4. TIMELINE OF EVENTS:');
  console.log('Oct 13 evening: 8 webhooks received ✅');
  console.log('Oct 14 00:12: Ronald Johnson webhook received ✅');
  console.log('Oct 14 01:12: Michael Feterl webhook received ✅');
  console.log('Oct 14 01:19: Aaron Markley webhook received ✅');
  console.log('Oct 14 19:08+: Our test webhooks received ✅');
  console.log('Oct 14 22:19: We deleted webhook #114 and created #115');
  console.log('Oct 14 22:25+: No webhooks coming through ❌');

  console.log('\n5. THE QUESTION:');
  console.log('What was different between 01:19 (working) and 22:25 (not working)?');
  console.log('\nPossible answers:');
  console.log('  A) Webhook was deleted/changed between these times');
  console.log('  B) n8n webhook was activated after 01:19');
  console.log('  C) Email Bison changed webhook priority behavior');
  console.log('  D) We need to wait longer for cache (but we waited 45 seconds)');

  console.log('\n6. CHECKING: What time did we DELETE webhook #86?');
  console.log('We need to check when webhook #86 stopped working.');
  console.log('If #86 was deleted BEFORE 01:19, then something else is the cause.');

  console.log('\n7. THEORY:');
  console.log('Based on the evidence:');
  console.log('  - Webhooks were working until at least 01:19 AM today');
  console.log('  - User reported it "not working" later today');
  console.log('  - We probably deleted #86 during our "fix" attempts');
  console.log('  - That deletion broke what was working');
  console.log('  - Creating #115 didn\'t restore it because parent webhook now intercepts');

  console.log('\n8. THE REAL QUESTION:');
  console.log('Why did webhook #86 work despite the n8n parent webhook?');
  console.log('Answer: Either:');
  console.log('  - Child workspace webhooks DO override parent webhooks');
  console.log('  - OR the n8n webhook wasn\'t set for lead_interested');
  console.log('  - OR the n8n webhook was added very recently');
}

investigateWhatChanged().catch(console.error);
