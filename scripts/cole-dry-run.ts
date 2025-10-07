import { ColeConnector } from '@connectors/cole';
import { COLE_REQUIRED_FIELDS } from '@connectors/cole-config';

async function dryRun() {
  const cole = new ColeConnector();

  console.log('🔍 Cole X Dates Dry Run\n');
  console.log('State: NJ');
  console.log('ZIPs: Test with 5 ZIPs');
  console.log('Fields:', COLE_REQUIRED_FIELDS.length, '\n');

  try {
    await cole.connect('NJ');

    const result = await cole.queryData({
      state: 'NJ',
      zips: ['07030', '07031', '07032', '07033', '07034'],
      fields: COLE_REQUIRED_FIELDS,
      filters: {
        homeValueMax: 900000,
      },
    });

    console.log('\n✅ Dry run complete!');
    console.log(`   Records: ${result.totalCount}`);
    console.log(`   Chunks: ${result.chunks}`);
    console.log(`   Sample record:`, result.records[0]);

    await cole.disconnect();
  } catch (error) {
    console.error('\n❌ Dry run failed:', error);
    await cole.disconnect();
    process.exit(1);
  }
}

dryRun();
