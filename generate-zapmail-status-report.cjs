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

  console.log(`✅ Found ${domains.size} unique Zapmail domains from your CSV\n`);
  return Array.from(domains);
}

async function generateReport() {
  const domains = extractZapmailDomains();

  console.log('🔍 Fetching mailbox data for each domain...\n');

  const report = [];

  for (const domain of domains) {
    // Fetch accounts for this domain
    const { data: accounts, error } = await supabase
      .from('sender_emails_cache')
      .select('email_address, emails_sent_count, total_replied_count, reply_rate_percentage, workspace_name, status, reseller')
      .ilike('email_address', `%@${domain}`);

    if (error) {
      console.error(`❌ Error fetching ${domain}:`, error.message);
      continue;
    }

    const mailboxes = accounts || [];

    // Calculate domain statistics
    const totalMailboxes = mailboxes.length;
    const totalSent = mailboxes.reduce((sum, mb) => sum + (mb.emails_sent_count || 0), 0);
    const totalReplied = mailboxes.reduce((sum, mb) => sum + (mb.total_replied_count || 0), 0);
    const avgReplyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;

    // Count burnt mailboxes (< 0.4% reply rate with 50+ sent)
    const burntMailboxes = mailboxes.filter(mb => {
      const sent = mb.emails_sent_count || 0;
      const replyRate = mb.reply_rate_percentage || 0;
      return sent >= 50 && replyRate < 0.4;
    });

    // Count healthy mailboxes (>= 0.4% reply rate with 50+ sent)
    const healthyMailboxes = mailboxes.filter(mb => {
      const sent = mb.emails_sent_count || 0;
      const replyRate = mb.reply_rate_percentage || 0;
      return sent >= 50 && replyRate >= 0.4;
    });

    // Count unused mailboxes (< 50 sent)
    const unusedMailboxes = mailboxes.filter(mb => {
      const sent = mb.emails_sent_count || 0;
      return sent < 50;
    });

    // Determine domain status
    let status;
    if (totalSent === 0) {
      status = 'NEVER USED - Brand new accounts, no emails sent yet';
    } else if (unusedMailboxes.length === totalMailboxes) {
      status = `LOW USAGE - All ${totalMailboxes} mailboxes have < 50 emails sent`;
    } else if (burntMailboxes.length === mailboxes.filter(mb => (mb.emails_sent_count || 0) >= 50).length && burntMailboxes.length > 0) {
      status = `🔥 BURNT - All active mailboxes have <0.4% reply rate`;
    } else if (burntMailboxes.length > 0 && healthyMailboxes.length > 0) {
      status = `⚠️ MIXED - ${burntMailboxes.length} burnt, ${healthyMailboxes.length} healthy`;
    } else if (healthyMailboxes.length > 0) {
      status = `✅ HEALTHY - All active mailboxes have >=0.4% reply rate`;
    } else {
      status = `UNKNOWN`;
    }

    report.push({
      domain,
      status,
      totalMailboxes,
      burntMailboxes: burntMailboxes.length,
      healthyMailboxes: healthyMailboxes.length,
      unusedMailboxes: unusedMailboxes.length,
      totalSent,
      totalReplied,
      avgReplyRate,
      mailboxDetails: mailboxes
    });

    console.log(`${domain}:`);
    console.log(`  Status: ${status}`);
    console.log(`  Mailboxes: ${totalMailboxes} total (${burntMailboxes.length} burnt, ${healthyMailboxes.length} healthy, ${unusedMailboxes.length} unused)`);
    console.log(`  Volume: ${totalSent} sent, ${totalReplied} replied (${avgReplyRate.toFixed(2)}% avg reply rate)`);
    console.log('');
  }

  // Generate Summary CSV
  const summaryCSV = [
    'Domain,Status,Total Mailboxes,Burnt Mailboxes,Healthy Mailboxes,Unused Mailboxes (<50 sent),Total Sent,Total Replied,Avg Reply Rate %'
  ];

  report.forEach(r => {
    summaryCSV.push([
      r.domain,
      `"${r.status}"`,
      r.totalMailboxes,
      r.burntMailboxes,
      r.healthyMailboxes,
      r.unusedMailboxes,
      r.totalSent,
      r.totalReplied,
      r.avgReplyRate.toFixed(2)
    ].join(','));
  });

  fs.writeFileSync('zapmail-domain-status-summary.csv', summaryCSV.join('\n'));

  // Generate Detailed CSV
  const detailedCSV = [
    'Domain,Domain Status,Mailbox Email,Workspace,Emails Sent,Replies,Reply Rate %,Mailbox Status,Reseller'
  ];

  report.forEach(r => {
    r.mailboxDetails.forEach(mb => {
      const sent = mb.emails_sent_count || 0;
      const replied = mb.total_replied_count || 0;
      const replyRate = mb.reply_rate_percentage || 0;

      let mailboxStatus;
      if (sent === 0) {
        mailboxStatus = 'NEVER USED';
      } else if (sent < 50) {
        mailboxStatus = 'LOW USAGE';
      } else if (replyRate < 0.4) {
        mailboxStatus = '🔥 BURNT';
      } else {
        mailboxStatus = '✅ HEALTHY';
      }

      detailedCSV.push([
        r.domain,
        `"${r.status}"`,
        mb.email_address,
        mb.workspace_name || 'Unknown',
        sent,
        replied,
        replyRate.toFixed(2),
        mailboxStatus,
        mb.reseller || 'Unknown'
      ].join(','));
    });
  });

  fs.writeFileSync('zapmail-detailed-mailbox-report.csv', detailedCSV.join('\n'));

  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));

  const neverUsed = report.filter(r => r.totalSent === 0);
  const lowUsage = report.filter(r => r.totalSent > 0 && r.unusedMailboxes === r.totalMailboxes);
  const burnt = report.filter(r => r.status.includes('BURNT'));
  const mixed = report.filter(r => r.status.includes('MIXED'));
  const healthy = report.filter(r => r.status.includes('HEALTHY'));

  console.log(`Total domains analyzed: ${report.length}`);
  console.log(`  - ⚠️  NEVER USED (0 emails sent): ${neverUsed.length}`);
  console.log(`  - ⚠️  LOW USAGE (all mailboxes <50 sent): ${lowUsage.length}`);
  console.log(`  - 🔥 BURNT (all active mailboxes <0.4% reply rate): ${burnt.length}`);
  console.log(`  - ⚠️  MIXED (some burnt, some healthy): ${mixed.length}`);
  console.log(`  - ✅ HEALTHY (all active mailboxes >=0.4% reply rate): ${healthy.length}`);
  console.log('');
  console.log('✅ Generated CSV files:');
  console.log('   - zapmail-domain-status-summary.csv (domain-level summary)');
  console.log('   - zapmail-detailed-mailbox-report.csv (mailbox-level details)');
  console.log('');
}

generateReport().catch(console.error);
