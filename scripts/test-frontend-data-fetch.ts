import { createClient } from '@supabase/supabase-js';
import { transformToEmailAccount } from '../src/lib/fieldMappings';

const SUPABASE_URL = "https://gjqbbgrfhijescaouqkx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testFetch() {
  console.log('🔍 Testing frontend data fetch logic...\n');

  // Step 1: Get total count
  console.log('Step 1: Getting total count...');
  const { count: totalCount } = await supabase
    .from('sender_emails_cache')
    .select('*', { count: 'exact', head: true });

  console.log(`✅ Total accounts in database: ${totalCount}\n`);

  // Step 2: Fetch with limit (simulating frontend behavior)
  console.log('Step 2: Fetching with dynamic limit...');
  const { data: accounts, error } = await supabase
    .from('sender_emails_cache')
    .select('*')
    .order('last_synced_at', { ascending: false })
    .limit(totalCount || 10000);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`✅ Fetched ${accounts?.length || 0} accounts\n`);

  // Step 3: Transform first 3 accounts
  console.log('Step 3: Transforming accounts to frontend format...');
  const transformed = accounts?.slice(0, 3).map(row => transformToEmailAccount(row));

  console.log('\n📊 Transformed Account Sample:');
  console.log(JSON.stringify(transformed?.[0], null, 2));

  // Step 4: Check critical fields
  console.log('\n✅ Critical Fields Check:');
  const sample = transformed?.[0];
  if (sample) {
    console.log(`  - id: ${sample.id}`);
    console.log(`  - email: ${sample.email}`);
    console.log(`  - workspace_name: ${sample.workspace_name}`);
    console.log(`  - status: ${sample.status}`);
    console.log(`  - fields['Email']: ${sample.fields['Email']}`);
    console.log(`  - fields['Status']: ${sample.fields['Status']}`);
    console.log(`  - fields['Total Sent']: ${sample.fields['Total Sent']}`);
    console.log(`  - fields['Client Name (from Client)']: ${sample.fields['Client Name (from Client)']}`);
  }

  console.log('\n📈 Summary:');
  console.log(`  Database: ${totalCount} accounts`);
  console.log(`  Fetched: ${accounts?.length || 0} accounts`);
  console.log(`  Transformed: ${transformed?.length || 0} accounts`);

  if (totalCount === accounts?.length && accounts?.length === transformed?.length) {
    console.log('\n✅ SUCCESS: Data pipeline working correctly!');
  } else {
    console.log('\n❌ ISSUE: Data loss in pipeline');
  }
}

testFetch().catch(console.error);
