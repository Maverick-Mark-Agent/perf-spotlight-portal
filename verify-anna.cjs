const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://gjqbbgrfhijescaouqkx.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0');
async function main() {
  const { data: reg } = await supabase.from('client_registry').select('workspace_name, display_name, bison_workspace_name, bison_workspace_id, bison_webhook_url, bison_webhook_enabled, bison_api_key_status, slack_webhook_url').eq('workspace_name', 'Anna Luna Agency');
  const c = reg && reg[0];
  console.log('=== client_registry ===');
  if (c) {
    console.log('  workspace_name:        ' + c.workspace_name);
    console.log('  display_name:          ' + c.display_name);
    console.log('  bison_workspace_name:  ' + c.bison_workspace_name);
    console.log('  bison_workspace_id:    ' + c.bison_workspace_id);
    console.log('  bison_webhook_url:     ' + (c.bison_webhook_url ? 'SET' : 'MISSING'));
    console.log('  bison_webhook_enabled: ' + c.bison_webhook_enabled);
    console.log('  bison_api_key_status:  ' + c.bison_api_key_status);
    console.log('  slack_webhook_url:     ' + (c.slack_webhook_url ? 'SET' : 'MISSING'));
  } else {
    console.log('  NOT FOUND');
  }

  const { count: newCount } = await supabase.from('client_metrics').select('*', { count: 'exact', head: true }).eq('workspace_name', 'Anna Luna Agency');
  console.log('\n=== client_metrics ===');
  console.log('  rows for Anna Luna Agency: ' + (newCount || 0));

  const { count: oldCount } = await supabase.from('client_registry').select('*', { count: 'exact', head: true }).eq('workspace_name', 'Anna Luna');
  console.log('\n=== Old name cleanup ===');
  console.log('  rows still with Anna Luna: ' + (oldCount || 0) + (oldCount === 0 ? ' (clean)' : ' WARNING: still exists'));

  const { data: events } = await supabase.from('webhook_delivery_log').select('workspace_name, event_type, created_at').ilike('workspace_name', '%anna luna%').order('created_at', { ascending: false }).limit(5);
  console.log('\n=== Recent webhook events ===');
  if (events && events.length > 0) {
    events.forEach(function(e) { console.log('  ' + e.created_at + ' | ' + e.workspace_name + ' | ' + e.event_type); });
  } else {
    console.log('  None found');
  }
}
main().catch(function(e) { console.error(e.message); });
