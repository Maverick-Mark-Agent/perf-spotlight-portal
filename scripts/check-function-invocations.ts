import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFunctionInvocations() {
  console.log('=== CHECKING IF WEBHOOK FUNCTION IS BEING CALLED ===\n');

  // Check if ANY webhooks are hitting our function today
  console.log('1. ALL WEBHOOK ACTIVITY TODAY:');
  const { data: todayWebhooks, error } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .gte('created_at', '2025-10-14T00:00:00Z')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Total webhooks today: ${todayWebhooks.length}`);

  const byWorkspace = todayWebhooks.reduce((acc: any, w: any) => {
    const name = w.workspace_name || 'unknown';
    if (!acc[name]) {
      acc[name] = { total: 0, events: {} };
    }
    acc[name].total++;
    acc[name].events[w.event_type] = (acc[name].events[w.event_type] || 0) + 1;
    return acc;
  }, {});

  console.log('\nBreakdown by workspace:');
  Object.entries(byWorkspace).forEach(([name, stats]: [string, any]) => {
    console.log(`\n${name}: ${stats.total} total`);
    Object.entries(stats.events).forEach(([event, count]) => {
      console.log(`  - ${event}: ${count}`);
    });
  });

  // Check for Tony specifically
  console.log('\n2. TONY SCHMITZ SPECIFIC:');
  const tonyWebhooks = todayWebhooks.filter(w =>
    w.workspace_name?.toLowerCase().includes('tony')
  );
  console.log(`Tony webhooks today: ${tonyWebhooks.length}`);
  tonyWebhooks.forEach(w => {
    console.log(`  ${w.created_at}: ${w.event_type} | ${w.lead_email || 'N/A'} | Status: ${w.status}`);
  });

  // Check the most recent webhook for ANY workspace
  console.log('\n3. MOST RECENT WEBHOOK (Any workspace):');
  if (todayWebhooks.length > 0) {
    const recent = todayWebhooks[0];
    console.log(`Time: ${recent.created_at}`);
    console.log(`Workspace: ${recent.workspace_name}`);
    console.log(`Event: ${recent.event_type}`);
    console.log(`Status: ${recent.status}`);
    console.log(`Lead: ${recent.lead_email || 'N/A'}`);
    console.log(`Error: ${recent.error_message || 'None'}`);
  } else {
    console.log('❌ NO WEBHOOKS RECORDED TODAY AT ALL');
    console.log('This suggests the Edge Function is not being invoked');
  }

  // Compare with yesterday's most recent webhook
  console.log('\n4. YESTERDAY (Oct 13) FOR COMPARISON:');
  const { data: yesterdayWebhooks } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .gte('created_at', '2025-10-13T00:00:00Z')
    .lt('created_at', '2025-10-14T00:00:00Z')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`Total webhooks yesterday: ${yesterdayWebhooks?.length || 0}`);
  yesterdayWebhooks?.slice(0, 5).forEach(w => {
    console.log(`  ${w.created_at}: ${w.workspace_name} | ${w.event_type} | ${w.lead_email || 'N/A'}`);
  });
}

checkFunctionInvocations().catch(console.error);
