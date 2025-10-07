import { logger } from '@lib/logger';
import { retry } from '@lib/retry';
import { classifyError, ErrorType } from '@lib/errors/taxonomy';

async function testLogger() {
  console.log('\n=== Testing Logger ===\n');

  logger.debug('This is a debug message', { user: 'test' });
  logger.info('This is an info message', { status: 'running' });
  logger.warn('This is a warning', { threshold: 0.8 });
  logger.error('This is an error', { code: 'TEST_ERROR' });

  console.log('\n=== Testing Child Logger ===\n');

  const childLogger = logger.child({ runId: '12345', client: 'TestClient' });
  childLogger.info('Child logger message');

  console.log('\n✅ Logger tests complete\n');
}

async function testRetry() {
  console.log('\n=== Testing Retry Logic ===\n');

  let attempts = 0;
  const failingFunction = async () => {
    attempts++;
    if (attempts < 3) {
      throw new Error('Temporary failure');
    }
    return 'Success!';
  };

  try {
    const result = await retry(failingFunction, {
      maxRetries: 3,
      initialDelayMs: 100,
      onRetry: (attempt, error) => {
        console.log(`Retry attempt ${attempt}: ${error.message}`);
      },
    });

    console.log(`✅ Retry succeeded: ${result}\n`);
  } catch (error) {
    console.error(`❌ Retry failed: ${error}\n`);
  }
}

async function testErrorClassification() {
  console.log('\n=== Testing Error Classification ===\n');

  const testCases = [
    { error: new Error('Authentication failed'), expected: ErrorType.AUTH_FAILED },
    { error: new Error('Captcha detected'), expected: ErrorType.CAPTCHA_DETECTED },
    { error: new Error('Selector not found'), expected: ErrorType.SELECTOR_NOT_FOUND },
    { error: new Error('Network timeout occurred'), expected: ErrorType.NETWORK_TIMEOUT },
    { error: new Error('Rate limit exceeded'), expected: ErrorType.RATE_LIMITED },
  ];

  for (const testCase of testCases) {
    const classified = classifyError(testCase.error);
    const passed = classified === testCase.expected;
    console.log(`${passed ? '✅' : '❌'} "${testCase.error.message}" → ${classified}`);
  }

  console.log('\n✅ Error classification tests complete\n');
}

async function runTests() {
  await testLogger();
  await testRetry();
  await testErrorClassification();

  console.log('✅ All tests complete!\n');
  console.log('Note: Error tracker test requires valid .env credentials.\n');
  console.log('Run with credentials to test database persistence.\n');
}

runTests().catch(console.error);
