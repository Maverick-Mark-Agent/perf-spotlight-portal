import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixGreggZip() {
  console.log('\n=== Creating ZIP placeholder for Gregg Blanchard ===\n');

  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data, error } = await supabase
    .from('client_zipcodes')
    .insert({
      zip: '00000',
      month: currentMonth,
      client_name: 'Gregg Blanchard',
      workspace_name: 'Gregg Blanchard',
      agency_color: '#73f50f',
      state: null,
    })
    .select();

  if (error) {
    console.error('❌ Error creating ZIP entry:', error);
  } else {
    console.log('✅ ZIP placeholder created successfully!');
    console.log(data);
  }

  // Verify it exists
  const { data: verify } = await supabase
    .from('client_zipcodes')
    .select('*')
    .eq('workspace_name', 'Gregg Blanchard');

  console.log(`\nVerification: Found ${verify?.length || 0} ZIP entries for Gregg Blanchard`);
}

fixGreggZip();
