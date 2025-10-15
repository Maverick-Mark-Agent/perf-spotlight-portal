import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixZipStatesDirect() {
  console.log('🔧 Fixing ZIP states using direct SQL UPDATE...\n');

  try {
    // Execute raw SQL to update states
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        UPDATE client_zipcodes
        SET state = CASE
          WHEN SUBSTRING(zip FROM 1 FOR 3) BETWEEN '750' AND '799' THEN 'TX'
          WHEN SUBSTRING(zip FROM 1 FOR 3) = '885' THEN 'TX'
          WHEN SUBSTRING(zip FROM 1 FOR 3) BETWEEN '900' AND '961' THEN 'CA'
          WHEN SUBSTRING(zip FROM 1 FOR 3) BETWEEN '600' AND '629' THEN 'IL'
          ELSE NULL
        END
        WHERE month = 'active' AND state IS NULL;
      `
    });

    if (error) {
      console.error('SQL execution error:', error);
      console.log('\n⚠️  RPC function may not exist. Trying alternative approach...\n');

      // Alternative: Update in batches using regular Supabase client
      console.log('Fetching ZIPs to update...');
      const { data: zipsToUpdate } = await supabase
        .from('client_zipcodes')
        .select('zip')
        .eq('month', 'active')
        .is('state', null);

      if (!zipsToUpdate || zipsToUpdate.length === 0) {
        console.log('✅ No ZIPs need updating!');
        return;
      }

      console.log(`Found ${zipsToUpdate.length} ZIPs to update`);
      console.log('Updating in batches...\n');

      // Update Texas ZIPs (75xxx)
      const txZips = zipsToUpdate.filter(z => z.zip.startsWith('75') || z.zip.startsWith('76') || z.zip.startsWith('77') || z.zip.startsWith('78') || z.zip.startsWith('79') || z.zip === '885');
      if (txZips.length > 0) {
        console.log(`Updating ${txZips.length} Texas ZIPs...`);
        const { error: txError } = await supabase
          .from('client_zipcodes')
          .update({ state: 'TX' })
          .eq('month', 'active')
          .in('zip', txZips.map(z => z.zip));

        if (txError) console.error('TX update error:', txError);
        else console.log('✓ Texas ZIPs updated');
      }

      // Update California ZIPs (90xxx-96xxx)
      const caZips = zipsToUpdate.filter(z => z.zip.startsWith('90') || z.zip.startsWith('91') || z.zip.startsWith('92') || z.zip.startsWith('93') || z.zip.startsWith('94') || z.zip.startsWith('95') || z.zip.startsWith('96'));
      if (caZips.length > 0) {
        console.log(`Updating ${caZips.length} California ZIPs...`);
        const { error: caError } = await supabase
          .from('client_zipcodes')
          .update({ state: 'CA' })
          .eq('month', 'active')
          .in('zip', caZips.map(z => z.zip));

        if (caError) console.error('CA update error:', caError);
        else console.log('✓ California ZIPs updated');
      }

      // Update Illinois ZIPs (60xxx-62xxx)
      const ilZips = zipsToUpdate.filter(z => z.zip.startsWith('60') || z.zip.startsWith('61') || z.zip.startsWith('62'));
      if (ilZips.length > 0) {
        console.log(`Updating ${ilZips.length} Illinois ZIPs...`);
        const { error: ilError } = await supabase
          .from('client_zipcodes')
          .update({ state: 'IL' })
          .eq('month', 'active')
          .in('zip', ilZips.map(z => z.zip));

        if (ilError) console.error('IL update error:', ilError);
        else console.log('✓ Illinois ZIPs updated');
      }
    }

    // Verify
    console.log('\n📊 Verification:');
    const { count: withState } = await supabase
      .from('client_zipcodes')
      .select('*', { count: 'exact', head: true })
      .eq('month', 'active')
      .not('state', 'is', null);

    const { count: withoutState } = await supabase
      .from('client_zipcodes')
      .select('*', { count: 'exact', head: true })
      .eq('month', 'active')
      .is('state', null);

    console.log(`   ZIPs with state: ${withState}`);
    console.log(`   ZIPs without state: ${withoutState}`);

    // Check Kim Wallace
    const { count: kimWithState } = await supabase
      .from('client_zipcodes')
      .select('*', { count: 'exact', head: true })
      .eq('month', 'active')
      .eq('client_name', 'Kim Wallace')
      .not('state', 'is', null);

    console.log(`\n✅ Kim Wallace: ${kimWithState} ZIPs now have states`);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

fixZipStatesDirect();
