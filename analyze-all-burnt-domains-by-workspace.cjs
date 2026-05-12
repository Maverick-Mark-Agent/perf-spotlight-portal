const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, anonKey);

async function analyzeBurntDomainsAllWorkspaces() {
  console.log('🔍 Analyzing burnt domains across ALL workspaces...\n');
  console.log('Fetching all active email accounts from database...\n');

  // Fetch ALL active accounts
  const { data: allAccounts, error } = await supabase
    .from('sender_emails_cache')
    .select('email_address, emails_sent_count, total_replied_count, reply_rate_percentage, workspace_name, status, reseller, email_provider')
    .eq('status', 'active')
    .order('workspace_name');

  if (error) {
    console.error('❌ Error fetching accounts:', error.message);
    return;
  }

  console.log(`✅ Found ${allAccounts.length} active accounts\n`);
  console.log('📊 Analyzing domains and classifying burnt accounts...\n');

  // Group by domain
  const domainMap = new Map();

  allAccounts.forEach(account => {
    const email = account.email_address;
    const domain = email.split('@')[1];

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
      totalReplied: account.total_replied_count || 0,
      replyRate: account.reply_rate_percentage || 0,
      status: account.status,
      reseller: account.reseller,
      provider: account.email_provider
    });
    domainData.workspaces.add(account.workspace_name);
  });

  console.log(`Found ${domainMap.size} unique domains\n`);

  // Analyze each domain
  const burntDomains = [];
  const mixedDomains = [];
  const healthyDomains = [];
  const lowVolumeDomains = [];

  domainMap.forEach((domainData) => {
    const { domain, accounts } = domainData;

    // Calculate domain-level stats
    const totalSent = accounts.reduce((sum, acc) => sum + acc.emailsSent, 0);
    const totalReplied = accounts.reduce((sum, acc) => sum + acc.totalReplied, 0);
    const avgReplyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;

    // Categorize accounts (50 emails minimum threshold)
    const burntAccounts = accounts.filter(acc => acc.emailsSent >= 50 && acc.replyRate < 0.4);
    const healthyAccounts = accounts.filter(acc => acc.emailsSent >= 50 && acc.replyRate >= 0.4);
    const lowVolumeAccounts = accounts.filter(acc => acc.emailsSent < 50);
    const highVolumeAccounts = accounts.filter(acc => acc.emailsSent >= 50);

    const analysis = {
      domain,
      totalAccounts: accounts.length,
      burntAccounts: burntAccounts.length,
      healthyAccounts: healthyAccounts.length,
      lowVolumeAccounts: lowVolumeAccounts.length,
      totalSent,
      totalReplied,
      avgReplyRate,
      workspaces: Array.from(domainData.workspaces).join('; '),
      accounts: accounts,
      burntAccountsList: burntAccounts,
      healthyAccountsList: healthyAccounts,
      lowVolumeAccountsList: lowVolumeAccounts
    };

    // Classify domain
    if (totalSent === 0) {
      analysis.classification = 'NEVER_USED';
      lowVolumeDomains.push(analysis);
    } else if (highVolumeAccounts.length === 0) {
      analysis.classification = 'LOW_VOLUME';
      lowVolumeDomains.push(analysis);
    } else if (burntAccounts.length === highVolumeAccounts.length && burntAccounts.length > 0) {
      analysis.classification = 'ALL_BURNT';
      burntDomains.push(analysis);
    } else if (burntAccounts.length > 0 && healthyAccounts.length > 0) {
      analysis.classification = 'MIXED';
      mixedDomains.push(analysis);
    } else {
      analysis.classification = 'HEALTHY';
      healthyDomains.push(analysis);
    }
  });

  // Sort by total sent (highest first)
  burntDomains.sort((a, b) => b.totalSent - a.totalSent);
  mixedDomains.sort((a, b) => b.totalSent - a.totalSent);
  healthyDomains.sort((a, b) => b.totalSent - a.totalSent);

  // Print summary
  console.log('='.repeat(80));
  console.log('📊 BURNT DOMAINS ANALYSIS - ALL WORKSPACES');
  console.log('='.repeat(80));
  console.log(`Total unique domains: ${domainMap.size}`);
  console.log(`Total active accounts: ${allAccounts.length}`);
  console.log('');
  console.log(`  🔥 ALL BURNT domains (all accounts <0.4%): ${burntDomains.length}`);
  console.log(`  ⚠️  MIXED domains (some burnt, some healthy): ${mixedDomains.length}`);
  console.log(`  ✅ HEALTHY domains (all accounts >=0.4%): ${healthyDomains.length}`);
  console.log(`  📊 LOW VOLUME domains (<50 emails sent): ${lowVolumeDomains.length}`);
  console.log('');

  // Generate CSV reports
  generateBurntDomainsReport(burntDomains, mixedDomains, healthyDomains, lowVolumeDomains);

  return { burntDomains, mixedDomains, healthyDomains, lowVolumeDomains };
}

function generateBurntDomainsReport(burntDomains, mixedDomains, healthyDomains, lowVolumeDomains) {
  console.log('📝 Generating CSV reports...\n');

  // 1. ALL BURNT DOMAINS WITH ACCOUNTS
  const burntCSV = [
    'Domain,Classification,Workspace(s),Total Accounts,Burnt Accounts,Healthy Accounts,Low Volume Accounts,Total Sent,Total Replied,Avg Reply Rate %,Account Email,Account Workspace,Account Sent,Account Replied,Account Reply Rate %,Account Provider,Account Reseller'
  ];

  burntDomains.forEach(d => {
    d.accounts.forEach((acc, index) => {
      const accountStatus = acc.emailsSent < 50 ? 'LOW_VOLUME' : (acc.replyRate < 0.4 ? 'BURNT' : 'HEALTHY');

      if (index === 0) {
        // First row includes domain info
        burntCSV.push([
          d.domain,
          d.classification,
          d.workspaces,
          d.totalAccounts,
          d.burntAccounts,
          d.healthyAccounts,
          d.lowVolumeAccounts,
          d.totalSent,
          d.totalReplied,
          d.avgReplyRate.toFixed(2),
          acc.email,
          acc.workspace || 'Unknown',
          acc.emailsSent,
          acc.totalReplied,
          acc.replyRate.toFixed(2),
          acc.provider || 'Unknown',
          acc.reseller || 'Unknown'
        ].join(','));
      } else {
        // Subsequent rows have domain info empty
        burntCSV.push([
          '', '', '', '', '', '', '', '', '', '',
          acc.email,
          acc.workspace || 'Unknown',
          acc.emailsSent,
          acc.totalReplied,
          acc.replyRate.toFixed(2),
          acc.provider || 'Unknown',
          acc.reseller || 'Unknown'
        ].join(','));
      }
    });
  });

  fs.writeFileSync('ALL-BURNT-DOMAINS-WITH-ACCOUNTS.csv', burntCSV.join('\n'));

  // 2. MIXED DOMAINS WITH ACCOUNTS (domains with some burnt accounts)
  const mixedCSV = [
    'Domain,Classification,Workspace(s),Total Accounts,Burnt Accounts,Healthy Accounts,Low Volume Accounts,Total Sent,Total Replied,Avg Reply Rate %,Account Email,Account Workspace,Account Sent,Account Replied,Account Reply Rate %,Account Status,Account Provider,Account Reseller'
  ];

  mixedDomains.forEach(d => {
    d.accounts.forEach((acc, index) => {
      const accountStatus = acc.emailsSent < 50 ? 'LOW_VOLUME' : (acc.replyRate < 0.4 ? 'BURNT' : 'HEALTHY');

      if (index === 0) {
        mixedCSV.push([
          d.domain,
          d.classification,
          d.workspaces,
          d.totalAccounts,
          d.burntAccounts,
          d.healthyAccounts,
          d.lowVolumeAccounts,
          d.totalSent,
          d.totalReplied,
          d.avgReplyRate.toFixed(2),
          acc.email,
          acc.workspace || 'Unknown',
          acc.emailsSent,
          acc.totalReplied,
          acc.replyRate.toFixed(2),
          accountStatus,
          acc.provider || 'Unknown',
          acc.reseller || 'Unknown'
        ].join(','));
      } else {
        mixedCSV.push([
          '', '', '', '', '', '', '', '', '', '',
          acc.email,
          acc.workspace || 'Unknown',
          acc.emailsSent,
          acc.totalReplied,
          acc.replyRate.toFixed(2),
          accountStatus,
          acc.provider || 'Unknown',
          acc.reseller || 'Unknown'
        ].join(','));
      }
    });
  });

  fs.writeFileSync('MIXED-DOMAINS-WITH-ACCOUNTS.csv', mixedCSV.join('\n'));

  // 3. SUMMARY - BURNT AND MIXED DOMAINS ONLY (simplified)
  const summaryCSV = [
    'Domain,Classification,Workspace(s),Total Accounts,Burnt Accounts,Healthy Accounts,Low Volume Accounts,Total Sent,Total Replied,Avg Reply Rate %,Burnt Account Emails'
  ];

  [...burntDomains, ...mixedDomains].forEach(d => {
    const burntEmails = d.burntAccountsList.map(acc => acc.email).join('; ');
    summaryCSV.push([
      d.domain,
      d.classification,
      d.workspaces,
      d.totalAccounts,
      d.burntAccounts,
      d.healthyAccounts,
      d.lowVolumeAccounts,
      d.totalSent,
      d.totalReplied,
      d.avgReplyRate.toFixed(2),
      burntEmails
    ].join(','));
  });

  fs.writeFileSync('BURNT-DOMAINS-SUMMARY.csv', summaryCSV.join('\n'));

  // 4. COMPLETE OVERVIEW - ALL DOMAINS
  const completeCSV = [
    'Domain,Classification,Workspace(s),Total Accounts,Burnt Accounts,Healthy Accounts,Low Volume Accounts,Total Sent,Total Replied,Avg Reply Rate %'
  ];

  [...burntDomains, ...mixedDomains, ...healthyDomains, ...lowVolumeDomains].forEach(d => {
    completeCSV.push([
      d.domain,
      d.classification,
      d.workspaces,
      d.totalAccounts,
      d.burntAccounts,
      d.healthyAccounts,
      d.lowVolumeAccounts,
      d.totalSent,
      d.totalReplied,
      d.avgReplyRate.toFixed(2)
    ].join(','));
  });

  fs.writeFileSync('ALL-DOMAINS-COMPLETE-OVERVIEW.csv', completeCSV.join('\n'));

  console.log('✅ Generated CSV files:');
  console.log(`   1. ALL-BURNT-DOMAINS-WITH-ACCOUNTS.csv (${burntDomains.length} burnt domains with all accounts)`);
  console.log(`   2. MIXED-DOMAINS-WITH-ACCOUNTS.csv (${mixedDomains.length} mixed domains with all accounts)`);
  console.log(`   3. BURNT-DOMAINS-SUMMARY.csv (${burntDomains.length + mixedDomains.length} domains summary with burnt emails)`);
  console.log(`   4. ALL-DOMAINS-COMPLETE-OVERVIEW.csv (complete overview of all domains)`);
  console.log('');

  if (burntDomains.length > 0) {
    console.log('🔥 Top 10 Burnt Domains:');
    burntDomains.slice(0, 10).forEach((d, i) => {
      console.log(`   ${i + 1}. ${d.domain} - ${d.totalAccounts} accounts, ${d.totalSent} sent, ${d.avgReplyRate.toFixed(2)}% avg rate`);
    });
    console.log('');
  }

  if (mixedDomains.length > 0) {
    console.log('⚠️  Top 10 Mixed Domains (with burnt accounts):');
    mixedDomains.slice(0, 10).forEach((d, i) => {
      console.log(`   ${i + 1}. ${d.domain} - ${d.burntAccounts}/${d.totalAccounts} burnt, ${d.avgReplyRate.toFixed(2)}% avg rate`);
    });
    console.log('');
  }
}

analyzeBurntDomainsAllWorkspaces().catch(console.error);
