// Test the cache sync function
const https = require('https');

const options = {
  hostname: 'gjqbbgrfhijescaouqkx.supabase.co',
  path: '/functions/v1/sync-email-accounts-cache',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODA5MTU2NywiZXhwIjoyMDQzNjY3NTY3fQ.k-ant-api03-5h09QQR7HYaS9f7vfCjENfm6qJ0qjbGnK2FNwDR3DeVwBM_Q6rw3ne7CTp6h2OBQOfrg9IBD6xnthj6hsYbVJQ-Sum12QAA',
    'Content-Type': 'application/json',
    'x-triggered-by': 'manual'
  },
  timeout: 600000 // 10 minutes
};

console.log('🚀 Triggering email accounts cache sync...\n');
console.log('This will:');
console.log('  1. Fetch all accounts from Email Bison API');
console.log('  2. Store them in email_accounts_cache table');
console.log('  3. Refresh materialized view');
console.log('  4. Log the operation\n');
console.log('This may take a few minutes...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);

      console.log('✅ CACHE SYNC COMPLETED!\n');
      console.log('═'.repeat(50));
      console.log(`Status: ${json.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`Duration: ${json.duration_seconds}s`);
      console.log(`Total Accounts Cached: ${json.total_accounts || 0}`);
      console.log(`Failed Upserts: ${json.failed_upserts || 0}`);

      if (json.summary) {
        console.log('\n📊 SUMMARY:');
        console.log(`Total Workspaces: ${json.summary.total_workspaces || 0}`);

        if (json.summary.instance_counts) {
          console.log('\nAccounts by Instance:');
          Object.entries(json.summary.instance_counts).forEach(([instance, count]) => {
            console.log(`  - ${instance}: ${count}`);
          });
        }

        if (json.summary.top_workspaces) {
          console.log('\nTop 10 Workspaces:');
          json.summary.top_workspaces.forEach((ws) => {
            console.log(`  - ${ws.name}: ${ws.count} accounts`);
          });
        }
      }

      console.log('═'.repeat(50));
      console.log('\n✅ Your dashboard will now use cached data!');
      console.log('   Data refreshes automatically every 30 minutes.');

    } catch (error) {
      console.error('❌ Error parsing response:', error.message);
      console.log('Response:', data.substring(0, 1000));
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

req.on('timeout', () => {
  req.destroy();
  console.error('❌ Request timeout (10 minutes)');
});

req.end();
