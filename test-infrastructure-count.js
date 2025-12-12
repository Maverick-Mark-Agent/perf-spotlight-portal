// Test script to debug Infrastructure dashboard account count discrepancy
// This will test the Edge Function and check for data inconsistencies

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

async function testInfrastructureData() {
  console.log('🔍 Testing Infrastructure Dashboard Data...\n');

  try {
    // Test the Edge Function
    console.log('📡 Calling hybrid-email-accounts-v2 Edge Function...');
    const startTime = Date.now();

    const response = await fetch(`${SUPABASE_URL}/functions/v1/hybrid-email-accounts-v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const duration = Date.now() - startTime;
    console.log(`⏱️  Response time: ${duration}ms\n`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Analysis
    console.log('📊 DATA ANALYSIS:');
    console.log('==========================================');
    console.log(`Total Records Returned: ${data.records?.length || 0}`);

    if (data.records) {
      // Count by Bison Instance
      const instanceCounts = {};
      const workspaceCounts = {};
      const statusCounts = {};
      const providerCounts = {};
      const resellerCounts = {};

      data.records.forEach(record => {
        const instance = record.fields['Bison Instance'] || 'Unknown';
        const workspace = record.fields['Workspace'] || 'Unknown';
        const status = record.fields['Status'] || 'Unknown';
        const provider = record.fields['Tag - Email Provider'] || 'Unknown';
        const reseller = record.fields['Tag - Reseller'] || 'Unknown';

        instanceCounts[instance] = (instanceCounts[instance] || 0) + 1;
        workspaceCounts[workspace] = (workspaceCounts[workspace] || 0) + 1;
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        providerCounts[provider] = (providerCounts[provider] || 0) + 1;
        resellerCounts[reseller] = (resellerCounts[reseller] || 0) + 1;
      });

      console.log('\n📍 By Bison Instance:');
      Object.entries(instanceCounts).forEach(([instance, count]) => {
        console.log(`  ${instance}: ${count} accounts`);
      });

      console.log('\n📁 By Workspace (Top 10):');
      Object.entries(workspaceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([workspace, count]) => {
          console.log(`  ${workspace}: ${count} accounts`);
        });

      console.log('\n✅ By Status:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count} accounts`);
      });

      console.log('\n📧 By Email Provider:');
      Object.entries(providerCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([provider, count]) => {
          console.log(`  ${provider}: ${count} accounts`);
        });

      console.log('\n🏢 By Reseller:');
      Object.entries(resellerCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([reseller, count]) => {
          console.log(`  ${reseller}: ${count} accounts`);
        });

      console.log('\n==========================================');
      console.log(`\n✅ TOTAL UNIQUE EMAIL ACCOUNTS: ${data.records.length}`);

      // Check for duplicates
      const emailAddresses = new Set();
      const duplicates = [];
      data.records.forEach(record => {
        const email = record.fields['Email Account'];
        if (emailAddresses.has(email)) {
          duplicates.push(email);
        }
        emailAddresses.add(email);
      });

      if (duplicates.length > 0) {
        console.log(`\n⚠️  WARNING: Found ${duplicates.length} duplicate email addresses!`);
        console.log('   First 10 duplicates:');
        duplicates.slice(0, 10).forEach(email => console.log(`   - ${email}`));
      } else {
        console.log('\n✅ No duplicate email addresses found');
      }

      console.log(`\n📊 Expected count: ~4,500 accounts`);
      console.log(`📊 Actual count: ${data.records.length} accounts`);

      const difference = Math.abs(4500 - data.records.length);
      if (difference > 100) {
        console.log(`\n❌ SIGNIFICANT DISCREPANCY: Off by ${difference} accounts!`);
      } else if (difference > 10) {
        console.log(`\n⚠️  Minor discrepancy: Off by ${difference} accounts`);
      } else {
        console.log(`\n✅ Count is within acceptable range (±${difference} accounts)`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

// Run the test
testInfrastructureData();
