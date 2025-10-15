/**
 * Test the updated revenue-analytics Edge Function with detailed error logging
 */

async function testAPI() {
  console.log('🧪 Testing revenue-analytics Edge Function...\n');

  try {
    const response = await fetch('https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/revenue-analytics', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    const text = await response.text();
    console.log('\nResponse body:');
    console.log(text);

    if (!response.ok) {
      console.error('\n❌ Function returned error');
      return;
    }

    const data = JSON.parse(text);
    console.log('\n✅ Function succeeded!');
    console.log('\nKeys in response:', Object.keys(data));

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testAPI();
