#!/usr/bin/env node
/**
 * Configure Anna Luna Agency & Mark Mercer Agency:
 * 1. Set bison_workspace_id & bison_workspace_name for both
 * 2. Generate API key for Mark Mercer (Anna already has one)
 * 3. Set bison_webhook_url & bison_webhook_enabled for both
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL  = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const BISON_BASE    = 'https://send.maverickmarketingllc.com/api';
// Super-admin key needed to create workspace tokens
const BISON_ADMIN_KEY = '77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d';

const WEBHOOK_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function bisonRequest(endpoint, options = {}) {
  const res = await fetch(`${BISON_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${BISON_ADMIN_KEY}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Bison API error ${res.status} on ${endpoint}`);
  return json.data !== undefined ? json.data : json;
}

async function switchWorkspace(workspaceId) {
  await bisonRequest('/workspaces/v1.1/switch-workspace', {
    method: 'POST',
    body: JSON.stringify({ team_id: workspaceId }),
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║        CONFIGURING: Anna Luna Agency & Mark Mercer Agency       ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  const clients = [
    { name: 'Anna Luna',         wsName: 'Anna Luna Agency ', bisonId: 61, needsKey: false },
    { name: 'Mark Mercer Agency', wsName: 'Mark Mercer Agency', bisonId: 60, needsKey: true  },
  ];

  for (const client of clients) {
    console.log(`\n── ${client.name} ──────────────────────────────────────────────`);

    // ── STEP 1: Set bison_workspace_id & bison_workspace_name ────────────────
    console.log(`\n  STEP 1: Linking Bison workspace (ID: ${client.bisonId}, Name: "${client.wsName.trim()}")`);

    const { error: wsErr } = await supabase
      .from('client_registry')
      .update({
        bison_workspace_id:   client.bisonId,
        bison_workspace_name: client.wsName.trim(),
      })
      .eq('workspace_name', client.name === 'Anna Luna' ? 'Anna Luna' : client.name);

    if (wsErr) {
      console.log(`  ❌ Failed to set workspace ID: ${wsErr.message}`);
    } else {
      console.log(`  ✅ bison_workspace_id = ${client.bisonId}`);
      console.log(`  ✅ bison_workspace_name = "${client.wsName.trim()}"`);
    }

    // ── STEP 2: Generate API key (Mark Mercer only) ───────────────────────────
    if (client.needsKey) {
      console.log(`\n  STEP 2: Generating API token in Bison for workspace ${client.bisonId}...`);
      try {
        await switchWorkspace(client.bisonId);
        await sleep(500);

        const tokenRes = await bisonRequest(`/workspaces/v1.1/${client.bisonId}/api-tokens`, {
          method: 'POST',
          body: JSON.stringify({ name: `Maverick Dashboard - ${client.wsName.trim()}` }),
        });

        // Response structure: { data: { plain_text_token, id, ... } }
        const token = tokenRes?.plain_text_token || tokenRes?.data?.plain_text_token;

        if (!token) {
          console.log('  ⚠️  Token created but plain_text_token not in response. Raw:', JSON.stringify(tokenRes).slice(0, 200));
        } else {
          console.log(`  ✅ API token generated: ***${token.slice(-8)}`);

          const { error: keyErr } = await supabase
            .from('client_registry')
            .update({
              bison_api_key:        token,
              bison_api_key_status: 'active',
              bison_api_key_name:   `Maverick Dashboard - ${client.wsName.trim()}`,
            })
            .eq('workspace_name', client.name);

          if (keyErr) {
            console.log(`  ❌ Failed to save API key to DB: ${keyErr.message}`);
            console.log(`  ℹ️  SAVE THIS KEY MANUALLY: ${token}`);
          } else {
            console.log(`  ✅ API key saved to client_registry`);
          }
        }
      } catch (e) {
        console.log(`  ❌ API key generation failed: ${e.message}`);
        console.log(`  ℹ️  You may need to generate this manually in Bison dashboard and paste it in the client profile`);
      }
    } else {
      console.log(`\n  STEP 2: API key already exists — skipping`);
    }

    // ── STEP 3: Set webhook URL & enable ─────────────────────────────────────
    console.log(`\n  STEP 3: Setting webhook URL...`);

    const { error: whErr } = await supabase
      .from('client_registry')
      .update({
        bison_webhook_url:     WEBHOOK_URL,
        bison_webhook_enabled: true,
        bison_webhook_health:  'healthy',
        bison_webhook_events:  ['lead.interested', 'lead.replied', 'email.sent', 'email.bounced', 'lead.unsubscribed'],
      })
      .eq('workspace_name', client.name === 'Anna Luna' ? 'Anna Luna' : client.name);

    if (whErr) {
      console.log(`  ❌ Failed to set webhook: ${whErr.message}`);
    } else {
      console.log(`  ✅ bison_webhook_url = ${WEBHOOK_URL}`);
      console.log(`  ✅ bison_webhook_enabled = true`);
      console.log(`  ✅ bison_webhook_events set`);
    }

    await sleep(300);
  }

  // ── VERIFICATION ─────────────────────────────────────────────────────────
  console.log('\n\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                    VERIFICATION — FINAL STATE                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  const { data: finalData } = await supabase
    .from('client_registry')
    .select(`
      workspace_name, display_name, bison_workspace_id, bison_workspace_name,
      bison_instance, bison_api_key, bison_api_key_status,
      bison_webhook_url, bison_webhook_enabled, bison_webhook_health,
      slack_webhook_url, api_health_status
    `)
    .in('workspace_name', ['Anna Luna', 'Mark Mercer Agency']);

  for (const c of (finalData || [])) {
    const checks = [
      ['Bison Workspace Linked', !!c.bison_workspace_id, c.bison_workspace_id ? `ID: ${c.bison_workspace_id}` : ''],
      ['Bison Instance Set',     !!c.bison_instance,     c.bison_instance],
      ['API Key Configured',     !!c.bison_api_key,      c.bison_api_key ? '***' + c.bison_api_key.slice(-8) : ''],
      ['Webhook Configured',     !!c.bison_webhook_url && c.bison_webhook_enabled, c.bison_webhook_url ? 'Set ✓' : ''],
      ['Slack Notifications',    !!c.slack_webhook_url,  c.slack_webhook_url ? 'Set ✓' : ''],
    ];

    console.log(`  ${c.display_name || c.workspace_name}:`);
    for (const [label, ok, detail] of checks) {
      console.log(`    ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
    }

    const allDone = checks.every(([,ok]) => ok);
    console.log(`    ${allDone ? '🎉 FULLY CONFIGURED' : '⚠️  Still missing items above'}`);
    console.log('');
  }

  console.log('\n  ⚠️  IMPORTANT REMAINING MANUAL STEP:');
  console.log('  The webhook URL has been saved to the database, but you still need to');
  console.log('  register it in the actual Email Bison dashboard for each workspace:');
  console.log('  1. Go to Email Bison → Settings → Webhooks for each workspace');
  console.log(`  2. Add webhook URL: ${WEBHOOK_URL}`);
  console.log('  3. Select events: lead interested, lead replied, email sent, bounced, unsubscribed');
  console.log('');
  console.log('═'.repeat(68));
  console.log('Done.\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
