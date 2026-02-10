import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyClientMetrics() {
  console.log('=== Client Metrics Verification for 2025-10-12 ===\n');

  // 1. Check if there is ANY data for today with metric_type = 'mtd'
  console.log('1. Checking for data on 2025-10-12 with metric_type = "mtd"...');
  const { data: todayData, error: todayError, count: todayCount } = await supabase
    .from('client_metrics')
    .select('*', { count: 'exact' })
    .eq('metric_date', '2025-10-12')
    .eq('metric_type', 'mtd');

  if (todayError) {
    console.error('Error querying today\'s data:', todayError);
  } else {
    console.log(`   Found ${todayCount} records for 2025-10-12 with metric_type = 'mtd'\n`);
  }

  // 2. If data exists, get a sample of 3 records
  if (todayCount && todayCount > 0) {
    console.log('2. Sample of 3 records (workspace_name, positive_replies_mtd, emails_sent_mtd):');
    const { data: sampleData, error: sampleError } = await supabase
      .from('client_metrics')
      .select('workspace_name, positive_replies_mtd, emails_sent_mtd')
      .eq('metric_date', '2025-10-12')
      .eq('metric_type', 'mtd')
      .limit(3);

    if (sampleError) {
      console.error('Error fetching sample data:', sampleError);
    } else {
      console.table(sampleData);
    }
  } else {
    console.log('2. No data found for today, skipping sample.\n');
  }

  // 3. Check the most recent metric_date in the table
  console.log('3. Finding most recent metric_date in client_metrics...');
  const { data: recentData, error: recentError } = await supabase
    .from('client_metrics')
    .select('metric_date')
    .order('metric_date', { ascending: false })
    .limit(1);

  if (recentError) {
    console.error('Error fetching most recent date:', recentError);
  } else if (recentData && recentData.length > 0) {
    console.log(`   Most recent metric_date: ${recentData[0].metric_date}\n`);
  } else {
    console.log('   No data found in client_metrics table.\n');
  }

  // 4. Count total records by metric_date for the last 7 days
  console.log('4. Record counts by metric_date for the last 7 days:');
  const { data: countData, error: countError } = await supabase
    .from('client_metrics')
    .select('metric_date')
    .gte('metric_date', '2025-10-05')
    .lte('metric_date', '2025-10-12')
    .order('metric_date', { ascending: false });

  if (countError) {
    console.error('Error fetching count data:', countError);
  } else if (countData) {
    // Group by metric_date and count
    const countsByDate = countData.reduce((acc: Record<string, number>, record) => {
      const date = record.metric_date;
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    // Convert to array and sort
    const sortedCounts = Object.entries(countsByDate)
      .map(([date, count]) => ({ metric_date: date, record_count: count }))
      .sort((a, b) => b.metric_date.localeCompare(a.metric_date));

    console.table(sortedCounts);
  }

  console.log('\n=== Verification Complete ===');
}

verifyClientMetrics().catch(console.error);
