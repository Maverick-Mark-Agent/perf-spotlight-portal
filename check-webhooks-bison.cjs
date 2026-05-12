#!/usr/bin/env node
const BISON_BASE = 'https://send.maverickmarketingllc.com/api';
const BISON_KEY  = '77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d';
const TARGET_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook';

async function bisonReq(endpoint, options) {
  options = options || {};
  const res = await fetch(BISON_BASE + endpoint, {
    method: options.method || 'GET',
    headers: {
      'Authorization': 'Bearer ' + BISON_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: options.body || undefined,
  });
  const json = await res.json();
  return { status: res.status, data: json.data !== undefined ? json.data : json };
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function main() {
  var clients = [
    { name: 'Anna Luna Agency',   id: 61 },
    { name: 'Mark Mercer Agency', id: 60 },
  ];

  console.log('\n=== WEBHOOK CHECK: Anna Luna & Mark Mercer ===\n');

  for (var i = 0; i < clients.length; i++) {
    var c = clients[i];
    console.log('── ' + c.name + ' (Bison workspace ID: ' + c.id + ')');

    // Switch workspace
    await bisonReq('/workspaces/v1.1/switch-workspace', {
      method: 'POST',
      body: JSON.stringify({ team_id: c.id }),
    });
    await sleep(500);

    // Try common webhook endpoints
    var endpoints = ['/webhooks', '/webhook', '/settings/webhooks', '/integrations/webhooks'];
    var found = false;

    for (var j = 0; j < endpoints.length; j++) {
      var ep = endpoints[j];
      var result = await bisonReq(ep);

      if (result.status === 200) {
        var list = Array.isArray(result.data) ? result.data
                 : Array.isArray(result.data && result.data.data) ? result.data.data
                 : result.data ? [result.data] : [];

        if (list.length === 0) {
          console.log('  ' + ep + ' -> 200 but empty list');
          console.log('  RAW: ' + JSON.stringify(result.data).slice(0, 200));
        } else {
          found = true;
          console.log('  Found ' + list.length + ' webhook(s) via ' + ep + ':');
          list.forEach(function(wh, idx) {
            var url     = wh.url || wh.webhook_url || wh.endpoint || '(no url field)';
            var active  = wh.active !== undefined ? wh.active : wh.enabled !== undefined ? wh.enabled : '?';
            var events  = wh.events || wh.event_types || wh.triggers || [];
            var isOurs  = url.includes('universal-bison-webhook') || url.includes('supabase');

            console.log('  [' + (idx+1) + '] ' + (isOurs ? '✅' : '⚠️ ') + ' URL: ' + url);
            console.log('      Active:  ' + active);
            console.log('      Events:  ' + JSON.stringify(events));
          });
        }
        break;
      } else if (result.status !== 404) {
        console.log('  ' + ep + ' -> ' + result.status + ': ' + JSON.stringify(result.data).slice(0, 100));
      }
    }

    if (!found) {
      console.log('  ❌ Could not find webhook list via any known endpoint');
      console.log('     This likely means webhooks are not registerable via API in this Bison version.');
      console.log('     Check the Bison dashboard manually at: send.maverickmarketingllc.com');
    }

    // Also check the last webhook received timestamp from our DB via Bison workspace stats
    console.log('  Checking workspace settings...');
    var wsResult = await bisonReq('/workspaces/v1.1/' + c.id);
    if (wsResult.status === 200) {
      var ws = wsResult.data;
      console.log('  Workspace name in Bison: ' + (ws.name || '?'));
      // Look for any webhook-related fields
      var keys = Object.keys(ws);
      var webhookKeys = keys.filter(function(k) { return k.toLowerCase().includes('webhook') || k.toLowerCase().includes('hook'); });
      if (webhookKeys.length > 0) {
        webhookKeys.forEach(function(k) { console.log('  ' + k + ': ' + JSON.stringify(ws[k])); });
      } else {
        console.log('  No webhook fields in workspace object');
        console.log('  All fields: ' + keys.join(', '));
      }
    }

    console.log('');
    await sleep(400);
  }

  console.log('=== DONE ===\n');
}

main().catch(function(e) { console.error('Error:', e.message); });
