import { BisonConnector } from '@connectors/bison';
import { logger } from '@lib/logger';

async function testBisonLogin() {
  const bison = new BisonConnector();

  try {
    await bison.connect('TestWorkspace');
    logger.info('✅ Bison login test passed');
    await bison.disconnect();
  } catch (error) {
    logger.error('❌ Bison login test failed', { error });
    throw error;
  }
}

async function testBisonImport() {
  const bison = new BisonConnector();

  try {
    await bison.connect('TestWorkspace');

    const count = await bison.importContacts({
      workspace: 'TestWorkspace',
      csvPath: 'tests/fixtures/test-contacts.csv',
      listName: 'Test Import',
      fieldMapping: {
        'Email_Address': 'email',
        'First_Name': 'first_name',
        'Last_Name': 'last_name',
      },
    });

    logger.info('✅ Bison import test passed', { count });
    await bison.disconnect();
  } catch (error) {
    logger.error('❌ Bison import test failed', { error });
    throw error;
  }
}

async function runTests() {
  console.log('Running Bison connector tests...\n');

  await testBisonLogin();
  await testBisonImport();

  console.log('\n✅ All Bison tests passed!');
}

runTests().catch((error) => {
  console.error('Tests failed:', error);
  process.exit(1);
});
