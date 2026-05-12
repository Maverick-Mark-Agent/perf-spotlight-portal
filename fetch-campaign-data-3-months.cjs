// Configuration
const BISON_API_BASE_URL = 'https://send.maverickmarketingllc.com/api';
const BISON_API_KEY = '101|6mXfEtJkLDF99HcmvOqlJcjlYaDyt9pGt9c6C7qJ56e6298b';

// Workspaces to exclude
const EXCLUDED_WORKSPACES = [
  'SMA Insurance',
  'StreetSmart Commercial',
  'StreetSmart Trucking',
  'Shane Miller',
  'Jeff Schroder'
];

// Calculate date 3 months ago
const threeMonthsAgo = new Date();
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
const startDate = threeMonthsAgo.toISOString().split('T')[0];

console.log(`Fetching campaign data from ${startDate} to today...`);
console.log(`Excluding workspaces: ${EXCLUDED_WORKSPACES.join(', ')}\n`);

async function makeRequest(endpoint) {
  const url = `${BISON_API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${BISON_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Email Bison API error: ${response.status} - ${await response.text()}`);
  }

  return await response.json();
}

async function fetchAllWorkspaces() {
  console.log('Fetching all workspaces...');
  const response = await makeRequest('/workspaces/v1.1');
  return response.data || response || [];
}

async function fetchWorkspaceStats(startDate, endDate) {
  try {
    const response = await makeRequest(`/workspaces/v1.1/stats?start_date=${startDate}&end_date=${endDate}`);
    return response.data || response;
  } catch (error) {
    console.error(`  ⚠️  Could not fetch workspace stats: ${error.message}`);
    return null;
  }
}

async function main() {
  try {
    console.log('📊 Fetching workspace statistics from Email Bison API...\n');

    // Fetch stats for the 3-month period
    const stats = await fetchWorkspaceStats(startDate, new Date().toISOString().split('T')[0]);

    if (!stats) {
      console.error('❌ Failed to fetch workspace stats');
      process.exit(1);
    }

    console.log(`✅ Successfully fetched stats for the period ${startDate} to today\n`);
    console.log('Stats structure:', Object.keys(stats));
    console.log('\nRaw stats data:', JSON.stringify(stats, null, 2).substring(0, 1000), '...\n');

    // The stats are returned directly - extract the values
    const totalEmailsSent = stats.emails_sent || stats.sent || 0;
    const totalReplies = stats.replied || stats.unique_replies || stats.replies || 0;
    const overallReplyRate = totalEmailsSent > 0 ? ((totalReplies / totalEmailsSent) * 100).toFixed(2) : 0;

    // Generate report
    console.log('\n' + '='.repeat(80));
    console.log('CAMPAIGN DATA SUMMARY - LAST 3 MONTHS');
    console.log('='.repeat(80));
    console.log(`Period: ${startDate} to ${new Date().toISOString().split('T')[0]}`);
    console.log(`Note: This API key has access to a single workspace only`);
    console.log('='.repeat(80));
    console.log(`Total Emails Sent: ${totalEmailsSent.toLocaleString()}`);
    console.log(`Total Replies: ${totalReplies.toLocaleString()}`);
    console.log(`Overall Reply Rate: ${overallReplyRate}%`);
    console.log('='.repeat(80));

    // Save detailed report to JSON
    const report = {
      summary: {
        period_start: startDate,
        period_end: new Date().toISOString().split('T')[0],
        note: 'This data is from a single workspace API key - not all workspaces',
        total_emails_sent: totalEmailsSent,
        total_replies: totalReplies,
        overall_reply_rate: overallReplyRate + '%'
      },
      raw_stats: stats
    };

    const fs = require('fs');
    fs.writeFileSync('campaign-data-3-months.json', JSON.stringify(report, null, 2));
    console.log('\nDetailed report saved to: campaign-data-3-months.json');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
