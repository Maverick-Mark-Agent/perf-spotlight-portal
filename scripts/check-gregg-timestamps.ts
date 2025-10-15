import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkGreggTimestamps() {
  console.log('Checking Gregg Blanchard ZIP timestamps...\n');

  const { data, error } = await supabase
    .from('client_zipcodes')
    .select('zip, month, inserted_at, pulled_at, agency_color')
    .eq('client_name', 'Gregg Blanchard')
    .eq('month', '2025-11')
    .order('inserted_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Found ${data?.length || 0} ZIPs for Gregg Blanchard in 2025-11`);
    console.log('\nMost recent assignments:');
    data?.forEach((zip, i) => {
      const insertedAt = new Date(zip.inserted_at);
      const now = new Date();
      const minutesAgo = Math.floor((now.getTime() - insertedAt.getTime()) / 1000 / 60);
      console.log(`${i + 1}. ZIP ${zip.zip}: inserted ${minutesAgo} minutes ago (${zip.inserted_at})`);
    });
  }

  // Get total count
  const { count } = await supabase
    .from('client_zipcodes')
    .select('*', { count: 'exact', head: true })
    .eq('client_name', 'Gregg Blanchard')
    .eq('month', '2025-11');

  console.log(`\nTotal ZIPs for Gregg Blanchard in 2025-11: ${count}`);
}

checkGreggTimestamps();
