const https = require('https');

const options = {
  hostname: 'gjqbbgrfhijescaouqkx.supabase.co',
  path: '/functions/v1/hybrid-email-accounts-v2',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0',
    'Content-Type': 'application/json'
  },
  timeout: 300000
};

console.log('🚀 Fetching infrastructure data...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const records = json.records || [];

      console.log('✅ Data fetched successfully!\n');
      console.log('📊 RESULTS:');
      console.log('═'.repeat(50));
      console.log(`Total Accounts: ${records.length}`);
      console.log('═'.repeat(50));

      // Count by workspace
      const workspaceCounts = {};
      const statusCounts = {};

      records.forEach(record => {
        const workspace = record.fields.Workspace || 'Unknown';
        const status = record.fields.Status || 'Unknown';
        workspaceCounts[workspace] = (workspaceCounts[workspace] || 0) + 1;
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      console.log('\n🏢 TOP 10 WORKSPACES:');
      console.log('─'.repeat(50));
      Object.entries(workspaceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([name, count]) => {
          console.log(`  ${name}: ${count} accounts`);
        });

      console.log('\n⭐ JASON BINYON:');
      console.log('─'.repeat(50));
      const jasonCount = workspaceCounts['Jason Binyon'] || 0;
      console.log(`  Jason Binyon: ${jasonCount} accounts`);
      if (jasonCount !== 433) {
        console.log(`  ⚠️  Expected 433, got ${jasonCount}`);
      }

      console.log('\n📊 STATUS BREAKDOWN:');
      console.log('─'.repeat(50));
      Object.entries(statusCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([status, count]) => {
          console.log(`  ${status}: ${count} accounts`);
        });

      console.log('\n' + '═'.repeat(50));

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
  console.error('❌ Request timeout (5 minutes)');
});

req.end();
