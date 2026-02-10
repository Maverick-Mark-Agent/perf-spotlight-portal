/**
 * Test the updated revenue-analytics Edge Function
 * to verify billable-only metrics are being returned correctly
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAPI() {
  console.log('🧪 Testing revenue-analytics Edge Function...\n');

  try {
    const { data, error } = await supabase.functions.invoke('revenue-analytics');

    if (error) {
      console.error('❌ Error invoking function:', error);
      return;
    }

    console.log('✅ Function invoked successfully!\n');

    // Check totals object
    const totals = data.totals;
    console.log('📊 TOTALS OBJECT:');
    console.log('  Total MTD Revenue:', `$${totals.total_mtd_revenue?.toLocaleString()}`);
    console.log('  Total MTD Billable Revenue:', `$${totals.total_mtd_billable_revenue?.toLocaleString()}`);
    console.log('  Total Possible Billable Revenue:', `$${totals.total_possible_billable_revenue?.toLocaleString()}`);
    console.log('  Daily Billable Revenue Target:', `$${totals.daily_billable_revenue_target?.toLocaleString()}`);
    console.log('');

    // Check daily billable revenue array
    if (totals.daily_billable_revenue && totals.daily_billable_revenue.length > 0) {
      console.log('📈 DAILY BILLABLE REVENUE (Time-Series):');
      console.log(`  Total days: ${totals.daily_billable_revenue.length}`);
      console.log('  First 5 days:');
      totals.daily_billable_revenue.slice(0, 5).forEach((day: any) => {
        console.log(`    Day ${day.day}: $${day.cumulative_revenue?.toLocaleString()} cumulative (${day.lead_count} leads, $${day.daily_revenue?.toLocaleString()} daily)`);
      });
      console.log('  Last day:');
      const lastDay = totals.daily_billable_revenue[totals.daily_billable_revenue.length - 1];
      console.log(`    Day ${lastDay.day}: $${lastDay.cumulative_revenue?.toLocaleString()} cumulative (${lastDay.lead_count} leads, $${lastDay.daily_revenue?.toLocaleString()} daily)`);
      console.log('');
    } else {
      console.log('⚠️ No daily billable revenue data found\n');
    }

    // Check billable forecast
    if (totals.billable_forecast) {
      console.log('🔮 BILLABLE FORECAST:');
      console.log(`  Conservative: $${totals.billable_forecast.conservative?.toLocaleString()}`);
      console.log(`  Linear: $${totals.billable_forecast.linear?.toLocaleString()}`);
      console.log(`  Optimistic: $${totals.billable_forecast.optimistic?.toLocaleString()}`);
      console.log(`  Confidence: ${totals.billable_forecast.confidence}`);
      console.log(`  Avg KPI Progress: ${totals.billable_forecast.avg_kpi_progress?.toFixed(1)}%`);
      console.log(`  Daily Average: $${totals.billable_forecast.daily_average?.toLocaleString()}`);
      console.log('');
    } else {
      console.log('⚠️ No billable forecast data found\n');
    }

    // Check per-lead clients
    const perLeadClients = data.clients.filter((c: any) => c.billing_type === 'per_lead');
    console.log(`💼 PER-LEAD CLIENTS: ${perLeadClients.length} total`);
    console.log('  Top 5 by revenue:');
    perLeadClients
      .sort((a: any, b: any) => b.current_month_revenue - a.current_month_revenue)
      .slice(0, 5)
      .forEach((c: any) => {
        console.log(`    ${c.workspace_name}: $${c.current_month_revenue?.toLocaleString()} (${c.current_month_leads} leads @ $${c.price_per_lead}/lead)`);
      });
    console.log('');

    // Verify calculations
    console.log('✅ VERIFICATION:');
    const calculatedBillableRevenue = perLeadClients.reduce((sum: number, c: any) => sum + c.current_month_revenue, 0);
    console.log(`  Calculated per-lead revenue: $${calculatedBillableRevenue.toLocaleString()}`);
    console.log(`  Reported billable revenue: $${totals.total_mtd_billable_revenue?.toLocaleString()}`);
    console.log(`  Match: ${calculatedBillableRevenue === totals.total_mtd_billable_revenue ? '✅ YES' : '❌ NO'}`);
    console.log('');

    const calculatedPossibleBillable = perLeadClients.reduce((sum: number, c: any) =>
      sum + (c.monthly_kpi * c.price_per_lead), 0
    );
    console.log(`  Calculated possible billable: $${calculatedPossibleBillable.toLocaleString()}`);
    console.log(`  Reported possible billable: $${totals.total_possible_billable_revenue?.toLocaleString()}`);
    console.log(`  Match: ${Math.abs(calculatedPossibleBillable - (totals.total_possible_billable_revenue || 0)) < 1 ? '✅ YES' : '❌ NO'}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testAPI();
