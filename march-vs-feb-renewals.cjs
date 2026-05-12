#!/usr/bin/env node

/**
 * March Renewals vs February Renewals — Performance Comparison
 * Scans all workspaces, finds March AND February renewal campaigns,
 * and does a detailed side-by-side comparison.
 */

const BISON_BASE_URL = 'https://send.maverickmarketingllc.com/api';
const BISON_API_KEY = '77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d';

async function bisonRequest(endpoint, options = {}) {
  const url = `${BISON_BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${BISON_API_KEY}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `API error: ${res.status} on ${endpoint}`);
  }
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

async function switchWorkspace(workspaceId) {
  await bisonRequest('/workspaces/v1.1/switch-workspace', {
    method: 'POST',
    body: JSON.stringify({ team_id: workspaceId }),
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function pct(num, den) { if (!den || den === 0) return 0; return (num / den) * 100; }
function fmt(n, d = 1) { return Number(n).toFixed(d); }
function arrow(val) { if (val > 0.5) return '▲'; if (val < -0.5) return '▼'; return '→'; }
function changeColor(val, higherIsBetter = true) {
  if (higherIsBetter) return val > 0.5 ? '(+' + fmt(val) + '%)' : val < -0.5 ? '(' + fmt(val) + '%)' : '(~same)';
  return val < -0.5 ? '(+' + fmt(Math.abs(val)) + '% better)' : val > 0.5 ? '(+' + fmt(val) + '% worse)' : '(~same)';
}

function isMarchRenewals(name) {
  const n = name.toLowerCase();
  return n.includes('march') && (n.includes('renew') || n.includes('renewal'));
}

function isFebRenewals(name) {
  const n = name.toLowerCase();
  return (n.includes('feb') || n.includes('february')) && (n.includes('renew') || n.includes('renewal'));
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║     MARCH RENEWALS vs FEBRUARY RENEWALS — PERFORMANCE COMPARISON    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');

  let workspaces;
  try {
    workspaces = await bisonRequest('/workspaces/v1.1');
    if (!Array.isArray(workspaces)) workspaces = [];
  } catch (e) {
    console.error('❌ Failed to fetch workspaces:', e.message);
    process.exit(1);
  }

  const skip = ['test client', 'test rob russell', 'thomas\'s team', 'thomas', 'maverick in-house', 'maverick inhouse'];
  const activeWorkspaces = workspaces.filter(w => !skip.includes(w.name.toLowerCase().trim()));

  console.log(`Scanning ${activeWorkspaces.length} workspaces...\n`);

  const results = []; // per-workspace comparison
  const globalMarch = { sent: 0, replied: 0, bounced: 0, unsub: 0, interested: 0, campaigns: 0 };
  const globalFeb   = { sent: 0, replied: 0, bounced: 0, unsub: 0, interested: 0, campaigns: 0 };

  for (const ws of activeWorkspaces) {
    process.stdout.write(`  ${ws.name.padEnd(35)}`);

    try {
      await switchWorkspace(ws.id);
      await sleep(250);

      let campaigns = [];
      try {
        const raw = await bisonRequest('/campaigns?per_page=500');
        if (Array.isArray(raw)) campaigns = raw;
        else if (raw && Array.isArray(raw.data)) campaigns = raw.data;
      } catch (e) { campaigns = []; }

      await sleep(200);

      const marchCampaigns = campaigns.filter(c => c.name && isMarchRenewals(c.name));
      const febCampaigns   = campaigns.filter(c => c.name && isFebRenewals(c.name));

      if (marchCampaigns.length === 0 && febCampaigns.length === 0) {
        console.log('no renewal campaigns found');
        continue;
      }

      // Aggregate march
      const march = { sent: 0, replied: 0, bounced: 0, unsub: 0, interested: 0, names: [] };
      for (const c of marchCampaigns) {
        march.sent      += c.emails_sent || 0;
        march.replied   += c.replied || 0;
        march.bounced   += c.bounced || 0;
        march.unsub     += c.unsubscribed || 0;
        march.interested+= c.interested || 0;
        march.names.push(c.name);
        globalMarch.sent      += c.emails_sent || 0;
        globalMarch.replied   += c.replied || 0;
        globalMarch.bounced   += c.bounced || 0;
        globalMarch.unsub     += c.unsubscribed || 0;
        globalMarch.interested+= c.interested || 0;
        globalMarch.campaigns++;
      }

      // Aggregate feb
      const feb = { sent: 0, replied: 0, bounced: 0, unsub: 0, interested: 0, names: [] };
      for (const c of febCampaigns) {
        feb.sent      += c.emails_sent || 0;
        feb.replied   += c.replied || 0;
        feb.bounced   += c.bounced || 0;
        feb.unsub     += c.unsubscribed || 0;
        feb.interested+= c.interested || 0;
        feb.names.push(c.name);
        globalFeb.sent      += c.emails_sent || 0;
        globalFeb.replied   += c.replied || 0;
        globalFeb.bounced   += c.bounced || 0;
        globalFeb.unsub     += c.unsubscribed || 0;
        globalFeb.interested+= c.interested || 0;
        globalFeb.campaigns++;
      }

      march.replyRate  = pct(march.replied, march.sent);
      march.bounceRate = pct(march.bounced, march.sent);
      march.unsubRate  = pct(march.unsub, march.sent);

      feb.replyRate  = pct(feb.replied, feb.sent);
      feb.bounceRate = pct(feb.bounced, feb.sent);
      feb.unsubRate  = pct(feb.unsub, feb.sent);

      results.push({ workspace: ws.name, march, feb });

      const hasBoth = march.sent > 0 && feb.sent > 0;
      const label = hasBoth
        ? `March: ${march.sent} sent / ${fmt(march.replyRate)}% reply | Feb: ${feb.sent} sent / ${fmt(feb.replyRate)}% reply`
        : marchCampaigns.length > 0
          ? `March only: ${march.sent} sent / ${fmt(march.replyRate)}% reply`
          : `Feb only: ${feb.sent} sent / ${fmt(feb.replyRate)}% reply`;

      console.log(label);

    } catch (e) {
      console.log(`❌ ${e.message}`);
    }

    await sleep(350);
  }

  // ── GLOBAL COMPARISON ────────────────────────────────────────────────────
  const gMarchReply  = pct(globalMarch.replied, globalMarch.sent);
  const gFebReply    = pct(globalFeb.replied, globalFeb.sent);
  const gMarchBounce = pct(globalMarch.bounced, globalMarch.sent);
  const gFebBounce   = pct(globalFeb.bounced, globalFeb.sent);
  const replyDelta   = gMarchReply - gFebReply;
  const bounceDelta  = gMarchBounce - gFebBounce;

  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                    GLOBAL ROLLUP COMPARISON                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('                          FEBRUARY          MARCH            CHANGE');
  console.log('  ' + '─'.repeat(68));
  console.log(`  Campaigns               ${String(globalFeb.campaigns).padEnd(17)}${String(globalMarch.campaigns).padEnd(17)}`);
  console.log(`  Emails Sent             ${String(globalFeb.sent.toLocaleString()).padEnd(17)}${String(globalMarch.sent.toLocaleString()).padEnd(17)}`);
  console.log(`  Replies                 ${String(globalFeb.replied.toLocaleString()).padEnd(17)}${String(globalMarch.replied.toLocaleString()).padEnd(17)}`);
  console.log(`  Bounced                 ${String(globalFeb.bounced.toLocaleString()).padEnd(17)}${String(globalMarch.bounced.toLocaleString()).padEnd(17)}`);
  console.log(`  Interested Leads        ${String(globalFeb.interested.toLocaleString()).padEnd(17)}${String(globalMarch.interested.toLocaleString()).padEnd(17)}`);
  console.log('  ' + '─'.repeat(68));
  console.log(`  Reply Rate              ${(fmt(gFebReply) + '%').padEnd(17)}${(fmt(gMarchReply) + '%').padEnd(17)}${arrow(replyDelta)} ${changeColor(replyDelta, true)}`);
  console.log(`  Bounce Rate             ${(fmt(gFebBounce) + '%').padEnd(17)}${(fmt(gMarchBounce) + '%').padEnd(17)}${arrow(-bounceDelta)} ${changeColor(bounceDelta, false)}`);
  console.log('');

  if (replyDelta < -1) {
    console.log(`  🚨 Reply rate dropped ${fmt(Math.abs(replyDelta))}% from Feb → March`);
  } else if (replyDelta < 0) {
    console.log(`  ⚠️  Reply rate slightly down ${fmt(Math.abs(replyDelta))}% from Feb → March`);
  } else {
    console.log(`  ✅ Reply rate improved ${fmt(replyDelta)}% from Feb → March`);
  }

  if (bounceDelta > 1) {
    console.log(`  🚨 Bounce rate worsened ${fmt(bounceDelta)}% from Feb → March`);
  } else if (bounceDelta > 0) {
    console.log(`  ⚠️  Bounce rate slightly worse ${fmt(bounceDelta)}% from Feb → March`);
  } else {
    console.log(`  ✅ Bounce rate improved ${fmt(Math.abs(bounceDelta))}% from Feb → March`);
  }

  // ── PER-WORKSPACE COMPARISON ─────────────────────────────────────────────
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║              PER-CLIENT MARCH vs FEB BREAKDOWN                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  // Sort: biggest reply rate drop first
  const withBoth = results.filter(r => r.march.sent > 0 && r.feb.sent > 0);
  const marchOnly = results.filter(r => r.march.sent > 0 && r.feb.sent === 0);
  const febOnly   = results.filter(r => r.march.sent === 0 && r.feb.sent > 0);

  withBoth.sort((a, b) => {
    const deltaA = a.march.replyRate - a.feb.replyRate;
    const deltaB = b.march.replyRate - b.feb.replyRate;
    return deltaA - deltaB; // worst drop first
  });

  if (withBoth.length > 0) {
    console.log('\n  ── Clients with BOTH Feb & March Renewals (sorted by reply rate change) ──\n');
    for (const r of withBoth) {
      const replyChg  = r.march.replyRate - r.feb.replyRate;
      const bounceChg = r.march.bounceRate - r.feb.bounceRate;
      const replyEmoji  = replyChg > 1 ? '📈' : replyChg < -1 ? '📉' : '➡️ ';
      const bounceEmoji = bounceChg > 1 ? '🔴' : bounceChg < -1 ? '🟢' : '🟡';

      console.log(`  ┌─ ${r.workspace}`);

      // Campaign names
      if (r.feb.names.length > 0)   console.log(`  │  Feb campaign(s):   ${r.feb.names.join(' | ')}`);
      if (r.march.names.length > 0) console.log(`  │  March campaign(s): ${r.march.names.join(' | ')}`);

      console.log(`  │`);
      console.log(`  │                    FEBRUARY          MARCH             CHANGE`);
      console.log(`  │  ${'─'.repeat(63)}`);
      console.log(`  │  Sent               ${String(r.feb.sent.toLocaleString()).padEnd(18)}${String(r.march.sent.toLocaleString()).padEnd(18)}`);
      console.log(`  │  Replies            ${String(r.feb.replied).padEnd(18)}${String(r.march.replied).padEnd(18)}`);
      console.log(`  │  Bounced            ${String(r.feb.bounced).padEnd(18)}${String(r.march.bounced).padEnd(18)}`);
      console.log(`  │  Interested         ${String(r.feb.interested).padEnd(18)}${String(r.march.interested).padEnd(18)}`);
      console.log(`  │  ${'─'.repeat(63)}`);
      console.log(`  │  Reply Rate  ${replyEmoji}   ${(fmt(r.feb.replyRate) + '%').padEnd(18)}${(fmt(r.march.replyRate) + '%').padEnd(18)}${replyChg >= 0 ? '+' : ''}${fmt(replyChg)}%`);
      console.log(`  │  Bounce Rate ${bounceEmoji}   ${(fmt(r.feb.bounceRate) + '%').padEnd(18)}${(fmt(r.march.bounceRate) + '%').padEnd(18)}${bounceChg >= 0 ? '+' : ''}${fmt(bounceChg)}%`);
      console.log(`  │  Unsub Rate         ${(fmt(r.feb.unsubRate) + '%').padEnd(18)}${(fmt(r.march.unsubRate) + '%').padEnd(18)}`);

      // Verdict
      if (replyChg < -2 || bounceChg > 2) {
        console.log(`  │  ⚠️  SIGNIFICANT PERFORMANCE DROP`);
        if (replyChg < -2) console.log(`  │     Reply rate fell ${fmt(Math.abs(replyChg))}% — investigate copy, targeting, or domain health`);
        if (bounceChg > 2) console.log(`  │     Bounce rate rose ${fmt(bounceChg)}% — domains may be degrading`);
      } else if (replyChg > 1) {
        console.log(`  │  ✅ Performance improved`);
      } else {
        console.log(`  │  ➡️  Performance roughly stable`);
      }

      console.log(`  └${'─'.repeat(67)}`);
      console.log('');
    }
  }

  if (marchOnly.length > 0) {
    console.log('\n  ── Clients with March Renewals ONLY (no Feb comparison available) ──\n');
    console.log('  ' + 'Workspace'.padEnd(30) + 'Campaign'.padEnd(40) + 'Sent'.padEnd(10) + 'Reply%'.padEnd(10) + 'Bounce%');
    console.log('  ' + '─'.repeat(95));
    for (const r of marchOnly) {
      const flag = r.march.replyRate >= 5 ? '🟢' : r.march.replyRate >= 2 ? '🟡' : '🔴';
      console.log(
        '  ' + flag + ' ' +
        r.workspace.slice(0, 28).padEnd(30) +
        r.march.names[0].slice(0, 38).padEnd(40) +
        String(r.march.sent).padEnd(10) +
        (fmt(r.march.replyRate) + '%').padEnd(10) +
        fmt(r.march.bounceRate) + '%'
      );
      if (r.march.names.length > 1) {
        r.march.names.slice(1).forEach(n => {
          console.log('  ' + ' '.repeat(31) + n.slice(0, 38));
        });
      }
    }
  }

  if (febOnly.length > 0) {
    console.log('\n\n  ── Clients with Feb Renewals ONLY (no March campaign found) ──\n');
    console.log('  ' + 'Workspace'.padEnd(30) + 'Campaign'.padEnd(40) + 'Sent'.padEnd(10) + 'Reply%'.padEnd(10) + 'Bounce%');
    console.log('  ' + '─'.repeat(95));
    for (const r of febOnly) {
      const flag = r.feb.replyRate >= 5 ? '🟢' : r.feb.replyRate >= 2 ? '🟡' : '🔴';
      console.log(
        '  ' + flag + ' ' +
        r.workspace.slice(0, 28).padEnd(30) +
        r.feb.names[0].slice(0, 38).padEnd(40) +
        String(r.feb.sent).padEnd(10) +
        (fmt(r.feb.replyRate) + '%').padEnd(10) +
        fmt(r.feb.bounceRate) + '%'
      );
    }
  }

  // ── PERFORMANCE DROP LEADERBOARD ─────────────────────────────────────────
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║              📉 PERFORMANCE DROP LEADERBOARD (Feb → March)          ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');

  if (withBoth.length === 0) {
    console.log('  Not enough data for comparison (need clients with both Feb & March campaigns).');
  } else {
    console.log('  ' + 'Workspace'.padEnd(30) + 'Feb Reply%'.padEnd(14) + 'March Reply%'.padEnd(14) + 'Change'.padEnd(12) + 'Feb Bounce%'.padEnd(14) + 'March Bounce%');
    console.log('  ' + '─'.repeat(90));

    for (const r of withBoth) {
      const replyChg  = r.march.replyRate - r.feb.replyRate;
      const bounceChg = r.march.bounceRate - r.feb.bounceRate;
      const replyFlag = replyChg < -2 ? '📉' : replyChg > 1 ? '📈' : '➡️ ';

      console.log(
        '  ' + replyFlag + ' ' +
        r.workspace.slice(0, 28).padEnd(30) +
        (fmt(r.feb.replyRate) + '%').padEnd(14) +
        (fmt(r.march.replyRate) + '%').padEnd(14) +
        ((replyChg >= 0 ? '+' : '') + fmt(replyChg) + '%').padEnd(12) +
        (fmt(r.feb.bounceRate) + '%').padEnd(14) +
        fmt(r.march.bounceRate) + '%'
      );
    }
  }

  // ── SUMMARY & RECOMMENDATIONS ─────────────────────────────────────────────
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║              📋 SUMMARY & KEY TAKEAWAYS                             ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  March Renewals:  ${globalMarch.campaigns} campaigns | ${globalMarch.sent.toLocaleString()} sent | ${globalMarch.replied} replies | ${fmt(gMarchReply)}% reply rate | ${fmt(gMarchBounce)}% bounce`);
  console.log(`  Feb Renewals:    ${globalFeb.campaigns} campaigns | ${globalFeb.sent.toLocaleString()} sent | ${globalFeb.replied} replies | ${fmt(gFebReply)}% reply rate | ${fmt(gFebBounce)}% bounce`);
  console.log('');

  const bigDroppers = withBoth.filter(r => (r.march.replyRate - r.feb.replyRate) < -1);
  const bigBounce   = withBoth.filter(r => (r.march.bounceRate - r.feb.bounceRate) > 1);
  const improved    = withBoth.filter(r => (r.march.replyRate - r.feb.replyRate) > 1);

  if (bigDroppers.length > 0) {
    console.log(`  📉 Clients with significant reply rate DROP in March:`);
    bigDroppers.forEach(r => {
      const delta = r.march.replyRate - r.feb.replyRate;
      console.log(`     • ${r.workspace}: ${fmt(r.feb.replyRate)}% → ${fmt(r.march.replyRate)}% (${fmt(delta)}%)`);
    });
    console.log('');
  }

  if (bigBounce.length > 0) {
    console.log(`  🔴 Clients with bounce rate INCREASE in March:`);
    bigBounce.forEach(r => {
      const delta = r.march.bounceRate - r.feb.bounceRate;
      console.log(`     • ${r.workspace}: ${fmt(r.feb.bounceRate)}% → ${fmt(r.march.bounceRate)}% (+${fmt(delta)}%)`);
    });
    console.log('');
  }

  if (improved.length > 0) {
    console.log(`  ✅ Clients that IMPROVED in March:`);
    improved.forEach(r => {
      const delta = r.march.replyRate - r.feb.replyRate;
      console.log(`     • ${r.workspace}: ${fmt(r.feb.replyRate)}% → ${fmt(r.march.replyRate)}% (+${fmt(delta)}%)`);
    });
    console.log('');
  }

  console.log('═'.repeat(72));
  console.log('Scan complete.\n');
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
