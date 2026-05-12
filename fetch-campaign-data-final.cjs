#!/usr/bin/env node

/**
 * Fetch campaign data for the last 3 months from Supabase database
 * Uses @supabase/supabase-js for proper authentication
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

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

async function main() {
  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log('📊 Querying Supabase database for campaign statistics...\n');

    // Fetch client_metrics for the date range with workspace info
    console.log('Fetching metrics data from client_metrics table...');
    const { data: metrics, error: metricsError } = await supabase
      .from('client_metrics')
      .select(`
        metric_date,
        metric_type,
        emails_sent_mtd,
        positive_replies_mtd,
        client_registry!inner(
          workspace_name,
          is_active
        )
      `)
      .gte('metric_date', startDate)
      .lte('metric_date', endDate)
      .eq('metric_type', 'mtd')
      .eq('client_registry.is_active', true)
      .order('metric_date', { ascending: false });

    if (metricsError) {
      throw new Error(`Failed to fetch metrics: ${metricsError.message}`);
    }

    console.log(`Fetched ${metrics.length} metric records\n`);

    // Group by workspace and month, keeping only the latest (max) MTD value for each month
    // MTD values are cumulative, so the most recent entry has the total for that month
    const workspaceMonthMap = new Map();

    metrics.forEach(metric => {
      const workspaceName = metric.client_registry?.workspace_name;
      const metricDate = metric.metric_date;

      // Skip if workspace not found or is excluded
      if (!workspaceName || EXCLUDED_WORKSPACES.some(excluded =>
        workspaceName.toLowerCase().includes(excluded.toLowerCase())
      )) {
        return;
      }

      // Extract year-month from date (e.g., "2025-10")
      const yearMonth = metricDate.substring(0, 7);
      const key = `${workspaceName}|${yearMonth}`;

      // Keep only the latest date for each workspace-month combination
      if (!workspaceMonthMap.has(key) || workspaceMonthMap.get(key).metric_date < metricDate) {
        workspaceMonthMap.set(key, {
          workspace_name: workspaceName,
          year_month: yearMonth,
          metric_date: metricDate,
          emails_sent_mtd: metric.emails_sent_mtd || 0,
          positive_replies_mtd: metric.positive_replies_mtd || 0
        });
      }
    });

    // Now aggregate by workspace across all months
    const workspaceStatsMap = new Map();

    workspaceMonthMap.forEach(monthData => {
      const workspaceName = monthData.workspace_name;

      if (!workspaceStatsMap.has(workspaceName)) {
        workspaceStatsMap.set(workspaceName, {
          workspace_name: workspaceName,
          total_emails_sent: 0,
          total_replies: 0
        });
      }

      const stats = workspaceStatsMap.get(workspaceName);
      stats.total_emails_sent += monthData.emails_sent_mtd;
      stats.total_replies += monthData.positive_replies_mtd;
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

    const overallReplyRate = totalEmailsSent > 0 ? ((totalReplies / totalEmailsSent) * 100).toFixed(2) : '0.00';

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
    fs.writeFileSync('campaign-data-3-months.json', JSON.stringify(report, null, 2));
    console.log('\n✅ Detailed report saved to: campaign-data-3-months.json');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
