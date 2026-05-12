const fs = require('fs');
const https = require('https');

const BISON_API_KEY = '101|6mXfEtJkLDF99HcmvOqlJcjlYaDyt9pGt9c6C7qJ56e6298b';
const BISON_API_BASE = 'https://send.maverickmarketingllc.com/api';

// Read and parse the CSV file
function extractZapmailDomains() {
  console.log('📋 Reading CSV file...\n');

  const csvContent = fs.readFileSync('./email_accounts_with_tags.csv', 'utf8');
  const lines = csvContent.split('\n').slice(1); // Skip header

  const domains = new Set();
  const emailsByDomain = {};

  lines.forEach(line => {
    if (!line.trim()) return;

    // Parse CSV line (handle quoted fields)
    const match = line.match(/"([^"]+)","([^"]+)","([^"]+)"/);
    if (!match) return;

    const [, email, provider, reseller] = match;

    // Only process Zapmail accounts
    if (reseller !== 'Zapmail') return;

    const domain = email.split('@')[1];
    if (!domain) return;

    domains.add(domain);

    if (!emailsByDomain[domain]) {
      emailsByDomain[domain] = [];
    }
    emailsByDomain[domain].push(email);
  });

  console.log(`✅ Found ${domains.size} unique Zapmail domains\n`);
  console.log(`📊 Sample domains:`);
  Array.from(domains).slice(0, 5).forEach(d => console.log(`   - ${d}`));
  console.log('');

  return { domains: Array.from(domains), emailsByDomain };
}

// Make HTTPS request to Bison API
function bisonRequest(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BISON_API_BASE);

    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${BISON_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Get all sender emails from Bison with pagination
async function getAllSenderEmails() {
  console.log('🔍 Fetching all sender emails from Bison...\n');

  try {
    let allEmails = [];
    let page = 1;
    let hasMore = true;
    const perPage = 100;

    while (hasMore) {
      const response = await bisonRequest(`/sender-emails?per_page=${perPage}&page=${page}`);

      if (response.data && Array.isArray(response.data)) {
        allEmails = allEmails.concat(response.data);
        console.log(`   Fetched page ${page}: ${response.data.length} accounts (total: ${allEmails.length})`);

        // Check if there are more pages
        const meta = response.meta || response.pagination;
        if (meta && meta.current_page < meta.last_page) {
          page++;
        } else {
          hasMore = false;
        }
      } else {
        console.error('❌ Unexpected API response format:', response);
        hasMore = false;
      }
    }

    console.log(`\n✅ Fetched ${allEmails.length} total sender emails from Bison\n`);
    return allEmails;
  } catch (error) {
    console.error('❌ Error fetching sender emails:', error.message);
    return [];
  }
}

// Analyze domains and categorize as burnt or healthy
async function analyzeDomains() {
  const { domains, emailsByDomain } = extractZapmailDomains();

  // Get all sender emails from Bison
  const allSenderEmails = await getAllSenderEmails();

  if (allSenderEmails.length === 0) {
    console.error('❌ No data from Bison API. Cannot proceed.');
    return;
  }

  console.log('📊 Analyzing domains...\n');

  const results = {
    burnt: [],
    healthy: [],
    notFound: []
  };

  for (const domain of domains) {
    // Find all mailboxes for this domain
    const mailboxes = allSenderEmails.filter(account => {
      const accountDomain = account.email_address?.split('@')[1];
      return accountDomain === domain;
    });

    if (mailboxes.length === 0) {
      console.log(`⚠️  ${domain}: No mailboxes found in Bison`);
      results.notFound.push({
        domain,
        mailboxCount: 0,
        reason: 'Not found in Bison'
      });
      continue;
    }

    // Calculate reply rates for all mailboxes
    const mailboxStats = mailboxes.map(mb => {
      const sent = mb.emails_sent_count || 0;
      const replied = mb.total_replied_count || 0;
      const replyRate = sent > 0 ? (replied / sent) * 100 : 0;

      return {
        email: mb.email_address,
        sent,
        replied,
        replyRate,
        isBurnt: replyRate < 0.4 && sent >= 200
      };
    });

    // Check if domain is burnt (all mailboxes have <0.4% reply rate)
    const burntMailboxes = mailboxStats.filter(mb => mb.isBurnt);
    const healthyMailboxes = mailboxStats.filter(mb => !mb.isBurnt);

    const isDomainBurnt = burntMailboxes.length > 0 && healthyMailboxes.length === 0;

    const domainData = {
      domain,
      mailboxCount: mailboxes.length,
      burntMailboxCount: burntMailboxes.length,
      healthyMailboxCount: healthyMailboxes.length,
      mailboxes: mailboxStats,
      avgReplyRate: mailboxStats.reduce((sum, mb) => sum + mb.replyRate, 0) / mailboxStats.length
    };

    if (isDomainBurnt) {
      results.burnt.push(domainData);
      console.log(`🔥 BURNT: ${domain} (${mailboxes.length} mailboxes, all <0.4% reply rate)`);
    } else {
      results.healthy.push(domainData);
      console.log(`✅ HEALTHY: ${domain} (${mailboxes.length} mailboxes, ${healthyMailboxes.length} healthy)`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total domains analyzed: ${domains.length}`);
  console.log(`🔥 Burnt domains: ${results.burnt.length}`);
  console.log(`✅ Healthy domains: ${results.healthy.length}`);
  console.log(`⚠️  Not found in Bison: ${results.notFound.length}`);
  console.log('');

  // Generate CSV files
  generateCSVReports(results);

  return results;
}

// Generate CSV reports
function generateCSVReports(results) {
  console.log('📝 Generating CSV reports...\n');

  // Burnt domains CSV
  const burntCSV = [
    'Domain,Mailbox Count,Burnt Mailboxes,Avg Reply Rate %,Mailbox Details'
  ];

  results.burnt.forEach(domain => {
    const mailboxDetails = domain.mailboxes
      .map(mb => `${mb.email}:${mb.replyRate.toFixed(2)}%`)
      .join('; ');

    burntCSV.push([
      domain.domain,
      domain.mailboxCount,
      domain.burntMailboxCount,
      domain.avgReplyRate.toFixed(2),
      `"${mailboxDetails}"`
    ].join(','));
  });

  // Healthy domains CSV
  const healthyCSV = [
    'Domain,Mailbox Count,Burnt Mailboxes,Healthy Mailboxes,Avg Reply Rate %,Mailbox Details'
  ];

  results.healthy.forEach(domain => {
    const mailboxDetails = domain.mailboxes
      .map(mb => `${mb.email}:${mb.replyRate.toFixed(2)}%`)
      .join('; ');

    healthyCSV.push([
      domain.domain,
      domain.mailboxCount,
      domain.burntMailboxCount,
      domain.healthyMailboxCount,
      domain.avgReplyRate.toFixed(2),
      `"${mailboxDetails}"`
    ].join(','));
  });

  // Not found CSV
  const notFoundCSV = [
    'Domain,Status'
  ];

  results.notFound.forEach(domain => {
    notFoundCSV.push([
      domain.domain,
      domain.reason
    ].join(','));
  });

  // Write files
  fs.writeFileSync('zapmail-burnt-domains.csv', burntCSV.join('\n'));
  fs.writeFileSync('zapmail-healthy-domains.csv', healthyCSV.join('\n'));
  fs.writeFileSync('zapmail-notfound-domains.csv', notFoundCSV.join('\n'));

  console.log('✅ Generated CSV files:');
  console.log(`   - zapmail-burnt-domains.csv (${results.burnt.length} domains)`);
  console.log(`   - zapmail-healthy-domains.csv (${results.healthy.length} domains)`);
  console.log(`   - zapmail-notfound-domains.csv (${results.notFound.length} domains)`);
  console.log('');

  // Detailed breakdown CSV
  const detailedCSV = [
    'Domain,Status,Mailbox Email,Emails Sent,Replies,Reply Rate %,Is Burnt'
  ];

  [...results.burnt, ...results.healthy].forEach(domain => {
    const status = results.burnt.includes(domain) ? 'BURNT' : 'HEALTHY';
    domain.mailboxes.forEach(mb => {
      detailedCSV.push([
        domain.domain,
        status,
        mb.email,
        mb.sent,
        mb.replied,
        mb.replyRate.toFixed(2),
        mb.isBurnt ? 'YES' : 'NO'
      ].join(','));
    });
  });

  fs.writeFileSync('zapmail-detailed-analysis.csv', detailedCSV.join('\n'));
  console.log(`   - zapmail-detailed-analysis.csv (detailed mailbox breakdown)`);
  console.log('');
}

// Run the analysis
analyzeDomains().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
