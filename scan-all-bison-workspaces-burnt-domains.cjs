const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, anonKey);

async function scanAllBisonWorkspaces() {
  console.log('🔍 Scanning ALL Bison workspaces for burnt domains...\n');
  console.log('Step 1: Fetching all email accounts from database...\n');

  // Fetch ALL accounts
  let allAccounts = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('sender_emails_cache')
      .select('email_address, emails_sent_count, total_replied_count, reply_rate_percentage, workspace_name, status, reseller, email_provider')
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order('workspace_name');

    if (error) {
      console.error('❌ Error fetching accounts:', error.message);
      break;
    }

    if (data.length === 0) {
      hasMore = false;
    } else {
      allAccounts = allAccounts.concat(data);
      console.log(`   Fetched ${allAccounts.length} accounts so far...`);
      page++;
    }

    if (data.length < pageSize) {
      hasMore = false;
    }
  }

  console.log(`\n✅ Total accounts fetched: ${allAccounts.length}\n`);

  // Filter to exclude legacy panel accounts and only include accounts with activity
  const activeAccounts = allAccounts.filter(acc => {
    const emailsSent = acc.emails_sent_count || 0;
    const workspace = acc.workspace_name || '';

    // Exclude "Legacy Panel" workspace (super new accounts)
    if (workspace.toLowerCase().includes('legacy panel') || workspace === 'Legacy Panel') {
      return false;
    }

    return emailsSent > 0;
  });

  const legacyCount = allAccounts.filter(acc => {
    const workspace = acc.workspace_name || '';
    return workspace.toLowerCase().includes('legacy panel') || workspace === 'Legacy Panel';
  }).length;

  console.log(`📊 Accounts with email activity: ${activeAccounts.length}`);
  console.log(`🚫 Legacy Panel accounts excluded: ${legacyCount}\n`);

  // Get unique workspaces
  const workspaces = new Set();
  activeAccounts.forEach(acc => {
    if (acc.workspace_name) {
      workspaces.add(acc.workspace_name);
    }
  });

  console.log(`📁 Unique workspaces found: ${workspaces.size}\n`);
  console.log('Step 2: Analyzing burnt domains by workspace...\n');

  // Group by workspace, then by domain
  const workspaceMap = new Map();

  activeAccounts.forEach(account => {
    const workspace = account.workspace_name || 'Unknown';
    const email = account.email_address;
    const domain = email.split('@')[1];

    if (!workspaceMap.has(workspace)) {
      workspaceMap.set(workspace, new Map());
    }

    const domainMap = workspaceMap.get(workspace);

    if (!domainMap.has(domain)) {
      domainMap.set(domain, {
        domain,
        workspace,
        accounts: []
      });
    }

    domainMap.get(domain).accounts.push({
      email,
      emailsSent: account.emails_sent_count || 0,
      totalReplied: account.total_replied_count || 0,
      replyRate: account.reply_rate_percentage || 0,
      status: account.status,
      reseller: account.reseller,
      provider: account.email_provider
    });
  });

  // Analyze each workspace and find burnt domains
  const allBurntDomains = [];
  const allMixedDomains = [];
  const workspaceSummary = [];

  let processedWorkspaces = 0;

  workspaceMap.forEach((domainMap, workspace) => {
    processedWorkspaces++;
    if (processedWorkspaces % 10 === 0) {
      console.log(`   Processed ${processedWorkspaces}/${workspaceMap.size} workspaces...`);
    }

    let workspaceBurntCount = 0;
    let workspaceMixedCount = 0;
    let workspaceHealthyCount = 0;

    domainMap.forEach((domainData) => {
      const { domain, workspace, accounts } = domainData;

      // Calculate domain-level stats
      const totalSent = accounts.reduce((sum, acc) => sum + acc.emailsSent, 0);
      const totalReplied = accounts.reduce((sum, acc) => sum + acc.totalReplied, 0);
      const avgReplyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;

      // Categorize accounts (50 emails minimum threshold)
      const burntAccounts = accounts.filter(acc => acc.emailsSent >= 50 && acc.replyRate < 0.4);
      const healthyAccounts = accounts.filter(acc => acc.emailsSent >= 50 && acc.replyRate >= 0.4);
      const lowVolumeAccounts = accounts.filter(acc => acc.emailsSent < 50);
      const highVolumeAccounts = accounts.filter(acc => acc.emailsSent >= 50);

      let classification;

      if (totalSent === 0 || highVolumeAccounts.length === 0) {
        classification = 'LOW_VOLUME';
      } else if (burntAccounts.length === highVolumeAccounts.length && burntAccounts.length > 0) {
        classification = 'ALL_BURNT';
        workspaceBurntCount++;

        allBurntDomains.push({
          workspace,
          domain,
          classification,
          totalAccounts: accounts.length,
          burntAccounts: burntAccounts.length,
          healthyAccounts: healthyAccounts.length,
          lowVolumeAccounts: lowVolumeAccounts.length,
          totalSent,
          totalReplied,
          avgReplyRate,
          accounts,
          burntAccountEmails: burntAccounts.map(a => a.email).join('; '),
          provider: accounts[0]?.provider || 'Unknown',
          reseller: accounts[0]?.reseller || 'Unknown'
        });
      } else if (burntAccounts.length > 0 && healthyAccounts.length > 0) {
        classification = 'MIXED';
        workspaceMixedCount++;

        allMixedDomains.push({
          workspace,
          domain,
          classification,
          totalAccounts: accounts.length,
          burntAccounts: burntAccounts.length,
          healthyAccounts: healthyAccounts.length,
          lowVolumeAccounts: lowVolumeAccounts.length,
          totalSent,
          totalReplied,
          avgReplyRate,
          accounts,
          burntAccountEmails: burntAccounts.map(a => a.email).join('; '),
          provider: accounts[0]?.provider || 'Unknown',
          reseller: accounts[0]?.reseller || 'Unknown'
        });
      } else {
        classification = 'HEALTHY';
        workspaceHealthyCount++;
      }
    });

    workspaceSummary.push({
      workspace,
      totalDomains: domainMap.size,
      burntDomains: workspaceBurntCount,
      mixedDomains: workspaceMixedCount,
      healthyDomains: workspaceHealthyCount
    });
  });

  console.log(`\n✅ Processed all ${workspaceMap.size} workspaces\n`);

  // Sort by total sent
  allBurntDomains.sort((a, b) => b.totalSent - a.totalSent);
  allMixedDomains.sort((a, b) => b.burntAccounts - a.burntAccounts);

  // Print summary
  console.log('='.repeat(80));
  console.log('📊 BISON WORKSPACES - BURNT DOMAINS SCAN RESULTS');
  console.log('='.repeat(80));
  console.log(`Total workspaces scanned: ${workspaceMap.size}`);
  console.log(`Total accounts analyzed: ${activeAccounts.length}`);
  console.log('');
  console.log(`  🔥 ALL BURNT domains found: ${allBurntDomains.length}`);
  console.log(`  ⚠️  MIXED domains (some burnt): ${allMixedDomains.length}`);
  console.log('');

  // Generate CSV reports
  generateBisonBurntDomainsReport(allBurntDomains, allMixedDomains, workspaceSummary);

  return { allBurntDomains, allMixedDomains, workspaceSummary };
}

function generateBisonBurntDomainsReport(burntDomains, mixedDomains, workspaceSummary) {
  console.log('📝 Generating CSV reports...\n');

  // 1. ALL BURNT DOMAINS WITH ACCOUNT DETAILS
  const burntCSV = [
    'Workspace,Domain,Classification,Total Accounts,Burnt Accounts,Healthy Accounts,Low Volume Accounts,Total Sent,Total Replied,Avg Reply Rate %,Provider,Reseller,Burnt Account Emails,All Account Emails'
  ];

  burntDomains.forEach(d => {
    const allEmails = d.accounts.map(a => a.email).join('; ');
    burntCSV.push([
      d.workspace,
      d.domain,
      d.classification,
      d.totalAccounts,
      d.burntAccounts,
      d.healthyAccounts,
      d.lowVolumeAccounts,
      d.totalSent,
      d.totalReplied,
      d.avgReplyRate.toFixed(2),
      d.provider,
      d.reseller,
      `"${d.burntAccountEmails}"`,
      `"${allEmails}"`
    ].join(','));
  });

  fs.writeFileSync('BISON-ALL-BURNT-DOMAINS.csv', burntCSV.join('\n'));

  // 2. MIXED DOMAINS WITH BURNT ACCOUNTS
  const mixedCSV = [
    'Workspace,Domain,Classification,Total Accounts,Burnt Accounts,Healthy Accounts,Low Volume Accounts,Total Sent,Total Replied,Avg Reply Rate %,Provider,Reseller,Burnt Account Emails,All Account Emails'
  ];

  mixedDomains.forEach(d => {
    const allEmails = d.accounts.map(a => a.email).join('; ');
    mixedCSV.push([
      d.workspace,
      d.domain,
      d.classification,
      d.totalAccounts,
      d.burntAccounts,
      d.healthyAccounts,
      d.lowVolumeAccounts,
      d.totalSent,
      d.totalReplied,
      d.avgReplyRate.toFixed(2),
      d.provider,
      d.reseller,
      `"${d.burntAccountEmails}"`,
      `"${allEmails}"`
    ].join(','));
  });

  fs.writeFileSync('BISON-MIXED-DOMAINS.csv', mixedCSV.join('\n'));

  // 3. COMBINED - ALL BURNT AND MIXED DOMAINS
  const combinedCSV = [
    'Workspace,Domain,Classification,Total Accounts,Burnt Accounts,Healthy Accounts,Low Volume Accounts,Total Sent,Total Replied,Avg Reply Rate %,Provider,Reseller,Burnt Account Emails'
  ];

  [...burntDomains, ...mixedDomains].forEach(d => {
    combinedCSV.push([
      d.workspace,
      d.domain,
      d.classification,
      d.totalAccounts,
      d.burntAccounts,
      d.healthyAccounts,
      d.lowVolumeAccounts,
      d.totalSent,
      d.totalReplied,
      d.avgReplyRate.toFixed(2),
      d.provider,
      d.reseller,
      `"${d.burntAccountEmails}"`
    ].join(','));
  });

  fs.writeFileSync('BISON-ALL-BURNT-AND-MIXED-DOMAINS.csv', combinedCSV.join('\n'));

  // 4. WORKSPACE SUMMARY
  const workspaceSummaryCSV = [
    'Workspace,Total Domains,Burnt Domains,Mixed Domains,Healthy Domains,Burnt %'
  ];

  workspaceSummary.sort((a, b) => b.burntDomains - a.burntDomains);

  workspaceSummary.forEach(ws => {
    const burntPercentage = ws.totalDomains > 0 ? ((ws.burntDomains / ws.totalDomains) * 100).toFixed(1) : '0.0';
    workspaceSummaryCSV.push([
      ws.workspace,
      ws.totalDomains,
      ws.burntDomains,
      ws.mixedDomains,
      ws.healthyDomains,
      burntPercentage
    ].join(','));
  });

  fs.writeFileSync('BISON-WORKSPACE-BURNT-SUMMARY.csv', workspaceSummaryCSV.join('\n'));

  // 5. DETAILED ACCOUNT-LEVEL BREAKDOWN FOR BURNT DOMAINS
  const detailedCSV = [
    'Workspace,Domain,Domain Classification,Account Email,Account Sent,Account Replied,Account Reply Rate %,Account Status,Provider,Reseller'
  ];

  [...burntDomains, ...mixedDomains].forEach(d => {
    d.accounts.forEach(acc => {
      const accountStatus = acc.emailsSent < 50 ? 'LOW_VOLUME' : (acc.replyRate < 0.4 ? 'BURNT' : 'HEALTHY');
      detailedCSV.push([
        d.workspace,
        d.domain,
        d.classification,
        acc.email,
        acc.emailsSent,
        acc.totalReplied,
        acc.replyRate.toFixed(2),
        accountStatus,
        acc.provider || 'Unknown',
        acc.reseller || 'Unknown'
      ].join(','));
    });
  });

  fs.writeFileSync('BISON-BURNT-DOMAINS-DETAILED-ACCOUNTS.csv', detailedCSV.join('\n'));

  console.log('✅ Generated CSV files:');
  console.log(`   1. BISON-ALL-BURNT-DOMAINS.csv (${burntDomains.length} completely burnt domains)`);
  console.log(`   2. BISON-MIXED-DOMAINS.csv (${mixedDomains.length} domains with some burnt accounts)`);
  console.log(`   3. BISON-ALL-BURNT-AND-MIXED-DOMAINS.csv (${burntDomains.length + mixedDomains.length} total problem domains)`);
  console.log(`   4. BISON-WORKSPACE-BURNT-SUMMARY.csv (summary by workspace)`);
  console.log(`   5. BISON-BURNT-DOMAINS-DETAILED-ACCOUNTS.csv (account-level breakdown)`);
  console.log('');

  // Show top workspaces with burnt domains
  console.log('🔥 Top 10 Workspaces with Most Burnt Domains:');
  workspaceSummary.slice(0, 10).forEach((ws, i) => {
    console.log(`   ${i + 1}. ${ws.workspace} - ${ws.burntDomains} burnt, ${ws.mixedDomains} mixed (${ws.burntDomains + ws.mixedDomains} total problem domains)`);
  });
  console.log('');

  if (burntDomains.length > 0) {
    console.log('🔥 Top 10 Burnt Domains (by volume):');
    burntDomains.slice(0, 10).forEach((d, i) => {
      console.log(`   ${i + 1}. ${d.domain} (${d.workspace}) - ${d.totalAccounts} accounts, ${d.totalSent} sent, ${d.avgReplyRate.toFixed(2)}% rate`);
    });
    console.log('');
  }
}

scanAllBisonWorkspaces().catch(console.error);
