import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://gjqbbgrfhijescaouqkx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkStructure() {
  console.log('🔍 Checking sender_emails_cache structure...\n');

  // Get sample row
  const { data, error } = await supabase
    .from('sender_emails_cache')
    .select('*')
    .limit(3);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('❌ No data found in sender_emails_cache');
    return;
  }

  console.log(`✅ Found ${data.length} sample rows\n`);
  console.log('📊 Sample Row Structure:\n');
  console.log(JSON.stringify(data[0], null, 2));

  console.log('\n📋 Available Columns:');
  Object.keys(data[0]).forEach(key => {
    console.log(`  - ${key}: ${typeof data[0][key]} = ${data[0][key]}`);
  });

  // Check if reply_rate_percentage exists
  if ('reply_rate_percentage' in data[0]) {
    console.log('\n✅ reply_rate_percentage column EXISTS');
  } else {
    console.log('\n❌ reply_rate_percentage column MISSING');
    console.log('   Need to add this calculated column');
  }
}

checkStructure().catch(console.error);
