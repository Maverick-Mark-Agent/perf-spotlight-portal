import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function finalGreggCheck() {
  console.log('\n=== Final Gregg Blanchard Check ===\n');

  const currentMonth = '2025-10';

  // Exactly what ZIP Dashboard queries
  const { data, error } = await supabase
    .from("client_zipcodes")
    .select("zip,state,client_name,workspace_name,agency_color")
    .eq("month", currentMonth)
    .eq("workspace_name", "Gregg Blanchard");

  console.log('Query result:');
  console.log(JSON.stringify(data, null, 2));
  console.log('Error:', error);

  if (data && data.length > 0) {
    console.log('\n✅ Gregg Blanchard SHOULD appear in ZIP Dashboard');
    console.log('   - Has ZIP entry for current month');
    console.log('   - Has agency_color:', data[0].agency_color);
  } else {
    console.log('\n❌ Gregg Blanchard will NOT appear in ZIP Dashboard');
  }
}

finalGreggCheck();
