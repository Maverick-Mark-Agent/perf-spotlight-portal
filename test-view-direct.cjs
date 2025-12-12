const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, anonKey);

async function testViewDirectly() {
  console.log('🔍 Testing email_accounts_view directly...\n');

  // First, check if view exists
  const { data: viewData, error: viewError } = await supabase
    .from('email_accounts_view')
    .select('email_address, email_provider, reseller')
    .limit(5);

  if (viewError) {
    console.error('❌ Error querying email_accounts_view:', viewError.message);
    console.log('\n⚠️  The view might not exist. Trying sender_emails_cache instead...\n');

    const { data: cacheData, error: cacheError } = await supabase
      .from('sender_emails_cache')
      .select('email_address, email_provider, reseller')
      .limit(5);

    if (cacheError) {
      console.error('❌ Error querying sender_emails_cache:', cacheError.message);
      return;
    }

    console.log('✅ sender_emails_cache data:');
    cacheData.forEach((row, i) => {
      console.log(`${i + 1}. ${row.email_address}`);
      console.log(`   provider: ${row.email_provider || 'NULL'}`);
      console.log(`   reseller: ${row.reseller || 'NULL'}\n`);
    });

    return;
  }

  console.log('✅ email_accounts_view data:');
  viewData.forEach((row, i) => {
    console.log(`${i + 1}. ${row.email_address}`);
    console.log(`   provider: ${row.email_provider || 'NULL'}`);
    console.log(`   reseller: ${row.reseller || 'NULL'}\n`);
  });
}

testViewDirectly();
