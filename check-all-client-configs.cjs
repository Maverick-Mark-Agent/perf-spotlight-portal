const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

const CLIENTS = [
  'Tactical Hr',
  'Jason Park Kansas',
  'Jason Park Oklahoma',
  'Jason Park Missouri',
  'Stratlend Mortgage Advisors',
  'Heidi Rowan Agency',
  'Frank Delemos Agency',
  'Brian Weatherman Agency',
  'Eric Jeglum Agency',
  'Gregg 2',
];

async function check() {
  const { data, error } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_api_key, bison_webhook_enabled, bison_webhook_events, slack_webhook_url')
    .in('workspace_name', CLIENTS);

  if (error) { console.error(error.message); return; }

  // Also check email accounts
  const { data: emails } = await supabase
    .from('sender_emails_cache')
    .select('workspace_name')
    .in('workspace_name', CLIENTS);

  const emailCounts = {};
  (emails || []).forEach(e => {
    emailCounts[e.workspace_name] = (emailCounts[e.workspace_name] || 0) + 1;
  });

  console.log('\n' + 'Workspace'.padEnd(35) + 'WS_ID'.padEnd(8) + 'API_KEY'.padEnd(10) + 'WEBHOOKS'.padEnd(30) + 'EMAILS'.padEnd(8) + 'SLACK');
  console.log('-'.repeat(100));

  // Check which clients are missing from DB
  const found = data.map(d => d.workspace_name);
  CLIENTS.forEach(c => {
    if (!found.includes(c)) {
      console.log(`${c.padEnd(35)} NOT FOUND IN DATABASE`);
    }
  });

  data.forEach(r => {
    const wsId = r.bison_workspace_id ? String(r.bison_workspace_id) : '❌';
    const apiKey = r.bison_api_key ? '✅' : '❌';
    const events = Array.isArray(r.bison_webhook_events) ? r.bison_webhook_events.join(',') : (r.bison_webhook_events || '');
    const hasReplied = events.includes('lead_replied');
    const hasInterested = events.includes('lead_interested');
    const webhooks = r.bison_webhook_enabled 
      ? `${hasReplied ? '✅' : '❌'}replied ${hasInterested ? '✅' : '❌'}interested`
      : '❌ disabled';
    const emailCount = emailCounts[r.workspace_name] || 0;
    const slack = r.slack_webhook_url ? '✅' : '❌';

    console.log(`${r.workspace_name.padEnd(35)}${wsId.padEnd(8)}${apiKey.padEnd(10)}${webhooks.padEnd(30)}${String(emailCount).padEnd(8)}${slack}`);
  });
}

check().catch(console.error);
