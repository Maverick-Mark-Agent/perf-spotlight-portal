const https = require('https');

const options = {
  hostname: 'gjqbbgrfhijescaouqkx.supabase.co',
  path: '/functions/v1/cached-email-accounts',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODA5MTU2NywiZXhwIjoyMDQzNjY3NTY3fQ.k-ant-api03-5h09QQR7HYaS9f7vfCjENfm6qJ0qjbGnK2FNwDR3DeVwBM_Q6rw3ne7CTp6h2OBQOfrg9IBD6xnthj6hsYbVJQ-Sum12QAA',
    'Content-Type': 'application/json'
  },
  timeout: 300000
};

console.log('🔑 Testing with SERVICE ROLE key...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const recordCount = json.records?.length || 0;
      const cacheStatus = res.headers['x-cache-status'] || 'UNKNOWN';

      console.log('✅ Response received!');
      console.log(`   Cache Status: ${cacheStatus}`);
      console.log(`   Total Records: ${recordCount}`);

      if (recordCount > 0) {
        console.log('\n📊 Sample workspaces:');
        const workspaces = {};
        json.records.slice(0, 100).forEach(r => {
          const ws = r.fields?.Workspace || 'Unknown';
          workspaces[ws] = (workspaces[ws] || 0) + 1;
        });
        Object.entries(workspaces).slice(0, 5).forEach(([name, count]) => {
          console.log(`   - ${name}: ${count} accounts`);
        });
      }
    } catch (error) {
      console.error('❌ Error parsing JSON:', error.message);
      console.log('Response preview:', data.substring(0, 500));
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

req.on('timeout', () => {
  req.destroy();
  console.error('❌ Request timeout');
});

req.end();
