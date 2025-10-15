import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyPolicy() {
  console.log('🔧 Applying anon UPDATE policy to client_zipcodes...\n');

  // Try to execute the policy creation via SQL
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE POLICY IF NOT EXISTS "Allow anon update client_zipcodes"
        ON public.client_zipcodes
        FOR UPDATE
        TO anon
        USING (true)
        WITH CHECK (true);
    `
  });

  if (error) {
    console.error('❌ Could not apply via RPC:', error.message);
    console.log('\n📝 Please apply this SQL manually in Supabase dashboard:');
    console.log('---');
    console.log(`CREATE POLICY IF NOT EXISTS "Allow anon update client_zipcodes"
  ON public.client_zipcodes
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);`);
    console.log('---\n');
  } else {
    console.log('✅ Policy applied successfully!');
  }
}

applyPolicy();
