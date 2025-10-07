import { createClient } from '@supabase/supabase-js';

// Test with ANON key (what the frontend uses)
const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function testAccess() {
  console.log('\n🔍 Testing frontend access to client_zipcodes...\n');

  const { data, error, count } = await supabase
    .from('client_zipcodes')
    .select('zip,state,client_name,workspace_name,agency_color', { count: 'exact' })
    .eq('month', '2025-11')
    .limit(5);

  if (error) {
    console.log('❌ Error accessing data with anon key:');
    console.log('   Message:', error.message);
    console.log('   Code:', error.code);
    console.log('   Details:', error.details);
    console.log('\n⚠️  This means the frontend cannot access the data!');
    console.log('   The RLS policies may be blocking authenticated users.\n');
    return false;
  }

  console.log('✅ Success! Frontend can access the data');
  console.log(`   Total rows for 2025-11: ${count}`);
  console.log(`   Sample (first 5):`);
  data?.forEach(row => {
    console.log(`      ${row.zip} - ${row.client_name} (${row.agency_color})`);
  });
  console.log('');
  return true;
}

testAccess();
