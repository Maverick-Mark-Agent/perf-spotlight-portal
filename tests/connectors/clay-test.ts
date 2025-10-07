import { ClayConnector } from '@connectors/clay';
import { CLAY_FORMULAS } from '@connectors/clay-config';
import { logger } from '@lib/logger';

async function testClayLogin() {
  const clay = new ClayConnector();

  try {
    await clay.connect();
    logger.info('✅ Clay login test passed');
    await clay.disconnect();
  } catch (error) {
    logger.error('❌ Clay login test failed', { error });
    throw error;
  }
}

async function testClayWorkflow() {
  const clay = new ClayConnector();

  try {
    await clay.connect();

    // Create test workbook
    await clay.createWorkbook('TestClient', 'TestMonth');

    // Import test CSV
    await clay.importCSV({
      clientName: 'TestClient',
      month: 'TestMonth',
      csvPath: 'tests/fixtures/test-leads.csv',
    });

    // Add formula columns
    await clay.addFormulaColumn(CLAY_FORMULAS.numericHomeValue);

    // Export
    const exportPath = await clay.exportCSV({
      outputPath: 'tests/output/clay-export.csv',
    });

    logger.info('✅ Clay workflow test passed', { exportPath });
    await clay.disconnect();
  } catch (error) {
    logger.error('❌ Clay workflow test failed', { error });
    throw error;
  }
}

async function runTests() {
  console.log('Running Clay connector tests...\n');

  await testClayLogin();
  await testClayWorkflow();

  console.log('\n✅ All Clay tests passed!');
}

runTests().catch((error) => {
  console.error('Tests failed:', error);
  process.exit(1);
});
