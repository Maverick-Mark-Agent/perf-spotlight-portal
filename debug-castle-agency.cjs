#!/usr/bin/env node

/**
 * Debug script to investigate Castle Agency data discrepancy
 * User reports only 116 emails sent, but script shows 38,831
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

// Calculate date 3 months ago
const threeMonthsAgo = new Date();
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
const startDate = threeMonthsAgo.toISOString().split('T')[0];
const endDate = new Date().toISOString().split('T')[0];

async function main() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log('🔍 Debugging Castle Agency data discrepancy');
    console.log(`Date range: ${startDate} to ${endDate}\n`);

    // First, find Castle Agency in client_registry
    console.log('Step 1: Finding Castle Agency in client_registry...');
    const { data: registry, error: registryError } = await supabase
      .from('client_registry')
      .select('workspace_id, workspace_name, display_name, is_active')
      .ilike('workspace_name', '%castle%');

    if (registryError) throw registryError;

    console.log('Found Castle Agency records:');
    console.table(registry);

    if (!registry || registry.length === 0) {
      console.log('❌ No Castle Agency found in database!');
      return;
    }

    const castleWorkspaceNames = registry.map(r => r.workspace_name);
    console.log(`\nCastle Agency workspace_name(s): ${castleWorkspaceNames.join(', ')}\n`);

    // Query ALL metrics for Castle Agency (not just MTD)
    console.log('Step 2: Fetching ALL client_metrics records for Castle Agency...');
    const { data: allMetrics, error: allMetricsError } = await supabase
      .from('client_metrics')
      .select('*')
      .in('workspace_name', castleWorkspaceNames)
      .gte('metric_date', startDate)
      .lte('metric_date', endDate)
      .order('metric_date', { ascending: true });

    if (allMetricsError) throw allMetricsError;

    console.log(`\nFound ${allMetrics.length} total metric records\n`);
    console.log('ALL METRICS (grouped by type):');
    console.log('='.repeat(100));

    // Group by metric_type
    const byType = {};
    allMetrics.forEach(m => {
      const type = m.metric_type || 'null';
      if (!byType[type]) byType[type] = [];
      byType[type].push(m);
    });

    Object.keys(byType).sort().forEach(type => {
      console.log(`\n📊 METRIC_TYPE: ${type} (${byType[type].length} records)`);
      console.log('-'.repeat(100));
      byType[type].forEach(m => {
        console.log(`  Date: ${m.metric_date} | Sent: ${m.emails_sent_mtd || 0} | Replies: ${m.positive_replies_mtd || 0}`);
      });
    });

    // Now show what the aggregation logic does (MTD only)
    console.log('\n\n' + '='.repeat(100));
    console.log('Step 3: Applying aggregation logic (MTD only, latest per month)');
    console.log('='.repeat(100));

    const mtdMetrics = allMetrics.filter(m => m.metric_type === 'mtd');
    console.log(`\nMTD metrics only: ${mtdMetrics.length} records`);

    // Group by year-month and take latest
    const monthMap = new Map();
    mtdMetrics.forEach(m => {
      const yearMonth = m.metric_date.substring(0, 7);
      if (!monthMap.has(yearMonth) || monthMap.get(yearMonth).metric_date < m.metric_date) {
        monthMap.set(yearMonth, m);
      }
    });

    console.log('\nLatest MTD entry per month:');
    console.log('-'.repeat(100));
    let totalEmails = 0;
    let totalReplies = 0;

    Array.from(monthMap.entries()).sort().forEach(([month, metric]) => {
      const emails = metric.emails_sent_mtd || 0;
      const replies = metric.positive_replies_mtd || 0;
      console.log(`  ${month}: Date=${metric.metric_date} | Emails=${emails} | Replies=${replies}`);
      totalEmails += emails;
      totalReplies += replies;
    });

    console.log('-'.repeat(100));
    console.log(`\n📧 AGGREGATED TOTAL: ${totalEmails} emails sent, ${totalReplies} replies`);
    console.log(`\n❓ Expected by user: 116 emails`);
    console.log(`❌ Discrepancy: ${totalEmails - 116} emails\n`);

    // Check if there might be daily metrics we should use instead
    const dailyMetrics = allMetrics.filter(m => m.metric_type === 'daily');
    if (dailyMetrics.length > 0) {
      console.log('\n' + '='.repeat(100));
      console.log('⚠️  FOUND DAILY METRICS - These might be the correct source!');
      console.log('='.repeat(100));

      let dailyTotal = dailyMetrics.reduce((sum, m) => sum + (m.emails_sent_mtd || 0), 0);
      console.log(`\nDaily metrics total: ${dailyTotal} emails`);
      console.log('This might be closer to the expected 116 emails\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
