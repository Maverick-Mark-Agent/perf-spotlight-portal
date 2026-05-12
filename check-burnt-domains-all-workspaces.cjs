const fs = require('fs');

const BISON_API_KEY = '77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d';
const BISON_BASE_URL = 'https://send.maverickmarketingllc.com/api';

async function fetchWorkspaces() {
  console.log('📁 Fetching all workspaces from Bison...\n');

  const response = await fetch(`${BISON_BASE_URL}/workspaces/v1.1`, {
    headers: {
      'Authorization': `Bearer ${BISON_API_KEY}`,
      'Accept': 'application/json'
    }
  });

  const data = await response.json();
  return data.data || [];
}

async function switchWorkspace(workspaceId) {
  const response = await fetch(`${BISON_BASE_URL}/workspaces/v1.1/switch-workspace`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BISON_API_KEY}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ workspace_id: workspaceId })
  });

  return response.ok;
}

async function fetchSenderEmailsForWorkspace(workspaceName) {
  let allAccounts = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`${BISON_BASE_URL}/sender-emails/v1.1?per_page=100&page=${page}`, {
      headers: {
        'Authorization': `Bearer ${BISON_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      break;
    }

    const data = await response.json();

    if (data.data && data.data.length > 0) {
      // Add workspace name to each account
      const accountsWithWorkspace = data.data.map(acc => ({
        ...acc,
        workspace_name: workspaceName
      }));
      allAccounts = allAccounts.concat(accountsWithWorkspace);

      if (data.links && data.links.next) {
        page++;
      } else {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  return allAccounts;
}

async function analyzeBurntDomainsAllWorkspaces() {
  const workspaces = await fetchWorkspaces();
  console.log(`✅ Found ${workspaces.length} workspaces\n`);

  let allAccounts = [];

  // Skip test/internal workspaces
  const skipWorkspaces = ['Thomas\'s Team', 'Test Client', 'Test Rob Russell', 'thomas'];

  for (const workspace of workspaces) {
    if (skipWorkspaces.includes(workspace.name)) {
      continue;
    }

    // Switch to this workspace
    const switched = await switchWorkspace(workspace.id);
    if (!switched) {
      console.log(`   ⚠️ Could not switch to ${workspace.name}`);
      continue;
    }

    // Fetch sender emails for this workspace
    const accounts = await fetchSenderEmailsForWorkspace(workspace.name);
    console.log(`   ${workspace.name}: ${accounts.length} accounts`);
    allAccounts = allAccounts.concat(accounts);
  }

  console.log(`\n✅ Total accounts fetched: ${allAccounts.length}\n`);

  // Filter for active accounts (with email activity) and exclude Legacy Panel
  const activeAccounts = allAccounts.filter(acc => {
    const emailsSent = acc.emails_sent_count || 0;

    // Check for Legacy Panel tag
    const isLegacy = acc.tags && Array.isArray(acc.tags) &&
      acc.tags.some(t => t && typeof t === 'string' && t.toLowerCase().includes('legacy panel'));

    if (isLegacy) return false;

    return emailsSent > 0;
  });

  const legacyCount = allAccounts.filter(acc => {
    return acc.tags && Array.isArray(acc.tags) &&
      acc.tags.some(t => t && typeof t === 'string' && t.toLowerCase().includes('legacy panel'));
  }).length;

  console.log(`📊 Accounts with activity: ${activeAccounts.length}`);
  console.log(`🚫 Legacy Panel accounts excluded: ${legacyCount}\n`);

  // Group by domain
  const domainMap = new Map();

  activeAccounts.forEach(account => {
    const email = account.email;
    const domain = email.split('@')[1];
    const replyRate = account.emails_sent_count > 0
      ? ((account.unique_replied_count || 0) / account.emails_sent_count) * 100
      : 0;

    if (!domainMap.has(domain)) {
      domainMap.set(domain, {
        domain,
        accounts: [],
        workspaces: new Set()
      });
    }

    const domainData = domainMap.get(domain);
    domainData.accounts.push({
      email,
      workspace: account.workspace_name,
      emailsSent: account.emails_sent_count || 0,
      totalReplied: account.unique_replied_count || 0,
      replyRate,
      status: account.status,
      tags: account.tags || []
    });
    domainData.workspaces.add(account.workspace_name);
  });

  console.log(`Found ${domainMap.size} unique domains\n`);

  // Analyze for burnt domains
  const burntDomains = [];

  domainMap.forEach((domainData) => {
    const { domain, accounts } = domainData;

    const totalSent = accounts.reduce((sum, acc) => sum + acc.emailsSent, 0);
    const totalReplied = accounts.reduce((sum, acc) => sum + acc.totalReplied, 0);
    const avgReplyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;

    // Accounts with 50+ emails sent
    const highVolumeAccounts = accounts.filter(acc => acc.emailsSent >= 50);
    const burntAccounts = highVolumeAccounts.filter(acc => acc.replyRate < 0.4);

    // Domain is burnt if ALL high-volume accounts are burnt
    if (highVolumeAccounts.length > 0 && burntAccounts.length === highVolumeAccounts.length) {
      burntDomains.push({
        domain,
        workspace: Array.from(domainData.workspaces).join('; '),
        totalAccounts: accounts.length,
        burntAccounts: burntAccounts.length,
        totalSent,
        totalReplied,
        avgReplyRate,
        accountEmails: accounts.map(a => a.email).join('; ')
      });
    }
  });

  // Sort by emails sent
  burntDomains.sort((a, b) => b.totalSent - a.totalSent);

  // Generate summary by workspace
  const workspaceSummary = {};
  burntDomains.forEach(d => {
    const ws = d.workspace.split('; ')[0]; // Primary workspace
    if (!workspaceSummary[ws]) {
      workspaceSummary[ws] = { domains: 0, accounts: 0 };
    }
    workspaceSummary[ws].domains++;
    workspaceSummary[ws].accounts += d.burntAccounts;
  });

  // Print summary
  console.log('='.repeat(80));
  console.log('🔥 BURNT DOMAINS FROM BISON (All accounts < 0.4% reply rate)');
  console.log('='.repeat(80));
  console.log(`Total burnt domains: ${burntDomains.length}\n`);

  console.log('📊 Summary by Client:');
  Object.entries(workspaceSummary)
    .sort((a, b) => b[1].domains - a[1].domains)
    .forEach(([ws, data]) => {
      console.log(`   ${ws}: ${data.domains} domains, ${data.accounts} accounts`);
    });
  console.log('');

  // Generate CSV
  const csv = [
    'Workspace,Domain,Total Accounts,Burnt Accounts,Total Sent,Total Replied,Avg Reply Rate %,Account Emails'
  ];

  burntDomains.forEach(d => {
    csv.push([
      d.workspace,
      d.domain,
      d.totalAccounts,
      d.burntAccounts,
      d.totalSent,
      d.totalReplied,
      d.avgReplyRate.toFixed(2),
      `"${d.accountEmails}"`
    ].join(','));
  });

  fs.writeFileSync('BISON-BURNT-DOMAINS-DIRECT.csv', csv.join('\n'));

  console.log(`\n✅ Generated: BISON-BURNT-DOMAINS-DIRECT.csv`);

  return burntDomains;
}

analyzeBurntDomainsAllWorkspaces().catch(console.error);
