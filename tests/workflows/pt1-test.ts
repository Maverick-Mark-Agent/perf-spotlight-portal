import { executePT1 } from '@workflows/pt1-cole-pulls';
import { logger } from '@lib/logger';

async function testPT1() {
  const testConfig = {
    clientId: 1,
    clientName: 'Canary Client',
    workspace: 'Canary Workspace',
    states: ['NJ'],
    zips: ['07030', '07031'],
    month: 'October 2025',
    filters: {
      homeValueMax: 900000,
    },
  };

  logger.info('Testing PT1 workflow', testConfig);

  try {
    await executePT1(testConfig);
    logger.info('✅ PT1 test passed');
  } catch (error) {
    logger.error('❌ PT1 test failed', { error });
    throw error;
  }
}

testPT1().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
