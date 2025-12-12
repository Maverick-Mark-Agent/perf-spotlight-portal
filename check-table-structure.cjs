const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, anonKey);

async function checkTables() {
  console.log('🔍 Checking table structures...\n');

  // Check sender_emails_cache
  console.log('1. sender_emails_cache table:');
  const { data: cacheData, error: cacheError } = await supabase
    .from('sender_emails_cache')
    .select('*')
    .limit(1);

  if (cacheError) {
    console.error('   Error:', cacheError.message);
  } else if (cacheData && cacheData.length > 0) {
    console.log('   Columns:', Object.keys(cacheData[0]).join(', '));
  }

  console.log('\n2. email_accounts_raw table:');
  const { data: rawData, error: rawError } = await supabase
    .from('email_accounts_raw')
    .select('*')
    .limit(1);

  if (rawError) {
    console.error('   Error:', rawError.message);
  } else if (rawData && rawData.length > 0) {
    console.log('   Columns:', Object.keys(rawData[0]).join(', '));
    console.log('   Row count check...');
    const { count } = await supabase
      .from('email_accounts_raw')
      .select('*', { count: 'exact', head: true });
    console.log('   Total rows:', count);
  } else {
    console.log('   Table is empty or doesn\'t exist');
  }
}

checkTables();
