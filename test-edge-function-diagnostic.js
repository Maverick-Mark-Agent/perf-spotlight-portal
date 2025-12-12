// Diagnostic script to test the Email Bison API key directly from the Edge Function environment

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODA5MTU2NywiZXhwIjoyMDQzNjY3NTY3fQ.k-ant-api03-5h09QQR7HYaS9f7vfCjENfm6qJ0qjbGnK2FNwDR3DeVwBM_Q6rw3ne7CTp6h2OBQOfrg9IBD6xnthj6hsYbVJQ-Sum12QAA';

async function main() {
  console.log('🔍 Edge Function Diagnostic Test\n');
  console.log('═'.repeat(60));

  try {
    // Test 1: Call the Edge Function
    console.log('\n📡 Test 1: Calling Edge Function...');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/hybrid-email-accounts-v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Response Status: ${response.status} ${response.statusText}`);

    const data = await response.json();
    console.log(`   Records Returned: ${data.records ? data.records.length : 0}`);

    if (data.error) {
      console.log(`   ❌ Error: ${data.error}`);
    }

    if (data._diagnostic) {
      console.log('\n🔍 Diagnostic Info from Edge Function:');
      console.log(JSON.stringify(data._diagnostic, null, 2));
    }

    // Test 2: Try to read environment variables via a test function
    console.log('\n═'.repeat(60));
    console.log('\n📋 DIAGNOSIS:');
    console.log('─'.repeat(60));

    if (data.records && data.records.length > 0) {
      console.log('✅ Edge Function is working correctly!');
      console.log(`   Total accounts fetched: ${data.records.length}`);
    } else {
      console.log('❌ Edge Function returned 0 accounts');
      console.log('\n🔍 Possible Causes:');
      console.log('   1. EMAIL_BISON_API_KEY is missing from Supabase Secrets');
      console.log('   2. EMAIL_BISON_API_KEY is invalid or expired');
      console.log('   3. EMAIL_BISON_API_KEY lacks required permissions');
      console.log('   4. Email Bison API is down or blocking requests');
      console.log('\n📝 Next Steps:');
      console.log('   1. Check Supabase Function logs in the dashboard:');
      console.log('      https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions/hybrid-email-accounts-v2/logs');
      console.log('   2. Look for diagnostic logs starting with 🔍 [DIAGNOSTIC]');
      console.log('   3. Check if EMAIL_BISON_API_KEY environment variable is present');
      console.log('   4. Check HTTP response codes from Email Bison API');
    }

  } catch (error) {
    console.error('❌ Test Failed:', error.message);
  }

  console.log('\n' + '═'.repeat(60));
}

main();
