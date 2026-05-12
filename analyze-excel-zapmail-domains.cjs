const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, anonKey);

// Read domains from converted CSV
function extractDomainsFromCSV() {
  console.log('📋 Reading domains from Excel CSV...\n');

  const csvContent = fs.readFileSync('./zapmail-domains-from-excel.csv', 'utf8');
  const lines = csvContent.split('\n').slice(1); // Skip header

  const domainData = [];

  lines.forEach(line => {
    if (!line.trim()) return;

    const parts = line.split(',');
    if (parts.length < 3) return;

    const domain = parts[0].trim();
    const mailboxCount = parseInt(parts[1]) || 0;
    const purchaseType = parts[2].trim();

    if (domain && domain !== 'Domain') {
      domainData.push({
        domain,
        expectedMailboxes: mailboxCount,
        purchaseType
      });
    }
  });

  console.log(`✅ Found ${domainData.length} domains in Excel file\n`);
  return domainData;
}

async function analyzeExcelDomains() {
  const domainData = extractDomainsFromCSV();

  console.log('🔍 Analyzing each domain from Supabase database...\n');
  console.log('This may take a few minutes...\n');

  const results = {
    burnt: [],
    healthy: [],
    mixed: [],
    lowVolume: [],
    notInDB: []
  };

  let processed = 0;

  for (const domainInfo of domainData) {
    const { domain, expectedMailboxes, purchaseType } = domainInfo;

    // Fetch ALL accounts for this domain
    const { data: accounts, error } = await supabase
      .from('sender_emails_cache')
      .select('email_address, emails_sent_count, total_replied_count, reply_rate_percentage, workspace_name, status, reseller')
      .ilike('email_address', `%@${domain}`);

    processed++;
    if (processed % 50 === 0) {
      console.log(`   Progress: ${processed}/${domainData.length} domains processed...`);
    }

    if (error) {
      console.error(`❌ Error fetching ${domain}:`, error.message);
      continue;
    }

    const mailboxes = accounts || [];

    if (mailboxes.length === 0) {
      results.notInDB.push({
        domain,
        expectedMailboxes,
        purchaseType,
        reason: 'Domain not found in database'
      });
      continue;
    }

    // Calculate stats
    const totalSent = mailboxes.reduce((sum, mb) => sum + (mb.emails_sent_count || 0), 0);
    const totalReplied = mailboxes.reduce((sum, mb) => sum + (mb.total_replied_count || 0), 0);
    const avgReplyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;

    // Categorize mailboxes (50 emails minimum threshold)
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

    const domainAnalysis = {
      domain,
      expectedMailboxes,
      actualMailboxes: mailboxes.length,
      purchaseType,
      burntMailboxes: burntMailboxes.length,
      healthyMailboxes: healthyMailboxes.length,
      lowVolumeMailboxes: lowVolumeMailboxes.length,
      totalSent,
      totalReplied,
      avgReplyRate,
      mailboxDetails: mailboxes.map(mb => ({
        email: mb.email_address,
        sent: mb.emails_sent_count || 0,
        replied: mb.total_replied_count || 0,
        replyRate: mb.reply_rate_percentage || 0,
        workspace: mb.workspace_name,
        status: mb.status
      }))
    };

    // Classify
    if (totalSent === 0) {
      domainAnalysis.classification = 'NEVER_USED';
      results.lowVolume.push(domainAnalysis);
    } else if (highVolumeMailboxes.length === 0) {
      domainAnalysis.classification = 'LOW_VOLUME';
      results.lowVolume.push(domainAnalysis);
    } else if (burntMailboxes.length === highVolumeMailboxes.length && burntMailboxes.length > 0) {
      domainAnalysis.classification = 'ALL_BURNT';
      results.burnt.push(domainAnalysis);
    } else if (burntMailboxes.length > 0 && healthyMailboxes.length > 0) {
      domainAnalysis.classification = 'MIXED';
      results.mixed.push(domainAnalysis);
    } else {
      domainAnalysis.classification = 'HEALTHY';
      results.healthy.push(domainAnalysis);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 EXCEL FILE ZAPMAIL DOMAINS ANALYSIS');
  console.log('='.repeat(70));
  console.log(`Total domains from Excel: ${domainData.length}`);
  console.log(`  🔥 ALL BURNT (all mailboxes <0.4%): ${results.burnt.length}`);
  console.log(`  ⚠️  MIXED (some burnt, some healthy): ${results.mixed.length}`);
  console.log(`  ✅ HEALTHY (all mailboxes >=0.4%): ${results.healthy.length}`);
  console.log(`  ⚠️  LOW VOLUME / NEVER USED: ${results.lowVolume.length}`);
  console.log(`  ❌ NOT IN DATABASE: ${results.notInDB.length}`);
  console.log('');

  // Show burnt domains
  if (results.burnt.length > 0) {
    console.log('🔥 BURNT DOMAINS:');
    results.burnt.forEach(d => {
      console.log(`   - ${d.domain} (${d.totalSent} sent, ${d.avgReplyRate.toFixed(2)}% avg rate)`);
    });
    console.log('');
  }

  // Generate CSV files
  generateReports(results);

  return results;
}

function generateReports(results) {
  console.log('📝 Generating comprehensive CSV reports...\n');

  // 1. MAIN SUMMARY - All domains
  const summaryCSV = [
    'Domain,Classification,Expected Mailboxes,Actual Mailboxes,Burnt Mailboxes,Healthy Mailboxes,Low Volume Mailboxes,Total Sent,Total Replied,Avg Reply Rate %,Purchase Type'
  ];

  [...results.burnt, ...results.mixed, ...results.healthy, ...results.lowVolume].forEach(d => {
    summaryCSV.push([
      d.domain,
      d.classification,
      d.expectedMailboxes,
      d.actualMailboxes,
      d.burntMailboxes,
      d.healthyMailboxes,
      d.lowVolumeMailboxes,
      d.totalSent,
      d.totalReplied,
      d.avgReplyRate.toFixed(2),
      d.purchaseType
    ].join(','));
  });

  fs.writeFileSync('EXCEL-ZAPMAIL-COMPLETE-SUMMARY.csv', summaryCSV.join('\n'));

  // 2. BURNT DOMAINS ONLY
  const burntCSV = [
    'Domain,Expected Mailboxes,Actual Mailboxes,All Mailboxes Burnt,Total Sent,Total Replied,Avg Reply Rate %,Purchase Type'
  ];

  results.burnt.forEach(d => {
    burntCSV.push([
      d.domain,
      d.expectedMailboxes,
      d.actualMailboxes,
      d.burntMailboxes,
      d.totalSent,
      d.totalReplied,
      d.avgReplyRate.toFixed(2),
      d.purchaseType
    ].join(','));
  });

  fs.writeFileSync('EXCEL-ZAPMAIL-BURNT-DOMAINS.csv', burntCSV.join('\n'));

  // 3. HEALTHY DOMAINS ONLY
  const healthyCSV = [
    'Domain,Expected Mailboxes,Actual Mailboxes,Healthy Mailboxes,Total Sent,Total Replied,Avg Reply Rate %,Purchase Type'
  ];

  results.healthy.forEach(d => {
    healthyCSV.push([
      d.domain,
      d.expectedMailboxes,
      d.actualMailboxes,
      d.healthyMailboxes,
      d.totalSent,
      d.totalReplied,
      d.avgReplyRate.toFixed(2),
      d.purchaseType
    ].join(','));
  });

  fs.writeFileSync('EXCEL-ZAPMAIL-HEALTHY-DOMAINS.csv', healthyCSV.join('\n'));

  // 4. DETAILED MAILBOX BREAKDOWN
  const detailedCSV = [
    'Domain,Domain Status,Expected Mailboxes,Actual Mailboxes,Purchase Type,Mailbox Email,Workspace,Emails Sent,Replies,Reply Rate %,Mailbox Status'
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
        d.expectedMailboxes,
        d.actualMailboxes,
        d.purchaseType,
        mb.email,
        mb.workspace || 'Unknown',
        mb.sent,
        mb.replied,
        mb.replyRate.toFixed(2),
        mailboxStatus
      ].join(','));
    });
  });

  fs.writeFileSync('EXCEL-ZAPMAIL-DETAILED-MAILBOXES.csv', detailedCSV.join('\n'));

  // 5. NOT IN DATABASE
  if (results.notInDB.length > 0) {
    const notInDBCSV = [
      'Domain,Expected Mailboxes,Purchase Type,Reason'
    ];

    results.notInDB.forEach(d => {
      notInDBCSV.push([
        d.domain,
        d.expectedMailboxes,
        d.purchaseType,
        d.reason
      ].join(','));
    });

    fs.writeFileSync('EXCEL-ZAPMAIL-NOT-IN-DATABASE.csv', notInDBCSV.join('\n'));
  }

  console.log('✅ Generated CSV files:');
  console.log(`   - EXCEL-ZAPMAIL-COMPLETE-SUMMARY.csv (all domains overview)`);
  console.log(`   - EXCEL-ZAPMAIL-BURNT-DOMAINS.csv (${results.burnt.length} burnt domains)`);
  console.log(`   - EXCEL-ZAPMAIL-HEALTHY-DOMAINS.csv (${results.healthy.length} healthy domains)`);
  console.log(`   - EXCEL-ZAPMAIL-DETAILED-MAILBOXES.csv (mailbox-level breakdown)`);
  if (results.notInDB.length > 0) {
    console.log(`   - EXCEL-ZAPMAIL-NOT-IN-DATABASE.csv (${results.notInDB.length} domains not found)`);
  }
  console.log('');
}

analyzeExcelDomains().catch(console.error);
