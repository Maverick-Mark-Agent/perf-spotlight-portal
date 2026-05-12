const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, anonKey);

async function analyzeAllZapmailDomains() {
  console.log('🔍 Fetching ALL Zapmail accounts from database...\n');

  // Fetch ALL Zapmail accounts (using reseller field)
  const { data: allZapmailAccounts, error } = await supabase
    .from('sender_emails_cache')
    .select('email_address, emails_sent_count, total_replied_count, reply_rate_percentage, workspace_name, status, reseller, tags')
    .eq('reseller', 'Zapmail');

  if (error) {
    console.error('❌ Error fetching Zapmail accounts:', error.message);
    return;
  }

  console.log(`✅ Fetched ${allZapmailAccounts.length} Zapmail accounts from database\n`);

  // Group by domain
  const domainMap = {};

  allZapmailAccounts.forEach(account => {
    const domain = account.email_address?.split('@')[1];
    if (!domain) return;

    if (!domainMap[domain]) {
      domainMap[domain] = [];
    }

    domainMap[domain].push({
      email: account.email_address,
      sent: account.emails_sent_count || 0,
      replied: account.total_replied_count || 0,
      replyRate: account.reply_rate_percentage || 0,
      workspace: account.workspace_name,
      status: account.status,
      reseller: account.reseller
    });
  });

  const domains = Object.keys(domainMap);
  console.log(`📊 Found ${domains.length} unique Zapmail domains\n`);
  console.log('Analyzing each domain...\n');

  const results = {
    burnt: [],
    healthy: [],
    mixed: [],
    lowVolume: []
  };

  // Analyze each domain
  domains.forEach(domain => {
    const mailboxes = domainMap[domain];

    // Calculate stats
    const totalSent = mailboxes.reduce((sum, mb) => sum + mb.sent, 0);
    const totalReplied = mailboxes.reduce((sum, mb) => sum + mb.replied, 0);
    const avgReplyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;

    // Categorize mailboxes (using 50 emails minimum threshold)
    const burntMailboxes = mailboxes.filter(mb => mb.sent >= 50 && mb.replyRate < 0.4);
    const healthyMailboxes = mailboxes.filter(mb => mb.sent >= 50 && mb.replyRate >= 0.4);
    const lowVolumeMailboxes = mailboxes.filter(mb => mb.sent < 50);
    const highVolumeMailboxes = mailboxes.filter(mb => mb.sent >= 50);

    const domainData = {
      domain,
      totalMailboxes: mailboxes.length,
      burntMailboxes: burntMailboxes.length,
      healthyMailboxes: healthyMailboxes.length,
      lowVolumeMailboxes: lowVolumeMailboxes.length,
      totalSent,
      totalReplied,
      avgReplyRate,
      mailboxes
    };

    // Classify domain
    if (highVolumeMailboxes.length === 0) {
      // All mailboxes have < 50 sent
      domainData.classification = 'LOW_VOLUME';
      results.lowVolume.push(domainData);
    } else if (burntMailboxes.length === highVolumeMailboxes.length && burntMailboxes.length > 0) {
      // All active mailboxes are burnt
      domainData.classification = 'ALL_BURNT';
      results.burnt.push(domainData);
      console.log(`🔥 BURNT: ${domain} (${burntMailboxes.length} mailboxes, all <0.4% reply rate)`);
    } else if (burntMailboxes.length > 0 && healthyMailboxes.length > 0) {
      // Some burnt, some healthy
      domainData.classification = 'MIXED';
      results.mixed.push(domainData);
      console.log(`⚠️  MIXED: ${domain} (${burntMailboxes.length} burnt, ${healthyMailboxes.length} healthy)`);
    } else {
      // All active mailboxes are healthy
      domainData.classification = 'HEALTHY';
      results.healthy.push(domainData);
      console.log(`✅ HEALTHY: ${domain} (${healthyMailboxes.length} mailboxes, all >=0.4% reply rate)`);
    }
  });

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Zapmail domains: ${domains.length}`);
  console.log(`  🔥 ALL BURNT (all mailboxes <0.4%): ${results.burnt.length}`);
  console.log(`  ⚠️  MIXED (some burnt, some healthy): ${results.mixed.length}`);
  console.log(`  ✅ HEALTHY (all mailboxes >=0.4%): ${results.healthy.length}`);
  console.log(`  ⚠️  LOW VOLUME (all <50 sent): ${results.lowVolume.length}`);
  console.log('');

  // Generate CSV files
  generateCSVReports(results);
}

function generateCSVReports(results) {
  console.log('📝 Generating CSV reports...\n');

  // 1. BURNT DOMAINS (all mailboxes burnt)
  const burntCSV = [
    'Domain,Total Mailboxes,Burnt Mailboxes,Total Sent,Total Replied,Avg Reply Rate %'
  ];

  results.burnt.forEach(d => {
    burntCSV.push([
      d.domain,
      d.totalMailboxes,
      d.burntMailboxes,
      d.totalSent,
      d.totalReplied,
      d.avgReplyRate.toFixed(2)
    ].join(','));
  });

  fs.writeFileSync('ALL-ZAPMAIL-BURNT-DOMAINS.csv', burntCSV.join('\n'));

  // 2. HEALTHY DOMAINS
  const healthyCSV = [
    'Domain,Total Mailboxes,Healthy Mailboxes,Total Sent,Total Replied,Avg Reply Rate %'
  ];

  results.healthy.forEach(d => {
    healthyCSV.push([
      d.domain,
      d.totalMailboxes,
      d.healthyMailboxes,
      d.totalSent,
      d.totalReplied,
      d.avgReplyRate.toFixed(2)
    ].join(','));
  });

  fs.writeFileSync('ALL-ZAPMAIL-HEALTHY-DOMAINS.csv', healthyCSV.join('\n'));

  // 3. DETAILED BREAKDOWN (ALL domains with mailbox details)
  const detailedCSV = [
    'Domain,Domain Status,Mailbox Email,Workspace,Emails Sent,Replies,Reply Rate %,Mailbox Status'
  ];

  [...results.burnt, ...results.mixed, ...results.healthy, ...results.lowVolume].forEach(d => {
    d.mailboxes.forEach(mb => {
      let mailboxStatus;
      if (mb.sent === 0) {
        mailboxStatus = 'NEVER USED';
      } else if (mb.sent < 50) {
        mailboxStatus = 'LOW USAGE';
      } else if (mb.replyRate < 0.4) {
        mailboxStatus = 'BURNT';
      } else {
        mailboxStatus = 'HEALTHY';
      }

      detailedCSV.push([
        d.domain,
        d.classification,
        mb.email,
        mb.workspace || 'Unknown',
        mb.sent,
        mb.replied,
        mb.replyRate.toFixed(2),
        mailboxStatus
      ].join(','));
    });
  });

  fs.writeFileSync('ALL-ZAPMAIL-DETAILED-REPORT.csv', detailedCSV.join('\n'));

  // 4. SUMMARY BY CLASSIFICATION
  const summaryCSV = [
    'Domain,Classification,Total Mailboxes,Burnt Mailboxes,Healthy Mailboxes,Low Volume Mailboxes,Total Sent,Total Replied,Avg Reply Rate %'
  ];

  [...results.burnt, ...results.mixed, ...results.healthy, ...results.lowVolume]
    .sort((a, b) => {
      // Sort: burnt first, then mixed, then healthy, then low volume
      const order = { 'ALL_BURNT': 0, 'MIXED': 1, 'HEALTHY': 2, 'LOW_VOLUME': 3 };
      return order[a.classification] - order[b.classification];
    })
    .forEach(d => {
      summaryCSV.push([
        d.domain,
        d.classification,
        d.totalMailboxes,
        d.burntMailboxes,
        d.healthyMailboxes,
        d.lowVolumeMailboxes,
        d.totalSent,
        d.totalReplied,
        d.avgReplyRate.toFixed(2)
      ].join(','));
    });

  fs.writeFileSync('ALL-ZAPMAIL-SUMMARY.csv', summaryCSV.join('\n'));

  console.log('✅ Generated CSV files:');
  console.log(`   - ALL-ZAPMAIL-BURNT-DOMAINS.csv (${results.burnt.length} burnt domains)`);
  console.log(`   - ALL-ZAPMAIL-HEALTHY-DOMAINS.csv (${results.healthy.length} healthy domains)`);
  console.log(`   - ALL-ZAPMAIL-SUMMARY.csv (all ${results.burnt.length + results.mixed.length + results.healthy.length + results.lowVolume.length} domains summary)`);
  console.log(`   - ALL-ZAPMAIL-DETAILED-REPORT.csv (mailbox-level details)`);
  console.log('');
}

analyzeAllZapmailDomains().catch(console.error);
