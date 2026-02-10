import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDataSources() {
  console.log('🔍 DASHBOARD DATA SOURCE VERIFICATION\n');
  console.log('═'.repeat(120));
  console.log('\nPurpose: Verify MTD leads consistency across all dashboards');
  console.log('Date:', new Date().toLocaleString());
  console.log('\n' + '═'.repeat(120));

  // 1. Get Revenue Dashboard data source (client_metrics)
  console.log('\n📊 1. REVENUE DASHBOARD DATA SOURCE (client_metrics table)\n');

  const today = new Date().toISOString().split('T')[0];
  const { data: metricsData, error: metricsError } = await supabase
    .from('client_metrics')
    .select('workspace_name, positive_replies_mtd, monthly_kpi, metric_date')
    .eq('metric_date', today)
    .eq('metric_type', 'mtd')
    .order('workspace_name');

  if (metricsError) {
    console.error('❌ Error fetching client_metrics:', metricsError.message);
  } else {
    console.log(`✅ Found ${metricsData?.length || 0} client records in client_metrics`);
    console.log('\nSample (first 5):');
    console.log('WORKSPACE'.padEnd(35) + 'MTD LEADS'.padEnd(15) + 'TARGET');
    console.log('─'.repeat(120));
    metricsData?.slice(0, 5).forEach(m => {
      console.log(
        m.workspace_name.padEnd(35) +
        m.positive_replies_mtd.toString().padEnd(15) +
        m.monthly_kpi.toString()
      );
    });
  }

  // 2. Get actual client_leads count (source of truth)
  console.log('\n\n📧 2. ACTUAL DATABASE COUNT (client_leads table - interested = true)\n');

  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);

  const { data: leadsData, error: leadsError } = await supabase
    .from('client_leads')
    .select('workspace_name, interested, date_received')
    .eq('interested', true)
    .gte('date_received', currentMonthStart.toISOString());

  if (leadsError) {
    console.error('❌ Error fetching client_leads:', leadsError.message);
  } else {
    // Group by workspace
    const leadsByWorkspace: Record<string, number> = {};
    leadsData?.forEach(lead => {
      leadsByWorkspace[lead.workspace_name] = (leadsByWorkspace[lead.workspace_name] || 0) + 1;
    });

    console.log(`✅ Found ${leadsData?.length || 0} total interested leads MTD`);
    console.log(`✅ Across ${Object.keys(leadsByWorkspace).length} workspaces\n`);

    console.log('Sample (first 5):');
    console.log('WORKSPACE'.padEnd(35) + 'ACTUAL COUNT');
    console.log('─'.repeat(120));
    Object.entries(leadsByWorkspace)
      .slice(0, 5)
      .forEach(([workspace, count]) => {
        console.log(workspace.padEnd(35) + count.toString());
      });

    // 3. Compare client_metrics vs actual client_leads
    console.log('\n\n🔄 3. COMPARISON: client_metrics vs actual client_leads\n');
    console.log('WORKSPACE'.padEnd(35) + 'METRICS'.padEnd(12) + 'ACTUAL'.padEnd(12) + 'DIFF'.padEnd(10) + 'STATUS');
    console.log('═'.repeat(120));

    let totalDiff = 0;
    let matchCount = 0;
    let mismatchCount = 0;

    metricsData?.forEach(metric => {
      const actualCount = leadsByWorkspace[metric.workspace_name] || 0;
      const diff = metric.positive_replies_mtd - actualCount;
      const status = diff === 0 ? '✅ MATCH' :
        Math.abs(diff) <= 2 ? '⚠️  CLOSE' :
          '❌ MISMATCH';

      if (diff === 0) matchCount++;
      else mismatchCount++;

      totalDiff += Math.abs(diff);

      // Only show first 10 for brevity
      if (metricsData.indexOf(metric) < 10) {
        console.log(
          metric.workspace_name.padEnd(35) +
          metric.positive_replies_mtd.toString().padEnd(12) +
          actualCount.toString().padEnd(12) +
          (diff >= 0 ? '+' : '') + diff.toString().padEnd(10) +
          status
        );
      }
    });

    console.log('═'.repeat(120));
    console.log(`\nSummary: ${matchCount} exact matches, ${mismatchCount} differences`);
    console.log(`Total absolute difference: ${totalDiff}`);

    if (totalDiff === 0) {
      console.log('✅ PERFECT: All metrics match actual database counts!');
    } else if (totalDiff < 10) {
      console.log('⚠️  ACCEPTABLE: Minor differences (likely timing/sync lag)');
    } else {
      console.log('❌ ISSUE: Significant differences detected - investigate sync process');
    }
  }

  // 4. Check KPI Dashboard data source (via Edge Function simulation)
  console.log('\n\n📈 4. KPI/BILLING DASHBOARD DATA SOURCE\n');
  console.log('Source: hybrid-workspace-analytics Edge Function');
  console.log('Method: Fetches directly from Email Bison /stats API');
  console.log('Field: stats.data.interested (MTD count from Email Bison)');
  console.log('\nNote: This is fetched in real-time, so we cannot verify here.');
  console.log('The Edge Function then stores results in client_metrics table.');

  // 5. Check Revenue Dashboard data source
  console.log('\n\n💰 5. REVENUE DASHBOARD DATA SOURCE\n');
  console.log('Source: revenue-analytics Edge Function');
  console.log('Method: Queries client_metrics table (same as step 1)');
  console.log('Fields used:');
  console.log('  - positive_replies_mtd (MTD leads)');
  console.log('  - monthly_kpi (target)');
  console.log('  - Joined with client_registry (pricing)');
  console.log('  - Joined with client_costs (expenses)');

  // 6. Check Billing Dashboard data source
  console.log('\n\n💵 6. BILLING DASHBOARD DATA SOURCE\n');
  console.log('Source: hybrid-workspace-analytics Edge Function');
  console.log('Method: Same as KPI Dashboard (step 4)');
  console.log('Key fields:');
  console.log('  - leadsGenerated = Email Bison stats.data.interested');
  console.log('  - monthlyKPI = client_registry.monthly_kpi_target');
  console.log('  - payout = client_registry.payout');

  // 7. Data flow summary
  console.log('\n\n🔄 7. DATA FLOW SUMMARY\n');
  console.log('═'.repeat(120));
  console.log('\n1. Email Bison (source of truth for leads)');
  console.log('   ↓');
  console.log('2. Webhook fires when lead marked "interested"');
  console.log('   ↓');
  console.log('3. universal-bison-webhook function processes');
  console.log('   ↓');
  console.log('4. client_leads table updated (INSERT/UPDATE)');
  console.log('   ↓');
  console.log('5. Daily sync updates client_metrics.positive_replies_mtd');
  console.log('   ↓');
  console.log('6. Dashboards query:');
  console.log('   ├─ Revenue Dashboard → client_metrics table');
  console.log('   ├─ KPI Dashboard → Email Bison API (via hybrid-workspace-analytics)');
  console.log('   └─ Billing Dashboard → Email Bison API (via hybrid-workspace-analytics)');

  console.log('\n\n⚠️  POTENTIAL ISSUE: Two different data paths!\n');
  console.log('Revenue Dashboard: client_metrics (updated daily)');
  console.log('KPI/Billing Dashboards: Email Bison API (real-time)');
  console.log('\nThis could cause temporary discrepancies.');

  // 8. Recommendations
  console.log('\n\n📋 8. RECOMMENDATIONS FOR COMBINED DASHBOARD\n');
  console.log('═'.repeat(120));
  console.log('\n✅ OPTION A: Use Email Bison API directly (real-time, like KPI/Billing)');
  console.log('   Pros: Real-time data, consistent with KPI dashboard');
  console.log('   Cons: Slower (API calls), more complex');
  console.log('');
  console.log('✅ OPTION B: Use client_metrics table (fast, like Revenue)');
  console.log('   Pros: Fast queries, already cached');
  console.log('   Cons: Updated daily, may lag behind Email Bison by hours');
  console.log('');
  console.log('🎯 RECOMMENDED: OPTION A (Email Bison API)');
  console.log('   Reason: User expects real-time KPI data, can tolerate slower load');
  console.log('   Implementation: Create new Edge Function that combines:');
  console.log('     - Email Bison stats (MTD leads, KPI) - REAL-TIME');
  console.log('     - client_registry (pricing, targets)');
  console.log('     - client_costs (expenses)');
  console.log('     - Calculate revenue, profit on the fly');

  console.log('\n\n✅ VERIFICATION COMPLETE\n');
  console.log('═'.repeat(120));
}

async function main() {
  await verifyDataSources();
}

main().catch(console.error);
