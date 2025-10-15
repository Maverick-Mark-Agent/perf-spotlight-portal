import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGreggZipMonth() {
  console.log('\n=== Checking Gregg Blanchard ZIP entries ===\n');

  const { data: zips } = await supabase
    .from('client_zipcodes')
    .select('*')
    .eq('workspace_name', 'Gregg Blanchard')
    .order('month', { ascending: false });

  console.log(`Found ${zips?.length || 0} ZIP entries:`);
  zips?.forEach(z => {
    console.log(`  Month: ${z.month}, ZIP: ${z.zip}, Color: ${z.agency_color}`);
  });

  const currentMonth = new Date().toISOString().slice(0, 7);
  console.log(`\nCurrent month: ${currentMonth}`);

  const currentMonthEntry = zips?.find(z => z.month === currentMonth);
  if (currentMonthEntry) {
    console.log('✅ Has entry for current month');
  } else {
    console.log('❌ NO entry for current month - this is why he doesn\'t show in ZIP Dashboard');
  }
}

checkGreggZipMonth();
