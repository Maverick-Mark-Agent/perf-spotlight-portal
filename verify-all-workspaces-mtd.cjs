const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

const CLIENTS = [
  { wsName: 'Tactical Hr',                  bisonId: 62 },
  { wsName: 'Jason Park Kansas',            bisonId: 65 },
  { wsName: 'Jason Park Oklahoma',          bisonId: 63 },
  { wsName: 'Jason Park Missouri',          bisonId: 64 },
  { wsName: 'Stratlend Mortgage Advisors',  bisonId: 66 },
  { wsName: 'Heidi Rowan Agency',           bisonId: 70 },
  { wsName: 'Frank Delemos Agency',         bisonId: 69 },
  { wsName: 'Brian Weatherman Agency',      bisonId: 71 },
  { wsName: 'Eric Jeglum Agency',           bisonId: 72 },
  { wsName: 'Gregg 2',                      bisonId: 68 },
  { wsName: 'Curtis Ostler Agency',         bisonId: 67 },
  { wsName: 'Danny Schwartz 2',             bisonId: 73 },
];

const BASE_URL = 'https://send.maverickmarketingllc.com/api';
const MAVERICK_API_KEY = '101|6mXfEtJkLDF99HcmvOqlJcjlYaDyt9pGt9c6C7qJ56e6298b';
const WEBHOOK_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook';

async function verify() {
  const names = CLIENTS.map(c => c.wsName);

  // Pull all registry rows
  const { data: regs } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_api_key, bison_webhook_enabled, bison_webhook_events, bison_webhook_health, slack_webhook_url, live_replies_enabled')
    .in('workspace_name', names);

  // Pull email account counts
  const { data: emails } = await supabase
    .from('sender_emails_cache')
    .select('workspace_name')
    .in('workspace_name', names);

  const emailCounts = {};
  (emails || []).forEach(e => emailCounts[e.workspace_name] = (emailCounts[e.workspace_name] || 0) + 1);

  // Pull recent webhook events (last 7 days) per workspace
  const { data: webhookEvents } = await supabase
    .from('webhook_delivery_log')
    .select('workspace_name, event_type, created_at')
    .in('workspace_name', names)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  const recentEvents = {};
  (webhookEvents || []).forEach(e => {
    if (!recentEvents[e.workspace_name]) recentEvents[e.workspace_name] = e;
  });

  // Verify each API key works against Bison
  const apiKeyStatus = {};
  for (const client of CLIENTS) {
    const reg = (regs || []).find(r => r.workspace_name === client.wsName);
    if (!reg?.bison_api_key) { apiKeyStatus[client.wsName] = '❌ no key'; continue; }
    try {
      // Switch workspace then test key
      await fetch(`${BASE_URL}/workspaces/v1.1/switch-workspace`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${MAVERICK_API_KEY}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: client.bisonId })
      });
      const res = await fetch(`${BASE_URL}/sender-emails?per_page=1`, {
        headers: { 'Authorization': `Bearer ${reg.bison_api_key}`, 'Accept': 'application/json' }
      });
      apiKeyStatus[client.wsName] = res.ok ? '✅' : `❌ ${res.status}`;
    } catch(e) {
      apiKeyStatus[client.wsName] = `❌ ${e.message.slice(0,20)}`;
    }
  }

  // Print results
  console.log('\n' + '='.repeat(105));
  console.log('  FULL VERIFICATION — ALL NEW WORKSPACES');
  console.log('='.repeat(105));
  console.log('Workspace'.padEnd(33) + 'WS_ID'.padEnd(7) + 'API_KEY'.padEnd(10) + 'WEBHOOKS'.padEnd(12) + 'EMAILS'.padEnd(8) + 'SLACK'.padEnd(7) + 'LIVE_RPL'.padEnd(10) + 'EVENTS_7D');
  console.log('-'.repeat(105));

  for (const client of CLIENTS) {
    const reg = (regs || []).find(r => r.workspace_name === client.wsName);
    if (!reg) { console.log(`${client.wsName.padEnd(33)} NOT IN DATABASE`); continue; }

    const wsId   = reg.bison_workspace_id === client.bisonId ? '✅' : '❌';
    const apiKey = apiKeyStatus[client.wsName] || '❌';
    const events = Array.isArray(reg.bison_webhook_events) ? reg.bison_webhook_events : [];
    const hasR   = events.includes('lead_replied');
    const hasI   = events.includes('lead_interested');
    const hooks  = reg.bison_webhook_enabled && hasR && hasI ? '✅' : `❌${!hasR?' -replied':''}${!hasI?' -interested':''}`;
    const emailC = (emailCounts[client.wsName] || 0);
    const emailS = emailC > 0 ? `✅ ${emailC}` : '❌ 0';
    const slack  = reg.slack_webhook_url ? '✅' : '❌';
    const liveR  = reg.live_replies_enabled ? '✅' : '❌';
    const ev     = recentEvents[client.wsName] 
      ? `✅ ${recentEvents[client.wsName].event_type} ${recentEvents[client.wsName].created_at?.substring(5,16)}`
      : '⏳ none yet';

    console.log(`${client.wsName.padEnd(33)}${wsId.padEnd(7)}${apiKey.padEnd(10)}${hooks.padEnd(12)}${emailS.padEnd(8)}${slack.padEnd(7)}${liveR.padEnd(10)}${ev}`);
  }

  console.log('\nLegend: WS_ID=Bison workspace linked | API_KEY=valid & working | WEBHOOKS=lead_replied+lead_interested | EMAILS=sender accounts synced | EVENTS_7D=recent webhook received');
}

verify().catch(console.error);
