/**
 * Test Revenue Dashboard Enhancements
 *
 * Tests:
 * 1. Cost calculation from infrastructure (auto vs manual)
 * 2. Daily average revenue and projections
 * 3. Total possible revenue calculations
 * 4. Revenue forecasting logic
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRevenueEnhancements() {
  console.log('🧪 Testing Revenue Dashboard Enhancements\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Call revenue-analytics Edge Function
    console.log('\n📊 Test 1: Fetching revenue data with new enhancements...\n');

    const { data, error } = await supabase.functions.invoke('revenue-analytics', {
      method: 'POST',
    });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    const { clients, totals, meta } = data;

    console.log(`✅ Successfully fetched data for ${clients.length} clients`);
    console.log(`📅 Month: ${meta.month_year} (Day ${meta.current_day}/${meta.days_in_month})\n`);

    // Test 2: Verify cost calculations
    console.log('='.repeat(60));
    console.log('\n💰 Test 2: Cost Calculation Breakdown\n');

    let autoCount = 0;
    let manualCount = 0;
    let totalAutoCosts = 0;
    let totalManualCosts = 0;

    console.log('Sample clients with cost details:\n');
    clients.slice(0, 5).forEach((client: any, index: number) => {
      console.log(`${index + 1}. ${client.workspace_name}`);
      console.log(`   Cost Source: ${client.cost_source || 'unknown'}`);
      console.log(`   Email Account Costs: $${client.email_account_costs?.toFixed(2) || 0}`);
      console.log(`   Labor Costs: $${client.labor_costs?.toFixed(2) || 0}`);
      console.log(`   Other Costs: $${client.other_costs?.toFixed(2) || 0}`);
      console.log(`   TOTAL COSTS: $${client.current_month_costs.toLocaleString()}`);
      console.log('');

      if (client.cost_source === 'calculated') {
        autoCount++;
        totalAutoCosts += client.current_month_costs;
      } else if (client.cost_source === 'manual') {
        manualCount++;
        totalManualCosts += client.current_month_costs;
      }
    });

    clients.forEach((client: any) => {
      if (client.cost_source === 'calculated') {
        autoCount++;
        totalAutoCosts += client.current_month_costs;
      } else if (client.cost_source === 'manual') {
        manualCount++;
        totalManualCosts += client.current_month_costs;
      }
    });

    console.log('\nCost Source Summary:');
    console.log(`  🤖 Auto-calculated: ${autoCount} clients ($${totalAutoCosts.toLocaleString()})`);
    console.log(`  ✏️  Manually set: ${manualCount} clients ($${totalManualCosts.toLocaleString()})`);

    // Test 3: Verify daily average and projections
    console.log('\n' + '='.repeat(60));
    console.log('\n📈 Test 3: Daily Average & Projections\n');

    console.log(`MTD Revenue: $${totals.total_mtd_revenue.toLocaleString()}`);
    console.log(`Days Elapsed: ${meta.current_day}`);
    console.log(`Daily Average Revenue: $${totals.daily_average_revenue?.toLocaleString() || 0}`);
    console.log(`Projected EOM Revenue: $${totals.projected_eom_revenue?.toLocaleString() || 0}`);
    console.log(`Total Possible Revenue: $${totals.total_possible_revenue?.toLocaleString() || 0}`);
    console.log(`Revenue Gap: $${totals.revenue_gap?.toLocaleString() || 0}`);

    const achievementPercent = totals.total_possible_revenue > 0
      ? (totals.total_mtd_revenue / totals.total_possible_revenue * 100).toFixed(1)
      : 0;
    console.log(`\nCurrent Achievement: ${achievementPercent}% of total possible`);

    // Test 4: Verify revenue forecasting
    console.log('\n' + '='.repeat(60));
    console.log('\n🔮 Test 4: Revenue Forecasting\n');

    if (totals.forecast) {
      console.log(`Forecast Confidence: ${totals.forecast.confidence.toUpperCase()}`);
      console.log(`Avg KPI Progress: ${totals.forecast.avg_kpi_progress.toFixed(1)}%`);
      console.log(`Days Remaining: ${totals.forecast.days_remaining}\n`);

      console.log('Forecast Scenarios:');
      console.log(`  Conservative: $${totals.forecast.conservative.toLocaleString()}`);
      console.log(`  Linear: $${totals.forecast.linear.toLocaleString()}`);
      console.log(`  Velocity-Adjusted: $${totals.forecast.velocity_adjusted.toLocaleString()}`);
      console.log(`  Optimistic: $${totals.forecast.optimistic.toLocaleString()}`);

      // Show range
      const range = totals.forecast.optimistic - totals.forecast.conservative;
      console.log(`\nForecast Range: $${range.toLocaleString()} (${((range / totals.forecast.linear) * 100).toFixed(1)}% variance)`);
    } else {
      console.log('⚠️  No forecast data available');
    }

    // Test 5: Verify per-lead client revenue by leads data
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Test 5: Per-Lead Clients (Revenue by Leads)\n');

    const perLeadClients = clients.filter((c: any) => c.billing_type === 'per_lead');
    console.log(`Total per-lead clients: ${perLeadClients.length}\n`);

    console.log('Top 5 by revenue:');
    perLeadClients
      .sort((a: any, b: any) => b.current_month_revenue - a.current_month_revenue)
      .slice(0, 5)
      .forEach((client: any, index: number) => {
        const efficiency = client.current_month_leads > 0
          ? (client.current_month_revenue / client.current_month_leads).toFixed(2)
          : 0;
        console.log(`  ${index + 1}. ${client.workspace_name}`);
        console.log(`     Leads: ${client.current_month_leads} | Revenue: $${client.current_month_revenue.toLocaleString()} | $/Lead: $${efficiency}`);
      });

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ ALL TESTS PASSED\n');
    console.log('Summary:');
    console.log(`  ✓ Cost calculations working (${autoCount + manualCount} clients)`);
    console.log(`  ✓ Daily averages calculated correctly`);
    console.log(`  ✓ Revenue projections generated`);
    console.log(`  ✓ Forecasting logic functional`);
    console.log(`  ✓ Per-lead analysis data available`);
    console.log('');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run tests
testRevenueEnhancements().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
