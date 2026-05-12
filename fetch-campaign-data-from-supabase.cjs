#!/usr/bin/env node

/**
 * Fetch campaign data for the last 3 months from Supabase database
 * This queries the synced Email Bison data across ALL workspaces
 */

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODA5MTU2NywiZXhwIjoyMDQzNjY3NTY3fQ.k-ant-api03-5h09QQR7HYaS9f7vfCjENfm6qJ0qjbGnK2FNwDR3DeVwBM_Q6rw3ne7CTp6h2OBQOfrg9IBD6xnthj6hsYbVJQ-Sum12QAA';

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
const endDate = new Date().toISOString().split('T')[0];

console.log(`Fetching campaign data from ${startDate} to ${endDate}...`);
console.log(`Excluding workspaces: ${EXCLUDED_WORKSPACES.join(', ')}\n`);

async function supabaseGet(table, select, filters = {}) {
  const params = new URLSearchParams({ select });

  // Add filters
  Object.entries(filters).forEach(([key, value]) => {
    params.append(key, value);
  });

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase query failed: ${response.status} - ${error}`);
  }

  return await response.json();
}

async function main() {
  try {
    console.log('📊 Querying Supabase database for campaign statistics...\n');

    // First, get all workspaces
    console.log('Fetching workspace list...');
    const allWorkspaces = await supabaseGet('client_registry', 'id,workspace_name,bison_workspace_id');

    // Filter out excluded workspaces
    const workspaces = allWorkspaces.filter(ws =>
      !EXCLUDED_WORKSPACES.some(excluded =>
        ws.workspace_name?.toLowerCase().includes(excluded.toLowerCase())
      )
    );

    console.log(`Found ${workspaces.length} workspaces (after exclusions)\n`);

    // Get client_metrics data for the date range
    console.log('Fetching metrics data from client_metrics table...');
    const url = `${SUPABASE_URL}/rest/v1/client_metrics?select=client_id,date,emails_sent,unique_replies,client_registry!inner(workspace_name)&date=gte.${startDate}&date=lte.${endDate}&order=date.desc&limit=10000`;

    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch metrics: ${response.status} - ${error}`);
    }

    const metrics = await response.json();

    console.log(`Fetched ${metrics.length} metric records\n`);

    // Aggregate by workspace
    const workspaceStatsMap = new Map();

    metrics.forEach(metric => {
      const workspaceName = metric.client_registry?.workspace_name;

      // Skip if this workspace is excluded
      if (!workspaceName || EXCLUDED_WORKSPACES.some(excluded =>
        workspaceName.toLowerCase().includes(excluded.toLowerCase())
      )) {
        return;
      }

      if (!workspaceStatsMap.has(workspaceName)) {
        workspaceStatsMap.set(workspaceName, {
          workspace_name: workspaceName,
          total_emails_sent: 0,
          total_replies: 0
        });
      }

      const stats = workspaceStatsMap.get(workspaceName);
      stats.total_emails_sent += metric.emails_sent || 0;
      stats.total_replies += metric.unique_replies || 0;
    });

    // Convert to array and calculate reply rates
    const volumeStats = Array.from(workspaceStatsMap.values()).map(ws => ({
      ...ws,
      reply_rate: ws.total_emails_sent > 0 ?
        ((ws.total_replies / ws.total_emails_sent) * 100).toFixed(2) :
        '0.00'
    })).sort((a, b) => b.total_emails_sent - a.total_emails_sent);

    console.log(`Processed ${volumeStats.length} workspaces with data\n`);

    // Calculate totals
    let totalEmailsSent = 0;
    let totalReplies = 0;

    volumeStats.forEach(ws => {
      totalEmailsSent += ws.total_emails_sent || 0;
      totalReplies += ws.total_replies || 0;
    });

    const overallReplyRate = totalEmailsSent > 0 ? ((totalReplies / totalEmailsSent) * 100).toFixed(2) : 0;

    // Generate report
    console.log('\n' + '='.repeat(80));
    console.log('CAMPAIGN DATA SUMMARY - LAST 3 MONTHS');
    console.log('='.repeat(80));
    console.log(`Period: ${startDate} to ${endDate}`);
    console.log(`Excluded Workspaces: ${EXCLUDED_WORKSPACES.join(', ')}`);
    console.log('='.repeat(80));
    console.log(`Total Emails Sent: ${totalEmailsSent.toLocaleString()}`);
    console.log(`Total Replies: ${totalReplies.toLocaleString()}`);
    console.log(`Overall Reply Rate: ${overallReplyRate}%`);
    console.log('='.repeat(80));

    console.log('\n\nWORKSPACE BREAKDOWN:');
    console.log('-'.repeat(80));
    volumeStats.forEach(ws => {
      console.log(`${ws.workspace_name}`);
      console.log(`  Emails Sent: ${ws.total_emails_sent.toLocaleString()}`);
      console.log(`  Replies: ${ws.total_replies.toLocaleString()}`);
      console.log(`  Reply Rate: ${ws.reply_rate}%`);
      console.log('');
    });

    // Save detailed report to JSON
    const report = {
      summary: {
        period_start: startDate,
        period_end: endDate,
        excluded_workspaces: EXCLUDED_WORKSPACES,
        total_emails_sent: totalEmailsSent,
        total_replies: totalReplies,
        overall_reply_rate: overallReplyRate + '%',
        workspaces_processed: volumeStats.length
      },
      workspace_stats: volumeStats
    };

    const fs = require('fs');
    fs.writeFileSync('campaign-data-3-months-supabase.json', JSON.stringify(report, null, 2));
    console.log('\n✅ Detailed report saved to: campaign-data-3-months-supabase.json');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
