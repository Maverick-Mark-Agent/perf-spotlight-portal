#!/usr/bin/env node

/**
 * Full Infrastructure Scan
 * Scans all workspaces, all email accounts, all campaigns
 * and produces a detailed performance report.
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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function pct(num, den) {
  if (!den || den === 0) return 0;
  return ((num / den) * 100);
}

function fmt(n, decimals = 1) {
  return Number(n).toFixed(decimals);
}

function bar(pct, width = 20) {
  const filled = Math.round((pct / 100) * width);
  return '[' + '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, width - filled)) + ']';
}

function healthLabel(score) {
  if (score >= 80) return '🟢 Healthy';
  if (score >= 60) return '🟡 Moderate';
  if (score >= 40) return '🟠 At Risk';
  return '🔴 Critical';
}

function accountHealthScore(acc) {
  // Weighted scoring:
  // Reply rate: 0-5% = 0pts, 5-10% = 20pts, 10-20% = 40pts, 20%+ = 50pts
  // Bounce rate: 0-2% = 30pts, 2-5% = 20pts, 5-10% = 10pts, 10%+ = 0pts
  // Unsub rate:  0-1% = 20pts, 1-3% = 10pts, 3%+ = 0pts
  const sent = acc.emails_sent_count || 0;
  if (sent < 10) return null; // not enough data

  const replyRate = pct(acc.unique_replied_count || 0, sent);
  const bounceRate = pct(acc.bounced_count || 0, sent);
  const unsubRate = pct(acc.unsubscribed_count || 0, sent);

  let score = 0;

  // Reply rate score (max 50)
  if (replyRate >= 20) score += 50;
  else if (replyRate >= 10) score += 40;
  else if (replyRate >= 5) score += 20;
  else score += 0;

  // Bounce rate score (max 30)
  if (bounceRate <= 2) score += 30;
  else if (bounceRate <= 5) score += 20;
  else if (bounceRate <= 10) score += 10;
  else score += 0;

  // Unsub rate score (max 20)
  if (unsubRate <= 1) score += 20;
  else if (unsubRate <= 3) score += 10;
  else score += 0;

  return score;
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║         FULL INFRASTRUCTURE SCAN — ALL WORKSPACES                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');

  // 1. Fetch all workspaces
  let workspaces;
  try {
    workspaces = await bisonRequest('/workspaces/v1.1');
    if (!Array.isArray(workspaces)) workspaces = [];
  } catch (e) {
    console.error('❌ Failed to fetch workspaces:', e.message);
    process.exit(1);
  }

  // Filter out obvious test/internal workspaces
  const skip = ['test client', 'test rob russell', 'thomas\'s team', 'thomas', 'maverick in-house', 'maverick inhouse'];
  const activeWorkspaces = workspaces.filter(w => !skip.includes(w.name.toLowerCase().trim()));

  console.log(`📡 Found ${workspaces.length} total workspaces. Scanning ${activeWorkspaces.length} (excluding internal/test)...\n`);

  const globalStats = {
    totalAccounts: 0,
    activeAccounts: 0,
    disconnectedAccounts: 0,
    pausedAccounts: 0,
    totalSent: 0,
    totalReplied: 0,
    totalBounced: 0,
    totalUnsub: 0,
    totalOpened: 0,
    totalInterested: 0,
    criticalAccounts: [],   // health < 40
    atRiskAccounts: [],     // health 40-59
    topAccounts: [],        // health >= 80
    workspaceReports: [],
  };

  // 2. Scan each workspace
  for (const ws of activeWorkspaces) {
    process.stdout.write(`  Scanning: ${ws.name.padEnd(35)}`);

    try {
      await switchWorkspace(ws.id);
      await sleep(250);

      // Fetch sender emails (accounts)
      let accounts = [];
      try {
        const rawAccounts = await bisonRequest('/sender-emails?per_page=500');
        if (Array.isArray(rawAccounts)) accounts = rawAccounts;
        else if (rawAccounts && Array.isArray(rawAccounts.data)) accounts = rawAccounts.data;
      } catch (e) {
        accounts = [];
      }

      // Fetch campaigns
      let campaigns = [];
      try {
        const rawCampaigns = await bisonRequest('/campaigns?per_page=500');
        if (Array.isArray(rawCampaigns)) campaigns = rawCampaigns;
        else if (rawCampaigns && Array.isArray(rawCampaigns.data)) campaigns = rawCampaigns.data;
      } catch (e) {
        campaigns = [];
      }

      await sleep(300);

      // Compute workspace-level stats
      const wsStats = {
        name: ws.name,
        id: ws.id,
        totalAccounts: accounts.length,
        activeAccounts: accounts.filter(a => a.status === 'connected' || a.status === 'active').length,
        disconnectedAccounts: accounts.filter(a => a.status === 'disconnected' || a.status === 'error').length,
        pausedAccounts: accounts.filter(a => a.status === 'paused').length,
        totalSent: 0,
        totalReplied: 0,
        totalBounced: 0,
        totalUnsub: 0,
        totalOpened: 0,
        totalInterested: 0,
        totalCampaigns: campaigns.length,
        activeCampaigns: campaigns.filter(c => c.status === 'active' || c.status === 'running').length,
        accounts: [],
        campaigns: [],
        healthScore: 0,
      };

      // Per-account stats
      for (const acc of accounts) {
        const sent = acc.emails_sent_count || 0;
        const replied = acc.unique_replied_count || acc.total_replied_count || 0;
        const bounced = acc.bounced_count || 0;
        const unsub = acc.unsubscribed_count || 0;
        const opened = acc.unique_opened_count || acc.total_opened_count || 0;
        const interested = acc.interested_leads_count || 0;

        wsStats.totalSent += sent;
        wsStats.totalReplied += replied;
        wsStats.totalBounced += bounced;
        wsStats.totalUnsub += unsub;
        wsStats.totalOpened += opened;
        wsStats.totalInterested += interested;

        globalStats.totalSent += sent;
        globalStats.totalReplied += replied;
        globalStats.totalBounced += bounced;
        globalStats.totalUnsub += unsub;
        globalStats.totalOpened += opened;
        globalStats.totalInterested += interested;

        const score = accountHealthScore(acc);
        const replyRate = pct(replied, sent);
        const bounceRate = pct(bounced, sent);
        const unsubRate = pct(unsub, sent);

        wsStats.accounts.push({
          id: acc.id,
          email: acc.email,
          name: acc.name,
          status: acc.status,
          sent,
          replied,
          bounced,
          unsub,
          opened,
          interested,
          replyRate,
          bounceRate,
          unsubRate,
          healthScore: score,
          workspace: ws.name,
        });

        if (score !== null) {
          if (score < 40) globalStats.criticalAccounts.push({ email: acc.email, workspace: ws.name, score, replyRate, bounceRate, sent });
          else if (score < 60) globalStats.atRiskAccounts.push({ email: acc.email, workspace: ws.name, score, replyRate, bounceRate, sent });
          else if (score >= 80) globalStats.topAccounts.push({ email: acc.email, workspace: ws.name, score, replyRate, sent });
        }
      }

      // Workspace reply rate
      wsStats.replyRate = pct(wsStats.totalReplied, wsStats.totalSent);
      wsStats.bounceRate = pct(wsStats.totalBounced, wsStats.totalSent);
      wsStats.unsubRate = pct(wsStats.totalUnsub, wsStats.totalSent);
      wsStats.openRate = pct(wsStats.totalOpened, wsStats.totalSent);

      // Workspace health: weighted average of account scores
      const scoredAccounts = wsStats.accounts.filter(a => a.healthScore !== null);
      wsStats.healthScore = scoredAccounts.length > 0
        ? scoredAccounts.reduce((sum, a) => sum + a.healthScore, 0) / scoredAccounts.length
        : 0;

      globalStats.totalAccounts += wsStats.totalAccounts;
      globalStats.activeAccounts += wsStats.activeAccounts;
      globalStats.disconnectedAccounts += wsStats.disconnectedAccounts;
      globalStats.pausedAccounts += wsStats.pausedAccounts;

      // Campaign stats
      for (const c of campaigns) {
        wsStats.campaigns.push({
          name: c.name,
          status: c.status,
          sent: c.emails_sent || 0,
          replied: c.replied || 0,
          bounced: c.bounced || 0,
          unsub: c.unsubscribed || 0,
          interested: c.interested || 0,
          totalLeads: c.total_leads || 0,
          replyRate: pct(c.replied || 0, c.emails_sent || 0),
          bounceRate: pct(c.bounced || 0, c.emails_sent || 0),
        });
      }

      globalStats.workspaceReports.push(wsStats);
      console.log(` ✓ ${accounts.length} accounts, ${campaigns.length} campaigns`);

    } catch (e) {
      console.log(` ❌ Error: ${e.message}`);
    }

    await sleep(400);
  }

  // ── PRINT REPORT ─────────────────────────────────────────────────────────

  const globalReplyRate = pct(globalStats.totalReplied, globalStats.totalSent);
  const globalBounceRate = pct(globalStats.totalBounced, globalStats.totalSent);
  const globalUnsubRate = pct(globalStats.totalUnsub, globalStats.totalSent);
  const globalOpenRate = pct(globalStats.totalOpened, globalStats.totalSent);

  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                    GLOBAL INFRASTRUCTURE OVERVIEW                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  📬 Total Emails Sent:       ${globalStats.totalSent.toLocaleString()}`);
  console.log(`  💬 Total Replies:           ${globalStats.totalReplied.toLocaleString()}`);
  console.log(`  👀 Total Opens:             ${globalStats.totalOpened.toLocaleString()}`);
  console.log(`  🚀 Total Interested Leads:  ${globalStats.totalInterested.toLocaleString()}`);
  console.log(`  🔴 Total Bounced:           ${globalStats.totalBounced.toLocaleString()}`);
  console.log(`  🚫 Total Unsubscribed:      ${globalStats.totalUnsub.toLocaleString()}`);
  console.log('');
  console.log(`  📊 Global Reply Rate:       ${fmt(globalReplyRate)}%  ${bar(globalReplyRate)}`);
  console.log(`  📊 Global Open Rate:        ${fmt(globalOpenRate)}%  ${bar(globalOpenRate)}`);
  console.log(`  📊 Global Bounce Rate:      ${fmt(globalBounceRate)}%  ${bar(globalBounceRate)}`);
  console.log(`  📊 Global Unsub Rate:       ${fmt(globalUnsubRate)}%  ${bar(globalUnsubRate)}`);
  console.log('');
  console.log(`  📧 Total Email Accounts:    ${globalStats.totalAccounts}`);
  console.log(`  ✅ Active/Connected:        ${globalStats.activeAccounts}`);
  console.log(`  ❌ Disconnected/Error:      ${globalStats.disconnectedAccounts}`);
  console.log(`  ⏸️  Paused:                 ${globalStats.pausedAccounts}`);

  // ── PER-WORKSPACE REPORT ──────────────────────────────────────────────────
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║              PER-WORKSPACE BREAKDOWN (sorted by health)             ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const sorted = [...globalStats.workspaceReports].sort((a, b) => a.healthScore - b.healthScore);

  for (const ws of sorted) {
    if (ws.totalAccounts === 0) continue;

    const label = healthLabel(ws.healthScore);
    console.log('');
    console.log(`  ┌─ ${ws.name}`);
    console.log(`  │  Health: ${label} (${fmt(ws.healthScore, 0)}/100)`);
    console.log(`  │  Accounts: ${ws.activeAccounts} active / ${ws.disconnectedAccounts} disconnected / ${ws.pausedAccounts} paused (${ws.totalAccounts} total)`);
    console.log(`  │  Campaigns: ${ws.activeCampaigns} active / ${ws.totalCampaigns} total`);
    console.log(`  │  Sent: ${ws.totalSent.toLocaleString()} | Replied: ${ws.totalReplied.toLocaleString()} | Interested: ${ws.totalInterested.toLocaleString()}`);
    console.log(`  │  Reply Rate:  ${fmt(ws.replyRate)}%  ${bar(ws.replyRate)}`);
    console.log(`  │  Open Rate:   ${fmt(ws.openRate)}%  ${bar(ws.openRate)}`);
    console.log(`  │  Bounce Rate: ${fmt(ws.bounceRate)}%  ${bar(ws.bounceRate)}`);
    console.log(`  │  Unsub Rate:  ${fmt(ws.unsubRate)}%  ${bar(ws.unsubRate)}`);

    // Show worst accounts in this workspace
    const worstAccounts = ws.accounts
      .filter(a => a.healthScore !== null && a.healthScore < 40 && a.sent > 10)
      .sort((a, b) => a.healthScore - b.healthScore)
      .slice(0, 5);

    if (worstAccounts.length > 0) {
      console.log(`  │  ⚠️  Critical accounts (${worstAccounts.length}):`);
      for (const a of worstAccounts) {
        console.log(`  │      • ${a.email.padEnd(45)} Score: ${fmt(a.healthScore,0).padStart(3)} | Reply: ${fmt(a.replyRate)}% | Bounce: ${fmt(a.bounceRate)}% | Sent: ${a.sent}`);
      }
    }

    // Show disconnected accounts
    const disconnected = ws.accounts.filter(a => a.status === 'disconnected' || a.status === 'error');
    if (disconnected.length > 0) {
      console.log(`  │  🔌 Disconnected (${disconnected.length}):`);
      disconnected.slice(0, 5).forEach(a => console.log(`  │      • ${a.email}`));
      if (disconnected.length > 5) console.log(`  │      ... and ${disconnected.length - 5} more`);
    }

    console.log(`  └${'─'.repeat(68)}`);
  }

  // ── CRITICAL ACCOUNTS GLOBAL LIST ────────────────────────────────────────
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║              🔴 CRITICAL ACCOUNTS (Health Score < 40)               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');

  const critSorted = [...globalStats.criticalAccounts].sort((a, b) => a.score - b.score);
  if (critSorted.length === 0) {
    console.log('  ✅ No critical accounts found!');
  } else {
    console.log(`  Found ${critSorted.length} critical accounts:\n`);
    console.log('  ' + 'Email'.padEnd(45) + 'Workspace'.padEnd(30) + 'Score'.padEnd(8) + 'Reply%'.padEnd(9) + 'Bounce%'.padEnd(9) + 'Sent');
    console.log('  ' + '─'.repeat(105));
    for (const a of critSorted) {
      console.log(
        '  ' +
        (a.email || '').padEnd(45) +
        (a.workspace || '').padEnd(30) +
        fmt(a.score, 0).padStart(5).padEnd(8) +
        (fmt(a.replyRate) + '%').padEnd(9) +
        (fmt(a.bounceRate) + '%').padEnd(9) +
        a.sent
      );
    }
  }

  // ── AT RISK ACCOUNTS ─────────────────────────────────────────────────────
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║              🟠 AT-RISK ACCOUNTS (Health Score 40–59)               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');

  const riskSorted = [...globalStats.atRiskAccounts].sort((a, b) => a.score - b.score);
  if (riskSorted.length === 0) {
    console.log('  ✅ No at-risk accounts found!');
  } else {
    console.log(`  Found ${riskSorted.length} at-risk accounts:\n`);
    console.log('  ' + 'Email'.padEnd(45) + 'Workspace'.padEnd(30) + 'Score'.padEnd(8) + 'Reply%'.padEnd(9) + 'Bounce%'.padEnd(9) + 'Sent');
    console.log('  ' + '─'.repeat(105));
    for (const a of riskSorted) {
      console.log(
        '  ' +
        (a.email || '').padEnd(45) +
        (a.workspace || '').padEnd(30) +
        fmt(a.score, 0).padStart(5).padEnd(8) +
        (fmt(a.replyRate) + '%').padEnd(9) +
        (fmt(a.bounceRate) + '%').padEnd(9) +
        a.sent
      );
    }
  }

  // ── TOP PERFORMING ACCOUNTS ───────────────────────────────────────────────
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║              🟢 TOP PERFORMING ACCOUNTS (Health Score ≥ 80)         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');

  const topSorted = [...globalStats.topAccounts].sort((a, b) => b.score - a.score).slice(0, 30);
  if (topSorted.length === 0) {
    console.log('  No top-performing accounts found.');
  } else {
    console.log(`  Top ${topSorted.length} accounts:\n`);
    console.log('  ' + 'Email'.padEnd(45) + 'Workspace'.padEnd(30) + 'Score'.padEnd(8) + 'Reply%'.padEnd(9) + 'Sent');
    console.log('  ' + '─'.repeat(100));
    for (const a of topSorted) {
      console.log(
        '  ' +
        (a.email || '').padEnd(45) +
        (a.workspace || '').padEnd(30) +
        fmt(a.score, 0).padStart(5).padEnd(8) +
        (fmt(a.replyRate) + '%').padEnd(9) +
        a.sent
      );
    }
  }

  // ── CAMPAIGN PERFORMANCE ACROSS ALL WORKSPACES ────────────────────────────
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║              📧 CAMPAIGN PERFORMANCE — ALL WORKSPACES               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Flatten all campaigns
  const allCampaigns = [];
  for (const ws of globalStats.workspaceReports) {
    for (const c of ws.campaigns) {
      allCampaigns.push({ ...c, workspace: ws.name });
    }
  }

  const campaignsWithData = allCampaigns.filter(c => c.sent > 0);
  const sortedCampaigns = campaignsWithData.sort((a, b) => b.replyRate - a.replyRate);

  console.log(`  Total campaigns found: ${allCampaigns.length} (${campaignsWithData.length} with send data)\n`);

  // Top campaigns by reply rate
  console.log('  🏆 TOP 15 CAMPAIGNS BY REPLY RATE:');
  console.log('  ' + 'Campaign'.padEnd(45) + 'Workspace'.padEnd(28) + 'Reply%'.padEnd(9) + 'Bounce%'.padEnd(10) + 'Sent'.padEnd(10) + 'Status');
  console.log('  ' + '─'.repeat(115));
  sortedCampaigns.slice(0, 15).forEach(c => {
    const replyFlag = c.replyRate >= 10 ? '🟢' : c.replyRate >= 5 ? '🟡' : '🔴';
    console.log(
      '  ' + replyFlag + ' ' +
      (c.name || '').slice(0, 43).padEnd(44) +
      (c.workspace || '').slice(0, 26).padEnd(28) +
      (fmt(c.replyRate) + '%').padEnd(9) +
      (fmt(c.bounceRate) + '%').padEnd(10) +
      String(c.sent).padEnd(10) +
      (c.status || '')
    );
  });

  // Bottom campaigns by reply rate
  console.log('\n  ⚠️  BOTTOM 15 CAMPAIGNS BY REPLY RATE (min 50 emails sent):');
  console.log('  ' + 'Campaign'.padEnd(45) + 'Workspace'.padEnd(28) + 'Reply%'.padEnd(9) + 'Bounce%'.padEnd(10) + 'Sent'.padEnd(10) + 'Status');
  console.log('  ' + '─'.repeat(115));
  const bottomCampaigns = campaignsWithData
    .filter(c => c.sent >= 50)
    .sort((a, b) => a.replyRate - b.replyRate)
    .slice(0, 15);
  bottomCampaigns.forEach(c => {
    const replyFlag = c.replyRate >= 10 ? '🟢' : c.replyRate >= 5 ? '🟡' : '🔴';
    console.log(
      '  ' + replyFlag + ' ' +
      (c.name || '').slice(0, 43).padEnd(44) +
      (c.workspace || '').slice(0, 26).padEnd(28) +
      (fmt(c.replyRate) + '%').padEnd(9) +
      (fmt(c.bounceRate) + '%').padEnd(10) +
      String(c.sent).padEnd(10) +
      (c.status || '')
    );
  });

  // High bounce campaigns
  const highBounceCampaigns = campaignsWithData
    .filter(c => c.bounceRate > 5 && c.sent >= 50)
    .sort((a, b) => b.bounceRate - a.bounceRate);

  if (highBounceCampaigns.length > 0) {
    console.log('\n  🔴 HIGH BOUNCE CAMPAIGNS (>5% bounce rate, min 50 sent):');
    console.log('  ' + 'Campaign'.padEnd(45) + 'Workspace'.padEnd(28) + 'Bounce%'.padEnd(10) + 'Reply%'.padEnd(9) + 'Sent');
    console.log('  ' + '─'.repeat(100));
    highBounceCampaigns.forEach(c => {
      console.log(
        '  🚨 ' +
        (c.name || '').slice(0, 43).padEnd(44) +
        (c.workspace || '').slice(0, 26).padEnd(28) +
        (fmt(c.bounceRate) + '%').padEnd(10) +
        (fmt(c.replyRate) + '%').padEnd(9) +
        c.sent
      );
    });
  }

  // ── WORKSPACE HEALTH LEADERBOARD ─────────────────────────────────────────
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║              🏆 WORKSPACE HEALTH LEADERBOARD                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');

  const leaderboard = [...globalStats.workspaceReports]
    .filter(w => w.totalAccounts > 0)
    .sort((a, b) => b.healthScore - a.healthScore);

  console.log('  ' + 'Rank'.padEnd(6) + 'Workspace'.padEnd(35) + 'Health'.padEnd(20) + 'Reply%'.padEnd(9) + 'Bounce%'.padEnd(10) + 'Accounts'.padEnd(10) + 'Sent');
  console.log('  ' + '─'.repeat(100));

  leaderboard.forEach((ws, i) => {
    const rank = `#${i + 1}`;
    const label = healthLabel(ws.healthScore).split(' ')[0]; // just emoji
    console.log(
      '  ' +
      rank.padEnd(6) +
      ws.name.slice(0, 33).padEnd(35) +
      (label + ' ' + fmt(ws.healthScore, 0) + '/100').padEnd(20) +
      (fmt(ws.replyRate) + '%').padEnd(9) +
      (fmt(ws.bounceRate) + '%').padEnd(10) +
      String(ws.totalAccounts).padEnd(10) +
      ws.totalSent.toLocaleString()
    );
  });

  // ── FINAL SUMMARY & RECOMMENDATIONS ──────────────────────────────────────
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║              📋 KEY FINDINGS & RECOMMENDATIONS                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');

  const criticalWorkspaces = leaderboard.filter(w => w.healthScore < 40);
  const atRiskWorkspaces = leaderboard.filter(w => w.healthScore >= 40 && w.healthScore < 60);
  const healthyWorkspaces = leaderboard.filter(w => w.healthScore >= 80);

  console.log(`  Infrastructure Summary:`);
  console.log(`  • 🟢 Healthy workspaces:    ${healthyWorkspaces.length}`);
  console.log(`  • 🟡 Moderate workspaces:   ${leaderboard.filter(w => w.healthScore >= 60 && w.healthScore < 80).length}`);
  console.log(`  • 🟠 At-risk workspaces:    ${atRiskWorkspaces.length}`);
  console.log(`  • 🔴 Critical workspaces:   ${criticalWorkspaces.length}`);
  console.log('');
  console.log(`  Account Summary:`);
  console.log(`  • 🔴 Critical accounts:     ${globalStats.criticalAccounts.length}`);
  console.log(`  • 🟠 At-risk accounts:      ${globalStats.atRiskAccounts.length}`);
  console.log(`  • 🟢 Top accounts:          ${globalStats.topAccounts.length}`);
  console.log(`  • ❌ Disconnected:          ${globalStats.disconnectedAccounts}`);
  console.log('');

  if (criticalWorkspaces.length > 0) {
    console.log(`  🚨 URGENT — Critical Workspaces needing immediate attention:`);
    criticalWorkspaces.forEach(w => {
      console.log(`     • ${w.name} (Score: ${fmt(w.healthScore,0)}, Reply: ${fmt(w.replyRate)}%, Bounce: ${fmt(w.bounceRate)}%)`);
    });
    console.log('');
  }

  if (globalBounceRate > 5) {
    console.log(`  🚨 ALERT: Global bounce rate is ${fmt(globalBounceRate)}% — above the safe threshold of 5%.`);
    console.log(`     High bounces damage domain reputation. Review and replace high-bounce accounts immediately.`);
    console.log('');
  }

  if (globalReplyRate < 5) {
    console.log(`  ⚠️  WARNING: Global reply rate is ${fmt(globalReplyRate)}% — below benchmark of 5%.`);
    console.log(`     Consider reviewing email copy, targeting, and account health.`);
    console.log('');
  }

  if (globalStats.disconnectedAccounts > 0) {
    console.log(`  ⚠️  ${globalStats.disconnectedAccounts} accounts are disconnected and not sending.`);
    console.log(`     Reconnect or replace these to recover sending volume.`);
    console.log('');
  }

  console.log('═'.repeat(72));
  console.log('Scan complete.\n');
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
