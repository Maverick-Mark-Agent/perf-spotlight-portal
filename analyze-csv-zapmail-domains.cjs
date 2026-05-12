const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, anonKey);

// Read domains from CSV
function extractDomainsFromCSV() {
  console.log('📋 Reading CSV file to extract domains...\n');

  const csvContent = fs.readFileSync('./email_accounts_with_tags.csv', 'utf8');
  const lines = csvContent.split('\n').slice(1);

  const domains = new Set();
  const emailsByDomain = {};

  lines.forEach(line => {
    if (!line.trim()) return;

    const match = line.match(/"([^"]+)","([^"]+)","([^"]+)"/);
    if (!match) return;

    const [, email, provider, reseller] = match;

    // Only Microsoft Zapmail accounts
    if (provider !== 'Microsoft' || reseller !== 'Zapmail') return;

    const domain = email.split('@')[1];
    if (!domain) return;

    domains.add(domain);

    if (!emailsByDomain[domain]) {
      emailsByDomain[domain] = [];
    }
    emailsByDomain[domain].push(email);
  });

  console.log(`✅ Found ${domains.size} unique Microsoft Zapmail domains from CSV\n`);
  console.log('Sample domains:');
  Array.from(domains).slice(0, 5).forEach(d => console.log(`   - ${d}`));
  console.log('');

  return { domains: Array.from(domains), emailsByDomain };
}

async function analyzeCSVDomains() {
  const { domains, emailsByDomain } = extractDomainsFromCSV();

  console.log('🔍 Fetching data from Supabase for these domains...\n');

  const results = {
    burnt: [],
    healthy: [],
    mixed: [],
    lowVolume: [],
    notInDB: []
  };

  for (const domain of domains) {
    // Fetch ALL accounts for this domain (not just the ones in CSV)
    const { data: accounts, error } = await supabase
      .from('sender_emails_cache')
      .select('email_address, emails_sent_count, total_replied_count, reply_rate_percentage, workspace_name, status, reseller')
      .ilike('email_address', `%@${domain}`);

    if (error) {
      console.error(`❌ Error fetching ${domain}:`, error.message);
      continue;
    }

    const mailboxes = accounts || [];

    if (mailboxes.length === 0) {
      results.notInDB.push({
        domain,
        reason: 'Domain not found in database',
        csvEmails: emailsByDomain[domain]
      });
      console.log(`❌ NOT IN DB: ${domain}`);
      continue;
    }

    // Calculate stats
    const totalSent = mailboxes.reduce((sum, mb) => sum + (mb.emails_sent_count || 0), 0);
    const totalReplied = mailboxes.reduce((sum, mb) => sum + (mb.total_replied_count || 0), 0);
    const avgReplyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;

    // Categorize mailboxes
    const burntMailboxes = mailboxes.filter(mb => {
      const sent = mb.emails_sent_count || 0;
      const replyRate = mb.reply_rate_percentage || 0;
      return sent >= 50 && replyRate < 0.4;
    });

    const healthyMailboxes = mailboxes.filter(mb => {
      const sent = mb.emails_sent_count || 0;
      const replyRate = mb.reply_rate_percentage || 0;
      return sent >= 50 && replyRate >= 0.4;
    });

    const lowVolumeMailboxes = mailboxes.filter(mb => (mb.emails_sent_count || 0) < 50);
    const highVolumeMailboxes = mailboxes.filter(mb => (mb.emails_sent_count || 0) >= 50);

    const domainData = {
      domain,
      totalMailboxes: mailboxes.length,
      burntMailboxes: burntMailboxes.length,
      healthyMailboxes: healthyMailboxes.length,
      lowVolumeMailboxes: lowVolumeMailboxes.length,
      totalSent,
      totalReplied,
      avgReplyRate,
      csvEmails: emailsByDomain[domain],
      mailboxDetails: mailboxes.map(mb => ({
        email: mb.email_address,
        sent: mb.emails_sent_count || 0,
        replied: mb.total_replied_count || 0,
        replyRate: mb.reply_rate_percentage || 0,
        workspace: mb.workspace_name,
        status: mb.status,
        inCSV: emailsByDomain[domain].includes(mb.email_address)
      }))
    };

    // Classify
    if (totalSent === 0) {
      domainData.classification = 'NEVER_USED';
      results.lowVolume.push(domainData);
      console.log(`⚠️  NEVER USED: ${domain} (${mailboxes.length} mailboxes, 0 emails sent)`);
    } else if (highVolumeMailboxes.length === 0) {
      domainData.classification = 'LOW_VOLUME';
      results.lowVolume.push(domainData);
      console.log(`⚠️  LOW VOLUME: ${domain} (${mailboxes.length} mailboxes, all <50 sent)`);
    } else if (burntMailboxes.length === highVolumeMailboxes.length && burntMailboxes.length > 0) {
      domainData.classification = 'ALL_BURNT';
      results.burnt.push(domainData);
      console.log(`🔥 ALL BURNT: ${domain} (${burntMailboxes.length}/${highVolumeMailboxes.length} mailboxes <0.4%)`);
    } else if (burntMailboxes.length > 0 && healthyMailboxes.length > 0) {
      domainData.classification = 'MIXED';
      results.mixed.push(domainData);
      console.log(`⚠️  MIXED: ${domain} (${burntMailboxes.length} burnt, ${healthyMailboxes.length} healthy)`);
    } else {
      domainData.classification = 'HEALTHY';
      results.healthy.push(domainData);
      console.log(`✅ HEALTHY: ${domain} (${healthyMailboxes.length} mailboxes, all >=0.4%)`);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 MICROSOFT ZAPMAIL DOMAINS ANALYSIS');
  console.log('='.repeat(70));
  console.log(`Total domains from CSV: ${domains.length}`);
  console.log(`  🔥 ALL BURNT: ${results.burnt.length}`);
  console.log(`  ⚠️  MIXED: ${results.mixed.length}`);
  console.log(`  ✅ HEALTHY: ${results.healthy.length}`);
  console.log(`  ⚠️  LOW VOLUME / NEVER USED: ${results.lowVolume.length}`);
  console.log(`  ❌ NOT IN DATABASE: ${results.notInDB.length}`);
  console.log('');

  // Generate CSV files
  generateReports(results);
}

function generateReports(results) {
  console.log('📝 Generating CSV reports...\n');

  // 1. Summary CSV
  const summaryCSV = [
    'Domain,Classification,Total Mailboxes,Burnt Mailboxes,Healthy Mailboxes,Low Volume Mailboxes,Total Sent,Total Replied,Avg Reply Rate %,CSV Emails'
  ];

  [...results.burnt, ...results.mixed, ...results.healthy, ...results.lowVolume].forEach(d => {
    summaryCSV.push([
      d.domain,
      d.classification,
      d.totalMailboxes,
      d.burntMailboxes,
      d.healthyMailboxes,
      d.lowVolumeMailboxes,
      d.totalSent,
      d.totalReplied,
      d.avgReplyRate.toFixed(2),
      `"${d.csvEmails.join('; ')}"`
    ].join(','));
  });

  fs.writeFileSync('CSV-ZAPMAIL-DOMAINS-SUMMARY.csv', summaryCSV.join('\n'));

  // 2. Burnt domains only
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

  fs.writeFileSync('CSV-ZAPMAIL-BURNT-DOMAINS.csv', burntCSV.join('\n'));

  // 3. Healthy domains only
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

  fs.writeFileSync('CSV-ZAPMAIL-HEALTHY-DOMAINS.csv', healthyCSV.join('\n'));

  // 4. Detailed mailbox breakdown
  const detailedCSV = [
    'Domain,Domain Status,Mailbox Email,In CSV,Workspace,Emails Sent,Replies,Reply Rate %,Mailbox Status'
  ];

  [...results.burnt, ...results.mixed, ...results.healthy, ...results.lowVolume].forEach(d => {
    d.mailboxDetails.forEach(mb => {
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
        mb.inCSV ? 'YES' : 'NO',
        mb.workspace || 'Unknown',
        mb.sent,
        mb.replied,
        mb.replyRate.toFixed(2),
        mailboxStatus
      ].join(','));
    });
  });

  fs.writeFileSync('CSV-ZAPMAIL-DETAILED-REPORT.csv', detailedCSV.join('\n'));

  console.log('✅ Generated CSV files:');
  console.log(`   - CSV-ZAPMAIL-DOMAINS-SUMMARY.csv (all ${results.burnt.length + results.mixed.length + results.healthy.length + results.lowVolume.length} domains)`);
  console.log(`   - CSV-ZAPMAIL-BURNT-DOMAINS.csv (${results.burnt.length} burnt domains)`);
  console.log(`   - CSV-ZAPMAIL-HEALTHY-DOMAINS.csv (${results.healthy.length} healthy domains)`);
  console.log(`   - CSV-ZAPMAIL-DETAILED-REPORT.csv (mailbox-level details)`);
  console.log('');
}

analyzeCSVDomains().catch(console.error);
