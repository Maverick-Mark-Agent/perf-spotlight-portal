const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

const MAVERICK_API_KEY = '101|6mXfEtJkLDF99HcmvOqlJcjlYaDyt9pGt9c6C7qJ56e6298b';
const BASE_URL = 'https://send.maverickmarketingllc.com/api';
const WORKSPACE_ID = 73;
const WORKSPACE_NAME = 'Danny Schwartz 2';
const WEBHOOK_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook';

async function verify() {
  const results = [];

  // 1. Check client_registry
  const { data: reg } = await supabase
    .from('client_registry')
    .select('*')
    .eq('workspace_name', WORKSPACE_NAME)
    .single();

  // Check 1: Bison Workspace Linked
  const wsLinked = reg?.bison_workspace_id === WORKSPACE_ID;
  results.push({ label: 'Bison Workspace Linked', ok: wsLinked, detail: `id=${reg?.bison_workspace_id}` });

  // Check 2: API Key in DB
  const hasKey = !!reg?.bison_api_key;
  results.push({ label: 'API Key in DB', ok: hasKey, detail: hasKey ? `***${reg.bison_api_key.slice(-8)}` : 'MISSING' });

  // Check 3: Verify API key works against Bison
  let apiKeyWorks = false;
  if (hasKey) {
    try {
      const res = await fetch(`${BASE_URL}/sender-emails?per_page=5`, {
        headers: { 'Authorization': `Bearer ${reg.bison_api_key}`, 'Accept': 'application/json' }
      });
      apiKeyWorks = res.ok;
      const data = await res.json();
      const count = data?.data?.length ?? 0;
      results.push({ label: 'API Key Valid (Bison)', ok: apiKeyWorks, detail: apiKeyWorks ? `✅ responds OK, ${count} email accounts` : `❌ ${res.status}` });
    } catch(e) {
      results.push({ label: 'API Key Valid (Bison)', ok: false, detail: e.message });
    }
  }

  // Check 4: Webhooks in Bison - switch workspace first
  try {
    await fetch(`${BASE_URL}/workspaces/v1.1/switch-workspace`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MAVERICK_API_KEY}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: WORKSPACE_ID })
    });

    // Try to list automations/webhooks
    const whRes = await fetch(`${BASE_URL}/automations?per_page=100`, {
      headers: { 'Authorization': `Bearer ${MAVERICK_API_KEY}`, 'Accept': 'application/json' }
    });
    if (whRes.ok) {
      const whData = await whRes.json();
      const hooks = (whData.data || []).filter(a => a.url?.includes('universal-bison-webhook') || a.webhook_url?.includes('universal-bison-webhook'));
      const hasReplied = hooks.some(h => (h.events || []).includes('lead_replied') || h.event === 'lead_replied');
      const hasInterested = hooks.some(h => (h.events || []).includes('lead_interested') || h.event === 'lead_interested');
      results.push({ label: 'Webhook lead_replied (Bison)', ok: hasReplied, detail: hasReplied ? 'active' : 'NOT FOUND' });
      results.push({ label: 'Webhook lead_interested (Bison)', ok: hasInterested, detail: hasInterested ? 'active' : 'NOT FOUND' });
    } else {
      // Can't check via API - check DB flag
      const whEnabled = reg?.bison_webhook_enabled && (reg?.bison_webhook_events || []).includes('lead_replied');
      const whEnabled2 = reg?.bison_webhook_enabled && (reg?.bison_webhook_events || []).includes('lead_interested');
      results.push({ label: 'Webhook lead_replied (DB)', ok: whEnabled, detail: whEnabled ? 'configured' : 'not configured' });
      results.push({ label: 'Webhook lead_interested (DB)', ok: whEnabled2, detail: whEnabled2 ? 'configured' : 'not configured' });
    }
  } catch(e) {
    results.push({ label: 'Webhooks check', ok: false, detail: e.message });
  }

  // Check 5: Email accounts synced
  const { data: emailAccounts } = await supabase
    .from('sender_emails_cache')
    .select('email_address, status')
    .eq('workspace_name', WORKSPACE_NAME);
  const emailCount = emailAccounts?.length || 0;
  results.push({ label: 'Email Accounts Synced', ok: emailCount > 0, detail: emailCount > 0 ? `${emailCount} accounts` : 'none yet' });

  // Check 6: Slack
  const hasSlack = !!reg?.slack_webhook_url;
  results.push({ label: 'Slack Notifications', ok: hasSlack, detail: hasSlack ? 'webhook set' : 'NOT SET' });

  // Check 7: Live replies enabled
  results.push({ label: 'Live Replies Enabled', ok: !!reg?.live_replies_enabled, detail: reg?.live_replies_enabled ? 'yes' : 'no' });

  // Check 8: Recent webhook events received
  const { data: recentEvents } = await supabase
    .from('webhook_delivery_log')
    .select('event_type, created_at')
    .eq('workspace_name', WORKSPACE_NAME)
    .order('created_at', { ascending: false })
    .limit(5);
  const hasEvents = recentEvents?.length > 0;
  results.push({ label: 'Webhook Events Received', ok: hasEvents, detail: hasEvents ? `last: ${recentEvents[0].event_type} at ${recentEvents[0].created_at?.substring(0,16)}` : 'none yet (expected if no leads have replied)' });

  // Print results
  console.log('\n======================================');
  console.log(`  VERIFICATION: ${WORKSPACE_NAME}`);
  console.log('======================================');
  results.forEach(r => {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon} ${r.label.padEnd(35)} ${r.detail}`);
  });

  const allOk = results.every(r => r.ok);
  console.log('\n' + (allOk ? '✅ ALL CHECKS PASSED' : '⚠️  Some checks need attention (see above)'));
}

verify().catch(console.error);
