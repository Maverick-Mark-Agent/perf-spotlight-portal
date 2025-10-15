/**
 * Test the revenue-billing-unified Edge Function
 * to verify billable-only metrics are being returned
 */

async function testAPI() {
  console.log('🧪 Testing revenue-billing-unified Edge Function...\n');

  try {
    const response = await fetch('https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/revenue-billing-unified', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    const text = await response.text();

    if (!response.ok) {
      console.error('\n❌ Function returned error');
      console.log('Response:', text);
      return;
    }

    const data = JSON.parse(text);
    console.log('\n✅ Function succeeded!');

    const totals = data.totals;
    console.log('\n📊 BILLABLE-ONLY METRICS:');
    console.log(`  Total Possible Billable: $${totals.total_possible_billable_revenue?.toLocaleString()}`);
    console.log(`  Daily Billable Target: $${totals.daily_billable_revenue_target?.toLocaleString()}`);
    console.log(`  Total MTD Billable: $${totals.total_mtd_billable_revenue?.toLocaleString()}`);
    console.log(`  Daily Billable Revenue Data: ${totals.daily_billable_revenue?.length || 0} days`);

    if (totals.billable_forecast) {
      console.log('\n🔮 BILLABLE FORECAST:');
      console.log(`  Conservative: $${totals.billable_forecast.conservative?.toLocaleString()}`);
      console.log(`  Linear: $${totals.billable_forecast.linear?.toLocaleString()}`);
      console.log(`  Optimistic: $${totals.billable_forecast.optimistic?.toLocaleString()}`);
      console.log(`  Confidence: ${totals.billable_forecast.confidence}`);
    }

    if (totals.daily_billable_revenue && totals.daily_billable_revenue.length > 0) {
      console.log('\n📈 SAMPLE DAILY DATA (first 3 days):');
      totals.daily_billable_revenue.slice(0, 3).forEach((day: any) => {
        console.log(`  Day ${day.day}: $${day.cumulative_revenue?.toLocaleString()} cumulative (${day.lead_count} leads)`);
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testAPI();
