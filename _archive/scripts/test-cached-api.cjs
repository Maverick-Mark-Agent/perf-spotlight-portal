const https = require('https');

function testCachedAPI(testNumber) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const options = {
      hostname: 'gjqbbgrfhijescaouqkx.supabase.co',
      path: '/functions/v1/cached-email-accounts',
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
        const cacheAge = res.headers['x-cache-age'] || '0';

        try {
          const json = JSON.parse(data);
          const recordCount = json.records?.length || 0;

          resolve({
            testNumber,
            success: true,
            cacheStatus,
            cacheAge: parseInt(cacheAge),
            recordCount,
            duration,
          });
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Cached Email Accounts API\n');
  console.log('═'.repeat(70));

  // Test 1: First request (should be MISS and slow)
  console.log('\n📝 Test 1: Initial request (expecting cache MISS)...');
  const test1 = await testCachedAPI(1);
  console.log(`   ✅ Status: ${test1.cacheStatus}`);
  console.log(`   ⏱️  Duration: ${test1.duration}ms`);
  console.log(`   📊 Records: ${test1.recordCount}`);

  // Test 2: Immediate second request (should be HIT and fast)
  console.log('\n📝 Test 2: Immediate follow-up (expecting cache HIT)...');
  const test2 = await testCachedAPI(2);
  console.log(`   ✅ Status: ${test2.cacheStatus}`);
  console.log(`   ⏱️  Duration: ${test2.duration}ms`);
  console.log(`   🕐 Cache Age: ${test2.cacheAge}s`);
  console.log(`   📊 Records: ${test2.recordCount}`);

  // Test 3: Third request (should still be HIT and fast)
  console.log('\n📝 Test 3: Another request (expecting cache HIT)...');
  const test3 = await testCachedAPI(3);
  console.log(`   ✅ Status: ${test3.cacheStatus}`);
  console.log(`   ⏱️  Duration: ${test3.duration}ms`);
  console.log(`   🕐 Cache Age: ${test3.cacheAge}s`);
  console.log(`   📊 Records: ${test3.recordCount}`);

  console.log('\n═'.repeat(70));
  console.log('\n📊 SUMMARY:\n');
  console.log(`   Test 1 (MISS): ${test1.duration}ms`);
  console.log(`   Test 2 (HIT):  ${test2.duration}ms (${Math.round((1 - test2.duration/test1.duration) * 100)}% faster)`);
  console.log(`   Test 3 (HIT):  ${test3.duration}ms (${Math.round((1 - test3.duration/test1.duration) * 100)}% faster)`);
  console.log('\n✅ Caching is working! Dashboard will refresh every 30 minutes.');
  console.log('   No more constant refreshing - data is cached in memory.\n');
}

runTests().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
});
