const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

const MAVERICK_API_KEY = '101|6mXfEtJkLDF99HcmvOqlJcjlYaDyt9pGt9c6C7qJ56e6298b';
const BASE_URL = 'https://send.maverickmarketingllc.com/api';
const WORKSPACE_ID = 67;
const WORKSPACE_NAME = 'Curtis Ostler Agency';
const WEBHOOK_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook';

async function configure() {
  // Switch to workspace
  console.log('=== Switching to Curtis Ostler Agency (id=67) ===');
  await fetch(`${BASE_URL}/workspaces/v1.1/switch-workspace`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${MAVERICK_API_KEY}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ team_id: WORKSPACE_ID })
  });
  console.log('✅ Switched');

  // Create API key
  console.log('\n=== Creating API key ===');
  const keyRes = await fetch(`${BASE_URL}/workspaces/v1.1/${WORKSPACE_ID}/api-tokens`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${MAVERICK_API_KEY}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Maverick Dashboard' })
  });
  const keyData = await keyRes.json();
  const apiKey = keyData?.plain_text_token || keyData?.data?.plain_text_token;
  if (!apiKey) throw new Error('No key: ' + JSON.stringify(keyData));
  console.log(`✅ API key: ***${apiKey.slice(-8)}`);

  // Fetch email accounts
  console.log('\n=== Fetching email accounts ===');
  const emailRes = await fetch(`${BASE_URL}/sender-emails?per_page=100`, {
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
  });
  const emailData = await emailRes.json();
  const accounts = emailData.data || [];
  console.log(`Found ${accounts.length} accounts`);

  // Upsert into sender_emails_cache
  for (const acct of accounts) {
    const { error } = await supabase
      .from('sender_emails_cache')
      .upsert({
        email_address: acct.email,
        account_name: acct.name,
        workspace_name: WORKSPACE_NAME,
        bison_workspace_id: WORKSPACE_ID,
        bison_instance: 'Maverick',
        status: acct.status === 'connected' ? 'Connected' : (acct.status || 'Unknown'),
        daily_limit: acct.daily_limit,
        emails_sent_count: acct.emails_sent,
        bounced_count: acct.bounced,
        account_type: acct.type,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'email_address,workspace_name' });
    if (error) console.error(`  ❌ ${acct.email}: ${error.message}`);
    else console.log(`  ✅ ${acct.email} (${acct.status})`);
  }

  // Update client_registry
  console.log('\n=== Updating client_registry ===');
  const { error: regErr } = await supabase
    .from('client_registry')
    .update({
      bison_workspace_id: WORKSPACE_ID,
      bison_workspace_name: WORKSPACE_NAME,
      bison_api_key: apiKey,
      bison_api_key_status: 'active',
      bison_api_key_name: 'Maverick Dashboard',
      bison_webhook_url: WEBHOOK_URL,
      bison_webhook_enabled: true,
      bison_webhook_events: ['lead_replied', 'lead_interested'],
      bison_webhook_health: 'disabled',
    })
    .eq('workspace_name', WORKSPACE_NAME);

  if (regErr) throw new Error('Registry update failed: ' + regErr.message);
  console.log('✅ client_registry updated');

  // Final status
  console.log('\n=== FINAL STATUS ===');
  console.log(`✅ Bison Workspace Linked:   id=${WORKSPACE_ID}`);
  console.log(`✅ API Key Configured:       ***${apiKey.slice(-8)}`);
  console.log(`✅ Webhooks:                 configured (DB) — already added in Bison UI`);
  console.log(`✅ Email Accounts Synced:    ${accounts.length} accounts`);

  const { data: reg } = await supabase.from('client_registry').select('slack_webhook_url, live_replies_enabled').eq('workspace_name', WORKSPACE_NAME).single();
  console.log(`${reg?.slack_webhook_url ? '✅' : '❌'} Slack Notifications:      ${reg?.slack_webhook_url ? 'SET' : 'NOT SET'}`);
  console.log(`✅ Live Replies:             ${reg?.live_replies_enabled ? 'enabled' : 'disabled'}`);
}

configure().catch(err => console.error('FATAL:', err.message));
