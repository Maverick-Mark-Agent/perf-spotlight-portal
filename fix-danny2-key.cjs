const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

const BASE_URL = 'https://send.maverickmarketingllc.com/api';
const WORKSPACE_ID = 73;
const WORKSPACE_NAME = 'Danny Schwartz 2';

async function sync() {
  // Get the saved key
  const { data: reg } = await supabase
    .from('client_registry')
    .select('bison_api_key')
    .eq('workspace_name', WORKSPACE_NAME)
    .single();

  const apiKey = reg.bison_api_key;

  // Fetch all email accounts
  const res = await fetch(`${BASE_URL}/sender-emails?per_page=100`, {
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
  });
  const data = await res.json();
  const accounts = data?.data || [];
  console.log(`Syncing ${accounts.length} email accounts...\n`);

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
  console.log('\nDone.');
}

sync().catch(console.error);
