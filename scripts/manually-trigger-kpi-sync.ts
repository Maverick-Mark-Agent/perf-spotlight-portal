/**
 * Manually trigger the sync-daily-kpi-metrics Edge Function
 * This simulates what the cron job should be doing
 */

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/sync-daily-kpi-metrics`;

// Using the anon key - the Edge Function should have its own service role key
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

async function triggerSync() {
  console.log('='.repeat(80));
  console.log('MANUALLY TRIGGERING sync-daily-kpi-metrics Edge Function');
  console.log('='.repeat(80));
  console.log(`URL: ${FUNCTION_URL}`);
  console.log();

  try {
    console.log('Sending POST request...');
    const startTime = Date.now();

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({
        manual_trigger: true,
        timestamp: new Date().toISOString(),
      }),
    });

    const duration = Date.now() - startTime;

    console.log(`Response received in ${duration}ms`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log();

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Function call failed:');
      console.error(errorText);
      return;
    }

    const result = await response.json();

    console.log('✅ Function executed successfully!');
    console.log();
    console.log('Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.results) {
      console.log();
      console.log('Summary:');
      console.log(`  Total clients: ${result.total_clients}`);
      console.log(`  Successful: ${result.successful}`);
      console.log(`  Failed: ${result.failed}`);
      console.log(`  Duration: ${result.duration_ms}ms`);
      console.log(`  Date: ${result.date}`);

      if (result.results.length > 0) {
        console.log();
        console.log('Client Results:');
        result.results.forEach((r: any, idx: number) => {
          const status = r.status === 'success' ? '✅' : r.status === 'failed' ? '❌' : '⚠️';
          console.log(`  ${idx + 1}. ${status} ${r.workspace_name}`);
          if (r.status === 'success') {
            console.log(`     MTD: ${r.positive_replies_mtd}, Projected: ${r.projection_eom}, Target: ${r.target}, Progress: ${r.progress}%`);
          } else if (r.error) {
            console.log(`     Error: ${r.error}`);
          }
        });
      }
    }

  } catch (error) {
    console.error('❌ Error triggering function:');
    console.error(error);
  }

  console.log();
  console.log('='.repeat(80));
}

triggerSync().catch(console.error);
