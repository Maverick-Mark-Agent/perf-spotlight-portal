// Setup Node.js environment with browser globals
import '../setup/node-globals';

import {
  fetchKPIDataRealtime,
  fetchVolumeDataRealtime,
  fetchInfrastructureDataRealtime,
  fetchClientLeadsRealtime,
  checkSystemHealth
} from '../../src/services/realtimeDataService';
import { logger } from '../../src/lib/logger';

async function testFetchKPIDataRealtime() {
  console.log('\n=== Testing fetchKPIDataRealtime ===\n');

  try {
    const startTime = Date.now();
    const result = await fetchKPIDataRealtime();
    const duration = Date.now() - startTime;

    console.log('✅ KPI Data fetch completed');
    console.log(`⏱️  Duration: ${duration}ms (expected: <500ms)`);
    console.log(`📊 Success: ${result.success}`);
    console.log(`🔄 Fresh: ${result.fresh}`);
    console.log(`📈 Data length: ${result.data?.length || 0}`);

    if (result.success && result.data) {
      console.log('📋 Sample KPI client:', {
        name: result.data[0]?.name,
        positiveReplies: result.data[0]?.positiveRepliesMTD,
        target: result.data[0]?.monthlyKPITarget
      });
    }

    if (result.error) {
      console.log('❌ Error:', result.error);
      throw new Error(`KPI fetch failed: ${result.error}`);
    }

    // Performance check
    if (duration > 1000) {
      console.log('⚠️  Performance warning: fetch took longer than 1s');
    }

    return result;
  } catch (error) {
    console.log('❌ KPI Data test failed:', error);
    throw error;
  }
}

async function testFetchVolumeDataRealtime() {
  console.log('\n=== Testing fetchVolumeDataRealtime ===\n');

  try {
    const startTime = Date.now();
    const result = await fetchVolumeDataRealtime();
    const duration = Date.now() - startTime;

    console.log('✅ Volume Data fetch completed');
    console.log(`⏱️  Duration: ${duration}ms (expected: <300ms)`);
    console.log(`📊 Success: ${result.success}`);
    console.log(`🔄 Fresh: ${result.fresh}`);
    console.log(`📈 Data length: ${result.data?.length || 0}`);

    if (result.success && result.data) {
      console.log('📋 Sample volume client:', {
        name: result.data[0]?.name,
        rank: result.data[0]?.rank,
        volume: result.data[0]?.volumeMTD
      });
    }

    if (result.error) {
      console.log('❌ Error:', result.error);
      throw new Error(`Volume fetch failed: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.log('❌ Volume Data test failed:', error);
    throw error;
  }
}

async function testFetchInfrastructureDataRealtime() {
  console.log('\n=== Testing fetchInfrastructureDataRealtime ===\n');

  try {
    const startTime = Date.now();
    const result = await fetchInfrastructureDataRealtime();
    const duration = Date.now() - startTime;

    console.log('✅ Infrastructure Data fetch completed');
    console.log(`⏱️  Duration: ${duration}ms (expected: <1000ms)`);
    console.log(`📊 Success: ${result.success}`);
    console.log(`🔄 Fresh: ${result.fresh}`);
    console.log(`📈 Data length: ${result.data?.length || 0}`);

    if (result.success && result.data) {
      console.log('📋 Sample email account:', {
        email: result.data[0]?.email,
        provider: result.data[0]?.provider,
        status: result.data[0]?.status
      });
    }

    if (result.error) {
      console.log('❌ Error:', result.error);
      throw new Error(`Infrastructure fetch failed: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.log('❌ Infrastructure Data test failed:', error);
    throw error;
  }
}

async function testFetchClientLeadsRealtime() {
  console.log('\n=== Testing fetchClientLeadsRealtime ===\n');

  try {
    const startTime = Date.now();
    const result = await fetchClientLeadsRealtime('demo-workspace');
    const duration = Date.now() - startTime;

    console.log('✅ Client Leads fetch completed');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📊 Success: ${result.success}`);
    console.log(`🔄 Fresh: ${result.fresh}`);
    console.log(`📈 Data length: ${result.data?.length || 0}`);

    if (result.success && result.data) {
      console.log('📋 Sample lead:', {
        email: result.data[0]?.email,
        status: result.data[0]?.status,
        created: result.data[0]?.createdAt
      });
    }

    if (result.error) {
      console.log('❌ Error:', result.error);
      throw new Error(`Client leads fetch failed: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.log('❌ Client Leads test failed:', error);
    throw error;
  }
}

async function testCheckSystemHealth() {
  console.log('\n=== Testing checkSystemHealth ===\n');

  try {
    const health = await checkSystemHealth();

    console.log('✅ System Health check completed');
    console.log('🏥 Database:', health.database);
    console.log('🔄 Polling:', health.polling);
    console.log('🪝 Webhooks:', health.webhooks);

    // Check if all systems are healthy
    const allHealthy = health.database.status === 'healthy' &&
                      health.polling.status === 'healthy' &&
                      health.webhooks.status === 'healthy';

    console.log(`📊 Overall Health: ${allHealthy ? '✅ All systems healthy' : '⚠️  Some systems degraded'}`);

    return health;
  } catch (error) {
    console.log('❌ System Health test failed:', error);
    throw error;
  }
}

async function testPerformanceComparison() {
  console.log('\n=== Performance Comparison Test ===\n');

  try {
    // Test all functions sequentially and measure total time
    const startTime = Date.now();

    console.log('🚀 Starting performance test...');

    const [kpiResult, volumeResult, infraResult] = await Promise.all([
      fetchKPIDataRealtime(),
      fetchVolumeDataRealtime(),
      fetchInfrastructureDataRealtime()
    ]);

    const totalDuration = Date.now() - startTime;

    console.log('✅ All fetches completed');
    console.log(`⏱️  Total duration: ${totalDuration}ms`);
    console.log(`📊 All successful: ${kpiResult.success && volumeResult.success && infraResult.success}`);

    // Expected performance (much better than Edge Functions)
    const expectedMaxTime = 2000; // 2 seconds total
    if (totalDuration > expectedMaxTime) {
      console.log(`⚠️  Performance warning: ${totalDuration}ms > ${expectedMaxTime}ms expected`);
    } else {
      console.log(`🚀 Performance excellent: ${totalDuration}ms < ${expectedMaxTime}ms expected`);
    }

    return {
      totalDuration,
      kpiDuration: kpiResult.fetchDurationMs,
      volumeDuration: volumeResult.fetchDurationMs,
      infraDuration: infraResult.fetchDurationMs
    };
  } catch (error) {
    console.log('❌ Performance test failed:', error);
    throw error;
  }
}

async function runRealtimeDataServiceTests() {
  console.log('🧪 Running Real-Time Data Service Tests...\n');
  console.log('='.repeat(60));

  const results: any = {
    kpi: null,
    volume: null,
    infrastructure: null,
    clientLeads: null,
    systemHealth: null,
    performance: null
  };

  try {
    // Test individual functions
    results.kpi = await testFetchKPIDataRealtime();
    results.volume = await testFetchVolumeDataRealtime();
    results.infrastructure = await testFetchInfrastructureDataRealtime();
    results.clientLeads = await testFetchClientLeadsRealtime();
    results.systemHealth = await testCheckSystemHealth();

    // Test performance
    results.performance = await testPerformanceComparison();

    console.log('\n' + '='.repeat(60));
    console.log('🎉 All Real-Time Data Service tests passed!');
    console.log('='.repeat(60));

    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`✅ KPI Data: ${results.kpi?.data?.length || 0} clients`);
    console.log(`✅ Volume Data: ${results.volume?.data?.length || 0} clients`);
    console.log(`✅ Infrastructure: ${results.infrastructure?.data?.length || 0} accounts`);
    console.log(`✅ Client Leads: ${results.clientLeads?.data?.length || 0} leads`);
    console.log(`🏥 System Health: ${results.systemHealth?.database.status}/${results.systemHealth?.polling.status}/${results.systemHealth?.webhooks.status}`);
    console.log(`⏱️  Performance: ${results.performance?.totalDuration}ms total`);

  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ Some tests failed:', error);
    console.log('='.repeat(60));
    throw error;
  }
}

// Export for use in other test files
export {
  testFetchKPIDataRealtime,
  testFetchVolumeDataRealtime,
  testFetchInfrastructureDataRealtime,
  testFetchClientLeadsRealtime,
  testCheckSystemHealth,
  testPerformanceComparison,
  runRealtimeDataServiceTests
};

// Run tests if this file is executed directly
runRealtimeDataServiceTests()
  .then(() => {
    console.log('\n✅ All tests completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Tests failed:', error);
    process.exit(1);
  });