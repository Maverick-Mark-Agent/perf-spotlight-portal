import { ColeConnector } from '@connectors/cole';
import { COLE_REQUIRED_FIELDS } from '@connectors/cole-config';
import { logger } from '@lib/logger';

async function testColeLogin() {
  const cole = new ColeConnector();

  try {
    await cole.connect('NJ');
    logger.info('✅ Cole login test passed');
    await cole.disconnect();
  } catch (error) {
    logger.error('❌ Cole login test failed', { error });
    throw error;
  }
}

async function testColeQuery() {
  const cole = new ColeConnector();

  try {
    await cole.connect('NJ');

    const result = await cole.queryData({
      state: 'NJ',
      zips: ['07030', '07031'], // Test with 2 ZIPs
      fields: COLE_REQUIRED_FIELDS,
    });

    logger.info('✅ Cole query test passed', {
      recordCount: result.totalCount,
      chunks: result.chunks
    });

    await cole.disconnect();
  } catch (error) {
    logger.error('❌ Cole query test failed', { error });
    throw error;
  }
}

async function runTests() {
  console.log('Running Cole connector tests...\n');

  await testColeLogin();
  await testColeQuery();

  console.log('\n✅ All Cole tests passed!');
}

runTests().catch((error) => {
  console.error('Tests failed:', error);
  process.exit(1);
});
