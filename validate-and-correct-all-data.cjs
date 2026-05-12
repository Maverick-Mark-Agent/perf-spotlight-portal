#!/usr/bin/env node

/**
 * Validate all workspace data against actual email accounts
 * Detect duplicates and generate corrected campaign statistics
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const EXCLUDED_WORKSPACES = [
  'SMA Insurance',
  'StreetSmart Commercial',
  'StreetSmart Trucking',
  'Shane Miller',
  'Jeff Schroder'
];

const threeMonthsAgo = new Date();
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
const startDate = threeMonthsAgo.toISOString().split('T')[0];
const endDate = new Date().toISOString().split('T')[0];

async function main() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log('🔍 COMPREHENSIVE DATA VALIDATION AND CORRECTION');
    console.log('='.repeat(100));
    console.log(`Period: ${startDate} to ${endDate}`);
    console.log(`Excluded workspaces: ${EXCLUDED_WORKSPACES.join(', ')}\n`);

    // Step 1: Fetch all metrics
    console.log('Step 1: Fetching all client_metrics data...');
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

    if (metricsError) throw metricsError;
    console.log(`✓ Fetched ${metrics.length} records\n`);

    // Step 2: Detect duplicates by month
    console.log('Step 2: Detecting duplicate data...\n');

    const monthlyData = new Map(); // key: "YYYY-MM|emails|replies" -> workspaces[]

    metrics.forEach(metric => {
      const workspaceName = metric.client_registry?.workspace_name;
      if (!workspaceName || EXCLUDED_WORKSPACES.some(ex =>
        workspaceName.toLowerCase().includes(ex.toLowerCase()))) {
        return;
      }

      const yearMonth = metric.metric_date.substring(0, 7);
      const key = `${yearMonth}|${metric.emails_sent_mtd}|${metric.positive_replies_mtd}`;

      if (!monthlyData.has(key)) {
        monthlyData.set(key, []);
      }

      const existing = monthlyData.get(key);
      if (!existing.find(e => e.workspace === workspaceName && e.date === metric.metric_date)) {
        existing.push({
          workspace: workspaceName,
          date: metric.metric_date,
          emails: metric.emails_sent_mtd,
          replies: metric.positive_replies_mtd
        });
      }
    });

    // Find duplicates
    const duplicates = Array.from(monthlyData.entries())
      .filter(([key, workspaces]) => workspaces.length > 1)
      .map(([key, workspaces]) => {
        const [month, emails, replies] = key.split('|');
        return { month, emails: parseInt(emails), replies: parseInt(replies), workspaces };
      });

    if (duplicates.length > 0) {
      console.log('⚠️  DUPLICATE DATA DETECTED:\n');
      duplicates.forEach(dup => {
        console.log(`Month ${dup.month}: ${dup.emails} emails, ${dup.replies} replies`);
        console.log(`  Duplicated across: ${dup.workspaces.map(w => w.workspace).join(', ')}`);
        console.log('');
      });
    } else {
      console.log('✓ No duplicates detected\n');
    }

    // Step 3: Fetch email account data for validation
    console.log('Step 3: Fetching email account data for validation...');
    const { data: allAccounts, error: accountsError } = await supabase
      .from('sender_emails_cache')
      .select('workspace_name, email_address, emails_sent_count, total_replied_count');

    if (accountsError) throw accountsError;
    console.log(`✓ Fetched ${allAccounts.length} email accounts\n`);

    // Group accounts by workspace
    const accountsByWorkspace = new Map();
    allAccounts.forEach(acc => {
      if (!accountsByWorkspace.has(acc.workspace_name)) {
        accountsByWorkspace.set(acc.workspace_name, []);
      }
      accountsByWorkspace.get(acc.workspace_name).push(acc);
    });

    // Step 4: Build workspace statistics with validation
    console.log('Step 4: Building workspace statistics with validation...\n');

    const workspaceMonthMap = new Map();

    metrics.forEach(metric => {
      const workspaceName = metric.client_registry?.workspace_name;
      const metricDate = metric.metric_date;

      if (!workspaceName || EXCLUDED_WORKSPACES.some(ex =>
        workspaceName.toLowerCase().includes(ex.toLowerCase()))) {
        return;
      }

      const yearMonth = metricDate.substring(0, 7);
      const key = `${workspaceName}|${yearMonth}`;

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

    // Check each workspace against duplicates and email accounts
    const workspaceStats = new Map();
    const issuesFound = [];

    workspaceMonthMap.forEach(monthData => {
      const ws = monthData.workspace_name;

      if (!workspaceStats.has(ws)) {
        workspaceStats.set(ws, {
          workspace_name: ws,
          total_emails_sent: 0,
          total_replies: 0,
          monthly_breakdown: {},
          issues: []
        });
      }

      const stats = workspaceStats.get(ws);

      // Check if this month's data is duplicated
      const isDuplicate = duplicates.find(dup =>
        dup.month === monthData.year_month &&
        dup.emails === monthData.emails_sent_mtd &&
        dup.replies === monthData.positive_replies_mtd &&
        dup.workspaces.length > 1 &&
        dup.workspaces.some(w => w.workspace === ws)
      );

      // Check if workspace has any email accounts
      const accounts = accountsByWorkspace.get(ws) || [];
      const totalAccountEmails = accounts.reduce((sum, acc) => sum + (acc.emails_sent_count || 0), 0);

      if (isDuplicate) {
        stats.issues.push({
          month: monthData.year_month,
          issue: 'DUPLICATE_DATA',
          emails: monthData.emails_sent_mtd,
          duplicated_with: isDuplicate.workspaces.filter(w => w.workspace !== ws).map(w => w.workspace)
        });
        issuesFound.push({
          workspace: ws,
          month: monthData.year_month,
          issue: 'Duplicate data',
          emails: monthData.emails_sent_mtd
        });
      } else if (monthData.emails_sent_mtd > 0 && totalAccountEmails === 0) {
        stats.issues.push({
          month: monthData.year_month,
          issue: 'NO_EMAIL_ACCOUNTS',
          emails: monthData.emails_sent_mtd,
          account_count: accounts.length
        });
        issuesFound.push({
          workspace: ws,
          month: monthData.year_month,
          issue: 'Metrics show activity but no email accounts have sends',
          emails: monthData.emails_sent_mtd
        });
      } else {
        // Data looks valid
        stats.total_emails_sent += monthData.emails_sent_mtd;
        stats.total_replies += monthData.positive_replies_mtd;
      }

      stats.monthly_breakdown[monthData.year_month] = {
        emails_sent: monthData.emails_sent_mtd,
        replies: monthData.positive_replies_mtd,
        valid: !isDuplicate && (monthData.emails_sent_mtd === 0 || totalAccountEmails > 0)
      };
    });

    // Step 5: Display issues
    if (issuesFound.length > 0) {
      console.log('⚠️  DATA QUALITY ISSUES FOUND:\n');
      console.log('-'.repeat(100));
      issuesFound.forEach(issue => {
        console.log(`${issue.workspace} (${issue.month}): ${issue.issue} - ${issue.emails} emails`);
      });
      console.log('-'.repeat(100));
      console.log('');
    }

    // Step 6: Generate corrected report
    console.log('\n' + '='.repeat(100));
    console.log('CORRECTED CAMPAIGN STATISTICS (Excluding Invalid Data)');
    console.log('='.repeat(100));
    console.log(`Period: ${startDate} to ${endDate}\n`);

    const validStats = Array.from(workspaceStats.values())
      .map(ws => ({
        workspace_name: ws.workspace_name,
        total_emails_sent: ws.total_emails_sent,
        total_replies: ws.total_replies,
        reply_rate: ws.total_emails_sent > 0 ?
          ((ws.total_replies / ws.total_emails_sent) * 100).toFixed(2) : '0.00',
        has_issues: ws.issues.length > 0,
        monthly_breakdown: ws.monthly_breakdown
      }))
      .sort((a, b) => b.total_emails_sent - a.total_emails_sent);

    let totalEmails = 0;
    let totalReplies = 0;

    validStats.forEach(ws => {
      totalEmails += ws.total_emails_sent;
      totalReplies += ws.total_replies;
    });

    const overallReplyRate = totalEmails > 0 ? ((totalReplies / totalEmails) * 100).toFixed(2) : '0.00';

    console.log(`Total Emails Sent: ${totalEmails.toLocaleString()}`);
    console.log(`Total Replies: ${totalReplies.toLocaleString()}`);
    console.log(`Overall Reply Rate: ${overallReplyRate}%`);
    console.log(`Workspaces Processed: ${validStats.length}`);
    console.log('='.repeat(100));

    console.log('\n\nDETAILED WORKSPACE BREAKDOWN:\n');
    console.log('-'.repeat(100));

    validStats.forEach(ws => {
      const statusIcon = ws.has_issues ? '⚠️ ' : '✓ ';
      console.log(`${statusIcon}${ws.workspace_name}`);
      console.log(`  3-Month Total: ${ws.total_emails_sent.toLocaleString()} emails, ${ws.total_replies} replies (${ws.reply_rate}%)`);

      const months = Object.keys(ws.monthly_breakdown).sort();
      if (months.length > 0) {
        console.log(`  Monthly breakdown:`);
        months.forEach(month => {
          const data = ws.monthly_breakdown[month];
          const validIcon = data.valid ? '✓' : '✗';
          const validText = data.valid ? '' : ' (EXCLUDED - Invalid)';
          console.log(`    ${validIcon} ${month}: ${data.emails_sent.toLocaleString()} emails, ${data.replies} replies${validText}`);
        });
      }
      console.log('');
    });

    // Save corrected data
    const fs = require('fs');
    const report = {
      summary: {
        period_start: startDate,
        period_end: endDate,
        excluded_workspaces: EXCLUDED_WORKSPACES,
        total_emails_sent: totalEmails,
        total_replies: totalReplies,
        overall_reply_rate: overallReplyRate + '%',
        workspaces_processed: validStats.length,
        data_quality_issues_found: issuesFound.length,
        duplicates_detected: duplicates.length
      },
      workspace_stats: validStats,
      data_quality_issues: issuesFound,
      duplicates: duplicates
    };

    fs.writeFileSync('campaign-data-CORRECTED.json', JSON.stringify(report, null, 2));
    console.log('\n✅ Corrected report saved to: campaign-data-CORRECTED.json\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
