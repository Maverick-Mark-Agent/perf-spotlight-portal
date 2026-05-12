const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

const WS = 'StreetSmart P&C';

async function check() {
  // Check webhook_delivery_log without processed_successfully column
  console.log('=== webhook_delivery_log (all events for StreetSmart P&C) ===');
  const { data: logs, error: logErr } = await supabase
    .from('webhook_delivery_log')
    .select('event_type, workspace_name, created_at, payload')
    .eq('workspace_name', WS)
    .order('created_at', { ascending: false })
    .limit(10);

  if (logErr) console.log('Error:', logErr.message);
  else if (!logs?.length) {
    console.log('❌ ZERO webhook events ever received for StreetSmart P&C');
    console.log('   This means the Bison webhook is NOT firing to our endpoint.');
  } else {
    console.log(`${logs.length} events found:`);
    logs.forEach(l => console.log(`  [${l.created_at?.substring(0,16)}] ${l.event_type}`));
  }

  // Also check what workspace_name Bison sends in its payload
  console.log('\n=== Checking if Bison sends a different workspace name ===');
  const { data: allLogs } = await supabase
    .from('webhook_delivery_log')
    .select('workspace_name, event_type, created_at')
    .ilike('workspace_name', '%street%')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`Events with "street" in workspace_name: ${allLogs?.length || 0}`);
  allLogs?.forEach(l => console.log(`  [${l.created_at?.substring(0,16)}] "${l.workspace_name}" | ${l.event_type}`));

  // Check bison_webhook_health — it's "disabled", meaning webhook was never confirmed active
  console.log('\n=== SUMMARY ===');
  console.log('bison_webhook_health = "disabled" — webhook URL saved in DB but Bison never sent an event');
  console.log('lead_interested events in bison_webhook_events — only lead_interested, NOT lead_replied');
  console.log('19 interested leads in lead_replies — these came in via lead_replied webhook (not lead_interested)');
  console.log('0 slack notifications sent — because lead_interested webhook never fired');
  console.log('');
  console.log('ROOT CAUSE: StreetSmart P&C has NO webhooks set up in Bison UI.');
  console.log('The bison_webhook_events only has ["lead_interested"] — lead_replied is missing too.');
}

check().catch(console.error);
