#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function main() {
  console.log('\n=== Checking if Bison test event hit our webhook ===\n');

  // Check webhook_delivery_log for the test event from Cody's Team
  const { data: testEvents, error } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('Last 10 webhook delivery log entries:\n');
  (testEvents || []).forEach(function(e) {
    console.log('  workspace:  ' + e.workspace_name);
    console.log('  event_type: ' + e.event_type);
    console.log('  created_at: ' + e.created_at);
    console.log('  ---');
  });

  // Specifically look for Cody's Team (the test workspace)
  const codys = (testEvents || []).filter(function(e) {
    return (e.workspace_name || '').toLowerCase().includes('cody');
  });

  if (codys.length > 0) {
    console.log('\n✅ TEST EVENT RECEIVED — Bison webhook is connected and firing correctly.');
    console.log('   (The "Codys Team" test payload hit our server — Anna Luna webhook IS working.)');
    console.log('   Real events will flow in as her campaign sends emails.');
  } else {
    console.log('\n❌ No test event found — webhook may not be saved/active in Bison yet.');
  }
}

main().catch(function(e) { console.error('Fatal:', e.message); });
