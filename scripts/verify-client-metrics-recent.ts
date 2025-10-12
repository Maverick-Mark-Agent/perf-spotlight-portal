import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyRecentMetrics() {
  console.log('=== Sample Data from Most Recent Date (2025-10-10) ===\n');

  const { data: sampleData, error: sampleError } = await supabase
    .from('client_metrics')
    .select('workspace_name, metric_type, positive_replies_mtd, emails_sent_mtd, metric_date')
    .eq('metric_date', '2025-10-10')
    .eq('metric_type', 'mtd')
    .limit(5);

  if (sampleError) {
    console.error('Error fetching sample data:', sampleError);
  } else {
    console.log('Sample of 5 records from 2025-10-10:');
    console.table(sampleData);
  }

  // Also check all unique dates
  console.log('\n=== All Unique Dates in client_metrics ===\n');
  const { data: allDates, error: datesError } = await supabase
    .from('client_metrics')
    .select('metric_date')
    .order('metric_date', { ascending: false });

  if (datesError) {
    console.error('Error fetching dates:', datesError);
  } else if (allDates) {
    const uniqueDates = [...new Set(allDates.map(d => d.metric_date))];
    console.log('Unique metric_date values:');
    uniqueDates.forEach(date => console.log(`  - ${date}`));
  }
}

verifyRecentMetrics().catch(console.error);
