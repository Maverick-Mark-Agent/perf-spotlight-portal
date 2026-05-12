const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function check() {
  const { data, error } = await supabase
    .from('client_registry')
    .select('*')
    .ilike('workspace_name', '%danny%');

  if (error) { console.error(error.message); return; }
  console.log(`Found ${data.length} Danny workspaces:\n`);
  data.forEach(r => {
    console.log(`workspace_name: "${r.workspace_name}"`);
    console.log(`  display_name: ${r.display_name}`);
    console.log(`  bison_workspace_id: ${r.bison_workspace_id}`);
    console.log(`  bison_workspace_name: ${r.bison_workspace_name}`);
    console.log(`  bison_instance: ${r.bison_instance}`);
    console.log(`  bison_api_key: ${r.bison_api_key ? r.bison_api_key.substring(0,20) + '...' : 'NOT SET'}`);
    console.log(`  bison_webhook_url: ${r.bison_webhook_url}`);
    console.log(`  bison_webhook_enabled: ${r.bison_webhook_enabled}`);
    console.log(`  bison_webhook_events: ${r.bison_webhook_events}`);
    console.log(`  bison_webhook_health: ${r.bison_webhook_health}`);
    console.log(`  slack_webhook_url: ${r.slack_webhook_url ? 'SET' : 'NOT SET'}`);
    console.log(`  live_replies_enabled: ${r.live_replies_enabled}`);
  });
}

check().catch(console.error);
