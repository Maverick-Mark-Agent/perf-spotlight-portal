#!/usr/bin/env node

/**
 * Fetch campaign data for the last 3 months WITH MONTHLY BREAKDOWN
 * This shows BOTH the monthly breakdown AND the 3-month totals
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

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
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log('📊 Querying Supabase for campaign statistics with monthly breakdown...\n');

    // Fetch client_metrics for the date range
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

    // Group by workspace and month, keeping only the latest MTD value for each month
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

      // Extract year-month from date
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

    // Create workspace stats with monthly breakdown
    const workspaceStatsMap = new Map();

    workspaceMonthMap.forEach(monthData => {
      const workspaceName = monthData.workspace_name;

      if (!workspaceStatsMap.has(workspaceName)) {
        workspaceStatsMap.set(workspaceName, {
          workspace_name: workspaceName,
          total_emails_sent: 0,
          total_replies: 0,
          monthly_breakdown: {}
        });
      }

      const stats = workspaceStatsMap.get(workspaceName);
      stats.total_emails_sent += monthData.emails_sent_mtd;
      stats.total_replies += monthData.positive_replies_mtd;

      // Store monthly breakdown
      stats.monthly_breakdown[monthData.year_month] = {
        emails_sent: monthData.emails_sent_mtd,
        replies: monthData.positive_replies_mtd,
        reply_rate: monthData.emails_sent_mtd > 0 ?
          ((monthData.positive_replies_mtd / monthData.emails_sent_mtd) * 100).toFixed(2) : '0.00'
      };
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

    // Generate console report with monthly breakdown
    console.log('\n' + '='.repeat(100));
    console.log('CAMPAIGN DATA SUMMARY - LAST 3 MONTHS (WITH MONTHLY BREAKDOWN)');
    console.log('='.repeat(100));
    console.log(`Period: ${startDate} to ${endDate}`);
    console.log(`Excluded Workspaces: ${EXCLUDED_WORKSPACES.join(', ')}`);
    console.log('='.repeat(100));
    console.log(`Total Emails Sent: ${totalEmailsSent.toLocaleString()}`);
    console.log(`Total Replies: ${totalReplies.toLocaleString()}`);
    console.log(`Overall Reply Rate: ${overallReplyRate}%`);
    console.log('='.repeat(100));

    console.log('\n\nWORKSPACE BREAKDOWN (with monthly details):');
    console.log('-'.repeat(100));

    volumeStats.forEach(ws => {
      console.log(`\n${ws.workspace_name}`);
      console.log(`  3-MONTH TOTAL: ${ws.total_emails_sent.toLocaleString()} emails, ${ws.total_replies} replies (${ws.reply_rate}%)`);

      // Show monthly breakdown
      const months = Object.keys(ws.monthly_breakdown).sort();
      if (months.length > 0) {
        console.log(`  Monthly breakdown:`);
        months.forEach(month => {
          const data = ws.monthly_breakdown[month];
          console.log(`    ${month}: ${data.emails_sent.toLocaleString()} emails, ${data.replies} replies (${data.reply_rate}%)`);
        });
      }
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

    fs.writeFileSync('campaign-data-3-months-detailed.json', JSON.stringify(report, null, 2));
    console.log('\n\n✅ Detailed report saved to: campaign-data-3-months-detailed.json');

    // Generate markdown report with monthly breakdown
    let markdown = `# Email Campaign Performance Report - Monthly Breakdown\n`;
    markdown += `## Last 3 Months (${startDate} to ${endDate})\n\n`;
    markdown += `### Executive Summary\n`;
    markdown += `- **Period:** ${startDate} to ${endDate}\n`;
    markdown += `- **Total Emails Sent:** ${totalEmailsSent.toLocaleString()}\n`;
    markdown += `- **Total Replies:** ${totalReplies.toLocaleString()}\n`;
    markdown += `- **Overall Reply Rate:** ${overallReplyRate}%\n`;
    markdown += `- **Active Workspaces:** ${volumeStats.length} (${EXCLUDED_WORKSPACES.length} excluded)\n\n`;
    markdown += `---\n\n`;

    markdown += `## Workspace Performance with Monthly Breakdown\n\n`;

    volumeStats.forEach(ws => {
      markdown += `### ${ws.workspace_name}\n\n`;
      markdown += `**3-Month Total:** ${ws.total_emails_sent.toLocaleString()} emails, ${ws.total_replies} replies (${ws.reply_rate}%)\n\n`;

      const months = Object.keys(ws.monthly_breakdown).sort();
      if (months.length > 0) {
        markdown += `| Month | Emails Sent | Replies | Reply Rate |\n`;
        markdown += `|-------|-------------|---------|------------|\n`;
        months.forEach(month => {
          const data = ws.monthly_breakdown[month];
          markdown += `| ${month} | ${data.emails_sent.toLocaleString()} | ${data.replies} | ${data.reply_rate}% |\n`;
        });
      }
      markdown += `\n---\n\n`;
    });

    markdown += `## Excluded Workspaces\n`;
    markdown += `The following workspaces were excluded from this report:\n`;
    EXCLUDED_WORKSPACES.forEach(ws => {
      markdown += `- ${ws}\n`;
    });
    markdown += `\n---\n\n`;
    markdown += `**Report Generated:** ${new Date().toISOString()}\n`;

    fs.writeFileSync('CAMPAIGN-MONTHLY-BREAKDOWN.md', markdown);
    console.log('✅ Monthly breakdown report saved to: CAMPAIGN-MONTHLY-BREAKDOWN.md\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
