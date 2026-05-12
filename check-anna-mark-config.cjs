#!/usr/bin/env node
/**
 * Check current config for Anna Luna Agency & Mark Mercer Agency
 * vs a fully-configured reference client, then pull Bison workspace IDs.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL  = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const BISON_BASE    = 'https://send.maverickmarketingllc.com/api';
const BISON_API_KEY = '77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function bisonGet(endpoint) {
  const res = await fetch(`${BISON_BASE}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${BISON_API_KEY}`, 'Accept': 'application/json' }
  });
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

function printField(label, value) {
  const display = (value === null || value === undefined || value === '')
    ? '❌ NOT SET'
    : `✅ ${value}`;
  console.log(`    ${label.padEnd(32)} ${display}`);
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║   CLIENT CONFIG CHECK: Anna Luna Agency & Mark Mercer Agency    ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // ── 1. Fetch ALL clients from Supabase ────────────────────────────────────
  const { data: allClients, error } = await supabase
    .from('client_registry')
    .select(`
      workspace_name, display_name, is_active, client_type, bison_instance,
      bison_workspace_id, bison_workspace_name,
      bison_api_key, bison_api_key_status,
      bison_webhook_url, bison_webhook_enabled, bison_webhook_health,
      slack_webhook_url, api_health_status
    `)
    .order('display_name');

  if (error) { console.error('❌ Supabase error:', error.message); process.exit(1); }

  console.log(`✅ Fetched ${allClients.length} clients from client_registry\n`);

  const annaLuna   = allClients.find(c => c.workspace_name?.toLowerCase().includes('anna luna') || c.display_name?.toLowerCase().includes('anna luna'));
  const markMercer = allClients.find(c => c.workspace_name?.toLowerCase().includes('mark mercer') || c.display_name?.toLowerCase().includes('mark mercer'));

  // Find a fully-configured reference client
  const reference = allClients.find(c =>
    c.bison_workspace_id && c.bison_api_key && c.bison_webhook_url && c.slack_webhook_url
  );

  // ── 2. Print reference ────────────────────────────────────────────────────
  if (reference) {
    console.log(`📋 REFERENCE — fully configured client: "${reference.display_name || reference.workspace_name}"`);
    console.log('  ' + '─'.repeat(58));
    printField('bison_workspace_id',    reference.bison_workspace_id);
    printField('bison_workspace_name',  reference.bison_workspace_name);
    printField('bison_instance',        reference.bison_instance);
    printField('bison_api_key',         reference.bison_api_key ? '***' + reference.bison_api_key.slice(-8) : null);
    printField('bison_api_key_status',  reference.bison_api_key_status);
    printField('bison_webhook_url',     reference.bison_webhook_url ? reference.bison_webhook_url.slice(0, 55) : null);
    printField('bison_webhook_enabled', String(reference.bison_webhook_enabled));
    printField('bison_webhook_health',  reference.bison_webhook_health);
    printField('slack_webhook_url',     reference.slack_webhook_url ? reference.slack_webhook_url.slice(0, 55) + '...' : null);
    printField('api_health_status',     reference.api_health_status);
  }

  // ── 3. Print each target client ───────────────────────────────────────────
  for (const [title, client] of [
    ['ANNA LUNA AGENCY',   annaLuna],
    ['MARK MERCER AGENCY', markMercer],
  ]) {
    console.log(`\n\n🔍 ${title}`);
    console.log('  ' + '─'.repeat(58));

    if (!client) {
      console.log('  ❌ NOT FOUND in client_registry');
      continue;
    }

    printField('workspace_name',        client.workspace_name);
    printField('display_name',          client.display_name);
    printField('is_active',             String(client.is_active));
    printField('client_type',           client.client_type);
    console.log('');
    printField('bison_workspace_id',    client.bison_workspace_id);
    printField('bison_workspace_name',  client.bison_workspace_name);
    printField('bison_instance',        client.bison_instance);
    printField('bison_api_key',         client.bison_api_key ? '***' + client.bison_api_key.slice(-8) : null);
    printField('bison_api_key_status',  client.bison_api_key_status);
    console.log('');
    printField('bison_webhook_url',     client.bison_webhook_url);
    printField('bison_webhook_enabled', client.bison_webhook_enabled != null ? String(client.bison_webhook_enabled) : null);
    printField('bison_webhook_health',  client.bison_webhook_health);
    console.log('');
    printField('slack_webhook_url',     client.slack_webhook_url ? client.slack_webhook_url.slice(0,55) + '...' : null);
    printField('api_health_status',     client.api_health_status);
  }

  // ── 4. Fetch Bison workspaces for their IDs ───────────────────────────────
  console.log('\n\n📡 Fetching Email Bison workspace list...\n');
  let annaWs = null, markWs = null;
  try {
    const workspaces = await bisonGet('/workspaces/v1.1');
    const wsList = Array.isArray(workspaces) ? workspaces : workspaces?.data || [];

    annaWs  = wsList.find(w => w.name?.toLowerCase().includes('anna luna'));
    markWs  = wsList.find(w => w.name?.toLowerCase().includes('mark mercer'));

    if (annaWs)  console.log(`  ✅ Found in Bison: "${annaWs.name}" → ID: ${annaWs.id}`);
    else         console.log('  ❌ Anna Luna Agency not found in Bison workspace list');
    if (markWs)  console.log(`  ✅ Found in Bison: "${markWs.name}" → ID: ${markWs.id}`);
    else         console.log('  ❌ Mark Mercer Agency not found in Bison workspace list');

  } catch (e) {
    console.log('  ❌ Bison error:', e.message);
  }

  // ── 5. Setup Gap Analysis ─────────────────────────────────────────────────
  console.log('\n\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                   SETUP GAP ANALYSIS & ACTION PLAN              ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  for (const [name, dbClient, bisonWs] of [
    ['Anna Luna Agency',   annaLuna,   annaWs],
    ['Mark Mercer Agency', markMercer, markWs],
  ]) {
    console.log(`  ${name}:`);
    console.log(`  ${'─'.repeat(60)}`);

    const checks = [
      {
        label: '1. Bison Workspace Linked',
        ok: !!dbClient?.bison_workspace_id,
        current: dbClient?.bison_workspace_id,
        fix: bisonWs
          ? `Set bison_workspace_id = ${bisonWs.id}, bison_workspace_name = "${bisonWs.name}"`
          : 'Not found in Bison — check if workspace name matches exactly',
      },
      {
        label: '2. Bison Instance Set',
        ok: !!dbClient?.bison_instance,
        current: dbClient?.bison_instance,
        fix: 'Set bison_instance = "Maverick" (confirmed on Maverick instance)',
      },
      {
        label: '3. API Key Configured',
        ok: !!dbClient?.bison_api_key,
        current: dbClient?.bison_api_key ? '***' + dbClient.bison_api_key.slice(-8) : null,
        fix: bisonWs
          ? `Call Bison API: POST /workspaces/v1.1/${bisonWs.id}/api-tokens  → save result to bison_api_key`
          : 'First link Bison workspace, then generate API token',
      },
      {
        label: '4. Webhook Configured',
        ok: !!dbClient?.bison_webhook_url && dbClient?.bison_webhook_enabled === true,
        current: dbClient?.bison_webhook_url,
        fix: reference?.bison_webhook_url
          ? `Use same webhook base URL as reference client, configure in Bison dashboard for workspace ${bisonWs?.id}`
          : 'Set up webhook in Bison dashboard pointing to universal-bison-webhook edge function',
      },
      {
        label: '5. Slack Notifications',
        ok: !!dbClient?.slack_webhook_url,
        current: dbClient?.slack_webhook_url,
        fix: 'Create a Slack incoming webhook for this client\'s channel, paste URL into client profile',
      },
    ];

    for (const c of checks) {
      const icon = c.ok ? '✅' : '❌';
      console.log(`  ${icon} ${c.label}${c.current ? ` (current: ${c.current})` : ''}`);
      if (!c.ok) console.log(`       ACTION: ${c.fix}`);
    }
    console.log('');
  }

  // Print the webhook URL from reference so we know what to replicate
  if (reference?.bison_webhook_url) {
    console.log(`  📎 Reference webhook URL pattern: ${reference.bison_webhook_url}`);
  }

  console.log('\n' + '═'.repeat(68));
  console.log('Done.\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
