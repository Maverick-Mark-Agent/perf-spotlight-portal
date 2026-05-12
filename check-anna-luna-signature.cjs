#!/usr/bin/env node

/**
 * Check all March Renewals campaigns across all workspaces
 * for any leftover Anna Luna signature in the email copy.
 */

const BISON_BASE_URL = 'https://send.maverickmarketingllc.com/api';
const BISON_API_KEY = '77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d';

// Keywords to flag as Anna Luna's signature
// Broad enough to catch variations (Anna Luna, Anna, Luna, her email, etc.)
const ANNA_LUNA_PATTERNS = [
  /anna\s+luna/gi,
  /annaluna/gi,
  /anna luna/gi,
  /\banna\b/gi,
  /\bluna\b/gi,
];

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
    throw new Error(err.message || `Bison API error: ${res.status} on ${endpoint}`);
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

async function getWorkspaces() {
  return bisonRequest('/workspaces/v1.1');
}

async function getCampaigns() {
  const res = await bisonRequest('/campaigns?per_page=1000');
  // handle both { data: [...] } and direct array
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.data)) return res.data;
  return [];
}

async function getCampaignSequenceSteps(campaignId) {
  try {
    const res = await bisonRequest(`/campaigns/${campaignId}/sequence-steps`);
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.data)) return res.data;
    return [];
  } catch (e) {
    return [];
  }
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function checkForAnnaLuna(text) {
  const hits = [];
  for (const pattern of ANNA_LUNA_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Grab surrounding context (50 chars each side)
      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + match[0].length + 50);
      hits.push({
        matched: match[0],
        context: '...' + text.slice(start, end).trim() + '...',
      });
    }
  }
  return hits;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('🔍 Checking all March Renewals campaigns for Anna Luna signature\n');
  console.log('='.repeat(70));

  let workspaces;
  try {
    workspaces = await getWorkspaces();
  } catch (e) {
    console.error('❌ Failed to fetch workspaces:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(workspaces) || workspaces.length === 0) {
    console.log('No workspaces found.');
    process.exit(0);
  }

  console.log(`Found ${workspaces.length} workspaces. Scanning...\n`);

  const flagged = [];   // workspaces/campaigns with Anna Luna hits
  const clean = [];     // March Renewals campaigns that are clean
  const noMarch = [];   // workspaces with no March Renewals campaign

  for (const ws of workspaces) {
    process.stdout.write(`\n📂 ${ws.name} (ID: ${ws.id}) — switching workspace...`);

    try {
      await switchWorkspace(ws.id);
      await sleep(300); // small delay to be safe

      const campaigns = await getCampaigns();
      const marchCampaigns = campaigns.filter(c =>
        c.name && c.name.toLowerCase().includes('march') &&
        c.name.toLowerCase().includes('renew')
      );

      if (marchCampaigns.length === 0) {
        console.log(' no March Renewals campaign found, skipping.');
        noMarch.push(ws.name);
        continue;
      }

      console.log(` found ${marchCampaigns.length} March Renewals campaign(s).`);

      for (const campaign of marchCampaigns) {
        console.log(`  📧 Campaign: "${campaign.name}" (ID: ${campaign.id})`);

        const steps = await getCampaignSequenceSteps(campaign.id);
        await sleep(200);

        if (steps.length === 0) {
          console.log(`     ⚠️  No sequence steps found (or endpoint unavailable)`);
          continue;
        }

        let campaignFlagged = false;

        for (const step of steps) {
          const stepNum = step.order || step.step_number || '?';
          const subject = step.email_subject || step.title || '';
          const bodyRaw = step.email_body || step.body || '';
          const bodyClean = stripHtml(bodyRaw);
          const fullText = `${subject} ${bodyClean}`;

          const hits = checkForAnnaLuna(fullText);

          if (hits.length > 0) {
            campaignFlagged = true;
            console.log(`     ❌ Step ${stepNum} — ANNA LUNA FOUND!`);
            hits.forEach(h => {
              console.log(`        Matched: "${h.matched}"`);
              console.log(`        Context: ${h.context}`);
            });
          } else {
            console.log(`     ✅ Step ${stepNum} — Clean`);
          }
        }

        if (campaignFlagged) {
          flagged.push({ workspace: ws.name, campaign: campaign.name, campaignId: campaign.id });
        } else {
          clean.push({ workspace: ws.name, campaign: campaign.name });
        }
      }

    } catch (e) {
      console.log(` ❌ Error: ${e.message}`);
    }

    await sleep(400); // rate limit buffer between workspaces
  }

  // ── Final Report ──────────────────────────────────────────────────────────
  console.log('\n\n' + '='.repeat(70));
  console.log('📋 FINAL REPORT');
  console.log('='.repeat(70));

  if (flagged.length === 0) {
    console.log('\n✅ ALL CLEAR — No Anna Luna signature found in any March Renewals campaign!\n');
  } else {
    console.log(`\n❌ ISSUES FOUND — ${flagged.length} campaign(s) still contain Anna Luna's signature:\n`);
    flagged.forEach(f => {
      console.log(`  • Workspace: ${f.workspace}`);
      console.log(`    Campaign:  ${f.campaign} (ID: ${f.campaignId})`);
      console.log('');
    });
  }

  if (clean.length > 0) {
    console.log(`✅ Clean campaigns (${clean.length}):`);
    clean.forEach(c => console.log(`  • ${c.workspace} → ${c.campaign}`));
  }

  if (noMarch.length > 0) {
    console.log(`\n⚪ No March Renewals campaign found in ${noMarch.length} workspace(s):`);
    noMarch.forEach(n => console.log(`  • ${n}`));
  }

  console.log('\n' + '='.repeat(70));
  console.log('Done.\n');
}

main();
