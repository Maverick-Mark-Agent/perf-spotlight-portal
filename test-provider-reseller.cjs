const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, anonKey);

async function testProviderReseller() {
  console.log('🔍 Checking provider and reseller data in sender_emails_cache...\n');

  const { data, error } = await supabase
    .from('sender_emails_cache')
    .select('email_address, email_provider, reseller')
    .limit(20);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('Sample accounts:');
  data.forEach((account, i) => {
    console.log(`${i + 1}. ${account.email_address}`);
    console.log(`   Provider: ${account.email_provider || 'NULL'}`);
    console.log(`   Reseller: ${account.reseller || 'NULL'}`);
    console.log('');
  });

  // Count how many have provider/reseller data
  const { data: allData } = await supabase
    .from('sender_emails_cache')
    .select('email_provider, reseller');

  if (allData) {
    const withProvider = allData.filter(a => a.email_provider).length;
    const withReseller = allData.filter(a => a.reseller).length;
    const total = allData.length;

    console.log(`\n📊 Statistics:`);
    console.log(`   Total accounts: ${total}`);
    console.log(`   With provider: ${withProvider} (${((withProvider/total)*100).toFixed(1)}%)`);
    console.log(`   With reseller: ${withReseller} (${((withReseller/total)*100).toFixed(1)}%)`);
  }
}

testProviderReseller();
