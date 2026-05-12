const fs = require('fs');

const BISON_API_KEY = '77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d';
const BISON_BASE_URL = 'https://send.maverickmarketingllc.com/api';

async function fetchAllSenderEmails() {
  console.log('🔍 Fetching all sender emails directly from Bison API...\n');

  let allAccounts = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${BISON_BASE_URL}/sender-emails?per_page=1000&page=${page}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${BISON_API_KEY}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
      break;
    }

    const data = await response.json();

    if (data.data && data.data.length > 0) {
      allAccounts = allAccounts.concat(data.data);
      console.log(`   Fetched page ${page}: ${data.data.length} accounts (Total: ${allAccounts.length})`);

      // Check for more pages
      if (data.links && data.links.next) {
        page++;
      } else {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  console.log(`\n✅ Total accounts fetched from Bison: ${allAccounts.length}\n`);
  return allAccounts;
}

async function analyzeBurntDomains() {
  const allAccounts = await fetchAllSenderEmails();

  // Filter accounts with activity (exclude new/unused)
  const activeAccounts = allAccounts.filter(acc => {
    const emailsSent = acc.emails_sent_count || 0;
    return emailsSent > 0;
  });

  console.log(`📊 Accounts with email activity: ${activeAccounts.length}\n`);

  // Group by domain
  const domainMap = new Map();

  activeAccounts.forEach(account => {
    const email = account.email;
    const domain = email.split('@')[1];
    const replyRate = account.emails_sent_count > 0
      ? (account.unique_replied_count / account.emails_sent_count) * 100
      : 0;

    // Extract workspace from tags or name
    let workspace = 'Unknown';
    if (account.tags && Array.isArray(account.tags)) {
      // Try to find workspace in tags
      const wsTag = account.tags.find(t => t && !t.includes('CheapInboxes') && !t.includes('Zapmail') && !t.includes('ScaledMail') && !t.includes('Google') && !t.includes('Microsoft') && !t.includes('Outlook') && !t.includes('Legacy Panel'));
      if (wsTag) workspace = wsTag;
    }

    // Check for Legacy Panel tag - skip these accounts
    const isLegacy = account.tags && Array.isArray(account.tags) &&
      account.tags.some(t => t && t.toLowerCase().includes('legacy panel'));

    if (isLegacy) return; // Skip legacy accounts

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
      emailsSent: account.emails_sent_count || 0,
      totalReplied: account.unique_replied_count || 0,
      replyRate,
      status: account.status,
      tags: account.tags || []
    });
    if (workspace !== 'Unknown') {
      domainData.workspaces.add(workspace);
    }
  });

  console.log(`Found ${domainMap.size} unique domains\n`);

  // Analyze each domain for burnt status
  const burntDomains = [];

  domainMap.forEach((domainData) => {
    const { domain, accounts } = domainData;

    // Calculate domain-level stats
    const totalSent = accounts.reduce((sum, acc) => sum + acc.emailsSent, 0);
    const totalReplied = accounts.reduce((sum, acc) => sum + acc.totalReplied, 0);
    const avgReplyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;

    // Categorize accounts (50 emails minimum threshold)
    const burntAccounts = accounts.filter(acc => acc.emailsSent >= 50 && acc.replyRate < 0.4);
    const healthyAccounts = accounts.filter(acc => acc.emailsSent >= 50 && acc.replyRate >= 0.4);
    const highVolumeAccounts = accounts.filter(acc => acc.emailsSent >= 50);

    // Only include domains where ALL high-volume accounts are burnt
    if (highVolumeAccounts.length > 0 && burntAccounts.length === highVolumeAccounts.length) {
      burntDomains.push({
        domain,
        totalAccounts: accounts.length,
        burntAccounts: burntAccounts.length,
        totalSent,
        totalReplied,
        avgReplyRate,
        workspaces: Array.from(domainData.workspaces).join('; ') || 'Unknown',
        accountEmails: accounts.map(a => a.email).join('; ')
      });
    }
  });

  // Sort by total sent
  burntDomains.sort((a, b) => b.totalSent - a.totalSent);

  // Print summary
  console.log('='.repeat(80));
  console.log('🔥 BURNT DOMAINS FROM BISON API (All accounts < 0.4% reply rate)');
  console.log('='.repeat(80));
  console.log(`Total burnt domains found: ${burntDomains.length}\n`);

  // Generate CSV
  const csv = [
    'Domain,Total Accounts,Burnt Accounts,Total Sent,Total Replied,Avg Reply Rate %,Workspace(s),Account Emails'
  ];

  burntDomains.forEach(d => {
    csv.push([
      d.domain,
      d.totalAccounts,
      d.burntAccounts,
      d.totalSent,
      d.totalReplied,
      d.avgReplyRate.toFixed(2),
      `"${d.workspaces}"`,
      `"${d.accountEmails}"`
    ].join(','));
  });

  fs.writeFileSync('BISON-BURNT-DOMAINS-DIRECT.csv', csv.join('\n'));

  console.log('🔥 Burnt Domains:');
  burntDomains.slice(0, 20).forEach((d, i) => {
    console.log(`   ${i + 1}. ${d.domain} - ${d.burntAccounts} accounts, ${d.totalSent} sent, ${d.avgReplyRate.toFixed(2)}% rate`);
  });

  if (burntDomains.length > 20) {
    console.log(`   ... and ${burntDomains.length - 20} more`);
  }

  console.log(`\n✅ Generated: BISON-BURNT-DOMAINS-DIRECT.csv`);

  return burntDomains;
}

analyzeBurntDomains().catch(console.error);
