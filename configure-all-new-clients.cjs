const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

const MAVERICK_API_KEY = '101|6mXfEtJkLDF99HcmvOqlJcjlYaDyt9pGt9c6C7qJ56e6298b';
const BASE_URL = 'https://send.maverickmarketingllc.com/api';
const WEBHOOK_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook';

const CLIENTS = [
  { wsName: 'Tactical Hr',                  bisonId: 62,  bisonName: 'Tactical HR' },
  { wsName: 'Jason Park Kansas',            bisonId: 65,  bisonName: 'Jason Park Kansas' },
  { wsName: 'Jason Park Oklahoma',          bisonId: 63,  bisonName: 'Jason Park Oklahoma' },
  { wsName: 'Jason Park Missouri',          bisonId: 64,  bisonName: 'Jason Park Missouri' },
  { wsName: 'Stratlend Mortgage Advisors',  bisonId: 66,  bisonName: 'Stratlend Mortgage Advisors' },
  { wsName: 'Heidi Rowan Agency',           bisonId: 70,  bisonName: 'Heidi Rowan Agency' },
  { wsName: 'Frank Delemos Agency',         bisonId: 69,  bisonName: 'Frank Delemos Agency' },
  { wsName: 'Brian Weatherman Agency',      bisonId: 71,  bisonName: 'Brian Weatherman Agency' },
  { wsName: 'Eric Jeglum Agency',           bisonId: 72,  bisonName: 'Eric Jeglum Agency' },
  { wsName: 'Gregg 2',                      bisonId: 68,  bisonName: 'Gregg 2' },
];

async function apiReq(path, opts = {}, keyOverride = null) {
  const key = keyOverride || MAVERICK_API_KEY;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: { 'Authorization': `Bearer ${key}`, 'Accept': 'application/json', 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path} (${res.status}): ${JSON.stringify(data).slice(0,200)}`);
  return data;
}

async function configureClient(client) {
  console.log(`\n${'='.repeat(55)}`);
  console.log(`  ${client.wsName} (Bison ID: ${client.bisonId})`);
  console.log('='.repeat(55));

  // Switch to workspace
  await apiReq(`/workspaces/v1.1/switch-workspace`, { method: 'POST', body: JSON.stringify({ team_id: client.bisonId }) });

  // Create API key
  let apiKey = null;
  try {
    const keyData = await apiReq(`/workspaces/v1.1/${client.bisonId}/api-tokens`, {
      method: 'POST', body: JSON.stringify({ name: 'Maverick Dashboard' })
    });
    apiKey = keyData?.plain_text_token || keyData?.data?.plain_text_token;
    console.log(`✅ API key: ***${apiKey?.slice(-8)}`);
  } catch(e) {
    console.error(`❌ API key failed: ${e.message}`);
  }

  // Fetch email accounts using the new key (or fall back to global)
  let accounts = [];
  try {
    const keyToUse = apiKey || MAVERICK_API_KEY;
    const emailData = await apiReq(`/sender-emails?per_page=100`, {}, keyToUse);
    accounts = emailData.data || [];
    console.log(`✅ Email accounts: ${accounts.length}`);
  } catch(e) {
    console.error(`❌ Email accounts failed: ${e.message}`);
  }

  // Upsert email accounts into sender_emails_cache
  for (const acct of accounts) {
    const { error } = await supabase
      .from('sender_emails_cache')
      .upsert({
        email_address: acct.email,
        account_name: acct.name,
        workspace_name: client.wsName,
        bison_workspace_id: client.bisonId,
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
  const update = {
    bison_workspace_id: client.bisonId,
    bison_workspace_name: client.bisonName,
    bison_webhook_url: WEBHOOK_URL,
    bison_webhook_enabled: true,
    bison_webhook_events: ['lead_replied', 'lead_interested'],
    bison_webhook_health: 'disabled',
  };
  if (apiKey) {
    update.bison_api_key = apiKey;
    update.bison_api_key_status = 'active';
    update.bison_api_key_name = 'Maverick Dashboard';
  }

  const { error: regErr } = await supabase
    .from('client_registry')
    .update(update)
    .eq('workspace_name', client.wsName);

  if (regErr) console.error(`❌ Registry update failed: ${regErr.message}`);
  else console.log(`✅ client_registry updated`);

  return { wsName: client.wsName, apiKey: !!apiKey, emails: accounts.length };
}

async function runAll() {
  const results = [];
  for (const client of CLIENTS) {
    try {
      const r = await configureClient(client);
      results.push({ ...r, ok: true });
    } catch(e) {
      console.error(`FATAL for ${client.wsName}:`, e.message);
      results.push({ wsName: client.wsName, ok: false, error: e.message });
    }
  }

  console.log('\n' + '='.repeat(55));
  console.log('  FINAL SUMMARY');
  console.log('='.repeat(55));
  console.log('Workspace'.padEnd(38) + 'API Key  Emails');
  console.log('-'.repeat(55));
  results.forEach(r => {
    if (r.ok) {
      console.log(`${r.wsName.padEnd(38)}${r.apiKey ? '✅' : '❌'}        ${r.emails}`);
    } else {
      console.log(`${r.wsName.padEnd(38)}FAILED: ${r.error?.slice(0,30)}`);
    }
  });
  console.log('\n⚠️  MANUAL STEP for each workspace in Bison UI:');
  console.log(`   Automations → Webhooks → New`);
  console.log(`   Name: Dash 1`);
  console.log(`   URL:  ${WEBHOOK_URL}`);
  console.log(`   Create TWO: "lead_replied" and "lead_interested"`);
}

runAll().catch(console.error);
