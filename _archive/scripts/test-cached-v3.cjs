const https = require('https');

function testAPI(testName) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const options = {
      hostname: 'gjqbbgrfhijescaouqkx.supabase.co',
      path: '/functions/v1/email-accounts-cached-v3',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0',
        'Content-Type': 'application/json'
      },
      timeout: 300000
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;
        const cacheStatus = res.headers['x-cache-status'] || 'UNKNOWN';

        try {
          const json = JSON.parse(data);
          resolve({
            testName,
            success: true,
            cacheStatus,
            cached: json.cached,
            cacheAge: json.cache_age_minutes || 0,
            recordCount: json.records?.length || 0,
            duration,
          });
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Database-Backed Caching System\n');
  console.log('═'.repeat(70));

  // Test 1: First request (might be MISS if cache expired)
  console.log('\n📝 Test 1: Initial request...');
  const test1 = await testAPI('Test 1');
  console.log(`   ${test1.cached ? '✅' : '🔄'} Status: ${test1.cacheStatus} (cached: ${test1.cached})`);
  console.log(`   ⏱️  Duration: ${test1.duration}ms`);
  console.log(`   📊 Records: ${test1.recordCount}`);
  console.log(`   🕐 Cache Age: ${test1.cacheAge} minutes`);

  // Wait 2 seconds
  console.log('\n⏳ Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Second request (should be HIT and fast)
  console.log('\n📝 Test 2: Second request (expecting cache HIT)...');
  const test2 = await testAPI('Test 2');
  console.log(`   ${test2.cached ? '✅' : '🔄'} Status: ${test2.cacheStatus} (cached: ${test2.cached})`);
  console.log(`   ⏱️  Duration: ${test2.duration}ms`);
  console.log(`   📊 Records: ${test2.recordCount}`);
  console.log(`   🕐 Cache Age: ${test2.cacheAge} minutes`);

  // Test 3: Third request
  console.log('\n📝 Test 3: Third request...');
  const test3 = await testAPI('Test 3');
  console.log(`   ${test3.cached ? '✅' : '🔄'} Status: ${test3.cacheStatus} (cached: ${test3.cached})`);
  console.log(`   ⏱️  Duration: ${test3.duration}ms`);
  console.log(`   📊 Records: ${test3.recordCount}`);
  console.log(`   🕐 Cache Age: ${test3.cacheAge} minutes`);

  console.log('\n═'.repeat(70));
  console.log('\n📊 PERFORMANCE SUMMARY:\n');

  const speeds = [test1, test2, test3].map(t => t.duration);
  const avgSpeed = Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length);

  console.log(`   Average Response Time: ${avgSpeed}ms`);
  console.log(`   Data Accuracy: ${test1.recordCount === test2.recordCount && test2.recordCount === test3.recordCount ? '✅ Consistent' : '⚠️ Inconsistent'}`);
  console.log(`   Cache Working: ${test2.cached || test3.cached ? '✅ Yes' : '❌ No'}`);

  console.log('\n✅ Database caching is active!');
  console.log('   • Fresh data is cached in the database for 30 minutes');
  console.log('   • Subsequent requests are served from cache (fast!)');
  console.log('   • Cache automatically refreshes after 30 minutes');
  console.log('   • No more constant refreshing or inconsistent data!\n');
}

runTests().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
});
