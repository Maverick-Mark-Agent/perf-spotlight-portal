const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, anonKey);

// Read and parse the CSV file to get Zapmail domains
function extractZapmailDomains() {
  console.log('📋 Reading CSV file...\n');

  const csvContent = fs.readFileSync('./email_accounts_with_tags.csv', 'utf8');
  const lines = csvContent.split('\n').slice(1); // Skip header

  const domains = new Set();

  lines.forEach(line => {
    if (!line.trim()) return;

    // Parse CSV line (handle quoted fields)
    const match = line.match(/"([^"]+)","([^"]+)","([^"]+)"/);
    if (!match) return;

    const [, email, , reseller] = match;

    // Only process Zapmail accounts
    if (reseller !== 'Zapmail') return;

    const domain = email.split('@')[1];
    if (!domain) return;

    domains.add(domain);
  });

  console.log(`✅ Found ${domains.size} unique Zapmail domains\n`);
  console.log(`📊 Sample domains:`);
  Array.from(domains).slice(0, 5).forEach(d => console.log(`   - ${d}`));
  console.log('');

  return Array.from(domains);
}

// Get sender email data from Supabase
async function getSenderEmailsFromSupabase() {
  console.log('🔍 Fetching sender email data from Supabase database...\n');

  try {
    // Fetch all sender emails from the cache table
    const { data, error } = await supabase
      .from('sender_emails_cache')
      .select('email_address, emails_sent_count, total_replied_count, reply_rate_percentage, workspace_name, status, reseller');

    if (error) {
      console.error('❌ Error fetching from Supabase:', error.message);
      return [];
    }

    console.log(`✅ Fetched ${data.length} sender emails from Supabase\n`);
    return data;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return [];
  }
}

// Analyze domains and categorize as burnt or healthy
async function analyzeDomains() {
  const domains = extractZapmailDomains();
  const allSenderEmails = await getSenderEmailsFromSupabase();

  if (allSenderEmails.length === 0) {
    console.error('❌ No data from Supabase. Cannot proceed.');
    return;
  }

  console.log('📊 Analyzing domains...\n');

  const results = {
    burnt: [],
    healthy: [],
    notFound: [],
    mixed: []
  };

  for (const domain of domains) {
    // Find all mailboxes for this domain
    const mailboxes = allSenderEmails.filter(account => {
      const accountDomain = account.email_address?.split('@')[1];
      return accountDomain === domain;
    });

    if (mailboxes.length === 0) {
      console.log(`⚠️  ${domain}: No mailboxes found in database`);
      results.notFound.push({
        domain,
        mailboxCount: 0,
        reason: 'Not found in Supabase database'
      });
      continue;
    }

    // Calculate reply rates for all mailboxes
    const mailboxStats = mailboxes.map(mb => {
      const sent = mb.emails_sent_count || 0;
      const replied = mb.total_replied_count || 0;
      const replyRate = mb.reply_rate_percentage || (sent > 0 ? (replied / sent) * 100 : 0);

      return {
        email: mb.email_address,
        sent,
        replied,
        replyRate,
        workspace: mb.workspace_name,
        status: mb.status,
        reseller: mb.reseller,
        isBurnt: replyRate < 0.4 && sent >= 50  // Lowered threshold from 200 to 50
      };
    });

    // Categorize mailboxes
    const burntMailboxes = mailboxStats.filter(mb => mb.isBurnt);
    const healthyMailboxes = mailboxStats.filter(mb => !mb.isBurnt && mb.sent >= 50);
    const lowVolumeMailboxes = mailboxStats.filter(mb => mb.sent < 50);

    // Domain classification logic:
    // - ALL_BURNT: All mailboxes with 50+ sent have <0.4% reply rate
    // - HEALTHY: At least one mailbox with 50+ sent has >=0.4% reply rate
    // - MIXED: Some burnt, some healthy
    // - LOW_VOLUME: All mailboxes have <50 sent

    const highVolumeMailboxes = mailboxStats.filter(mb => mb.sent >= 50);

    let classification;
    if (highVolumeMailboxes.length === 0) {
      classification = 'LOW_VOLUME';
      results.notFound.push({
        domain,
        mailboxCount: mailboxes.length,
        reason: 'All mailboxes have < 50 emails sent (insufficient data)'
      });
    } else if (burntMailboxes.length === highVolumeMailboxes.length) {
      classification = 'ALL_BURNT';
    } else if (burntMailboxes.length > 0) {
      classification = 'MIXED';
    } else {
      classification = 'HEALTHY';
    }

    const domainData = {
      domain,
      classification,
      mailboxCount: mailboxes.length,
      burntMailboxCount: burntMailboxes.length,
      healthyMailboxCount: healthyMailboxes.length,
      lowVolumeMailboxCount: lowVolumeMailboxes.length,
      mailboxes: mailboxStats,
      avgReplyRate: mailboxStats.reduce((sum, mb) => sum + mb.replyRate, 0) / mailboxStats.length,
      totalSent: mailboxStats.reduce((sum, mb) => sum + mb.sent, 0),
      totalReplied: mailboxStats.reduce((sum, mb) => sum + mb.replied, 0)
    };

    if (classification === 'ALL_BURNT') {
      results.burnt.push(domainData);
      console.log(`🔥 BURNT: ${domain} (${highVolumeMailboxes.length} mailboxes, all <0.4% reply rate)`);
    } else if (classification === 'HEALTHY') {
      results.healthy.push(domainData);
      console.log(`✅ HEALTHY: ${domain} (${mailboxes.length} mailboxes, all healthy)`);
    } else if (classification === 'MIXED') {
      results.mixed.push(domainData);
      console.log(`⚠️  MIXED: ${domain} (${mailboxes.length} mailboxes: ${burntMailboxes.length} burnt, ${healthyMailboxes.length} healthy)`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total domains analyzed: ${domains.length}`);
  console.log(`🔥 ALL BURNT (all mailboxes burnt): ${results.burnt.length}`);
  console.log(`⚠️  MIXED (some burnt, some healthy): ${results.mixed.length}`);
  console.log(`✅ HEALTHY (no burnt mailboxes): ${results.healthy.length}`);
  console.log(`⚠️  LOW VOLUME / NOT FOUND: ${results.notFound.length}`);
  console.log('');

  // Generate CSV files
  generateCSVReports(results);

  return results;
}

// Generate CSV reports
function generateCSVReports(results) {
  console.log('📝 Generating CSV reports...\n');

  // 1. BURNT DOMAINS CSV (all mailboxes burnt)
  const burntCSV = [
    'Domain,Classification,Total Mailboxes,Burnt Mailboxes,Avg Reply Rate %,Total Sent,Total Replied,Mailbox Details'
  ];

  results.burnt.forEach(domain => {
    const mailboxDetails = domain.mailboxes
      .map(mb => `${mb.email}:${mb.sent}sent/${mb.replied}replied/${mb.replyRate.toFixed(2)}%`)
      .join('; ');

    burntCSV.push([
      domain.domain,
      domain.classification,
      domain.mailboxCount,
      domain.burntMailboxCount,
      domain.avgReplyRate.toFixed(2),
      domain.totalSent,
      domain.totalReplied,
      `"${mailboxDetails}"`
    ].join(','));
  });

  // 2. MIXED DOMAINS CSV (some burnt, some healthy)
  const mixedCSV = [
    'Domain,Classification,Total Mailboxes,Burnt Mailboxes,Healthy Mailboxes,Avg Reply Rate %,Total Sent,Total Replied,Mailbox Details'
  ];

  results.mixed.forEach(domain => {
    const mailboxDetails = domain.mailboxes
      .map(mb => `${mb.email}:${mb.sent}sent/${mb.replied}replied/${mb.replyRate.toFixed(2)}%${mb.isBurnt ? '[BURNT]' : ''}`)
      .join('; ');

    mixedCSV.push([
      domain.domain,
      domain.classification,
      domain.mailboxCount,
      domain.burntMailboxCount,
      domain.healthyMailboxCount,
      domain.avgReplyRate.toFixed(2),
      domain.totalSent,
      domain.totalReplied,
      `"${mailboxDetails}"`
    ].join(','));
  });

  // 3. HEALTHY DOMAINS CSV
  const healthyCSV = [
    'Domain,Classification,Total Mailboxes,Avg Reply Rate %,Total Sent,Total Replied,Mailbox Details'
  ];

  results.healthy.forEach(domain => {
    const mailboxDetails = domain.mailboxes
      .map(mb => `${mb.email}:${mb.sent}sent/${mb.replied}replied/${mb.replyRate.toFixed(2)}%`)
      .join('; ');

    healthyCSV.push([
      domain.domain,
      domain.classification,
      domain.mailboxCount,
      domain.avgReplyRate.toFixed(2),
      domain.totalSent,
      domain.totalReplied,
      `"${mailboxDetails}"`
    ].join(','));
  });

  // 4. NOT FOUND / LOW VOLUME CSV
  const notFoundCSV = [
    'Domain,Mailbox Count,Status,Reason'
  ];

  results.notFound.forEach(domain => {
    notFoundCSV.push([
      domain.domain,
      domain.mailboxCount,
      'NOT_FOUND',
      domain.reason
    ].join(','));
  });

  // 5. DETAILED BREAKDOWN CSV (all mailboxes)
  const detailedCSV = [
    'Domain,Domain Status,Mailbox Email,Workspace,Emails Sent,Replies,Reply Rate %,Is Burnt,Reseller'
  ];

  [...results.burnt, ...results.mixed, ...results.healthy].forEach(domain => {
    domain.mailboxes.forEach(mb => {
      detailedCSV.push([
        domain.domain,
        domain.classification,
        mb.email,
        mb.workspace || 'Unknown',
        mb.sent,
        mb.replied,
        mb.replyRate.toFixed(2),
        mb.isBurnt ? 'YES' : 'NO',
        mb.reseller || 'Unknown'
      ].join(','));
    });
  });

  // Write files
  fs.writeFileSync('zapmail-burnt-domains.csv', burntCSV.join('\n'));
  fs.writeFileSync('zapmail-mixed-domains.csv', mixedCSV.join('\n'));
  fs.writeFileSync('zapmail-healthy-domains.csv', healthyCSV.join('\n'));
  fs.writeFileSync('zapmail-notfound-domains.csv', notFoundCSV.join('\n'));
  fs.writeFileSync('zapmail-detailed-analysis.csv', detailedCSV.join('\n'));

  console.log('✅ Generated CSV files:');
  console.log(`   - zapmail-burnt-domains.csv (${results.burnt.length} domains - ALL mailboxes burnt)`);
  console.log(`   - zapmail-mixed-domains.csv (${results.mixed.length} domains - SOME mailboxes burnt)`);
  console.log(`   - zapmail-healthy-domains.csv (${results.healthy.length} domains - NO burnt mailboxes)`);
  console.log(`   - zapmail-notfound-domains.csv (${results.notFound.length} domains)`);
  console.log(`   - zapmail-detailed-analysis.csv (detailed mailbox breakdown)`);
  console.log('');
}

// Run the analysis
analyzeDomains().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
