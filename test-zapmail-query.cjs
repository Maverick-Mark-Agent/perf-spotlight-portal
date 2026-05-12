const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, anonKey);

async function testQuery() {
  // Test 1: Check if we have any Zapmail reseller accounts
  const { data: zapmailAccounts, error: error1 } = await supabase
    .from('sender_emails_cache')
    .select('email_address, reseller, emails_sent_count, total_replied_count, reply_rate_percentage')
    .eq('reseller', 'Zapmail')
    .limit(10);

  console.log('\n📊 Test 1: Zapmail reseller accounts:');
  if (error1) {
    console.error('Error:', error1.message);
  } else {
    console.log(`Found ${zapmailAccounts?.length || 0} accounts with reseller='Zapmail'`);
    zapmailAccounts?.forEach(a => {
      console.log(`  - ${a.email_address}: ${a.emails_sent_count} sent, ${a.total_replied_count} replied, ${a.reply_rate_percentage}% rate`);
    });
  }

  // Test 2: Check for a specific domain
  const { data: domainAccounts, error: error2 } = await supabase
    .from('sender_emails_cache')
    .select('email_address, reseller, emails_sent_count, total_replied_count, reply_rate_percentage')
    .ilike('email_address', '%@rossmanmediaplan.com');

  console.log('\n📊 Test 2: rossmanmediaplan.com domain accounts:');
  if (error2) {
    console.error('Error:', error2.message);
  } else {
    console.log(`Found ${domainAccounts?.length || 0} accounts for rossmanmediaplan.com`);
    domainAccounts?.forEach(a => {
      console.log(`  - ${a.email_address}: reseller=${a.reseller}, ${a.emails_sent_count} sent, ${a.total_replied_count} replied, ${a.reply_rate_percentage}% rate`);
    });
  }

  // Test 3: Check what reseller values exist
  const { data: resellers, error: error3 } = await supabase
    .from('sender_emails_cache')
    .select('reseller')
    .not('reseller', 'is', null)
    .limit(1000);

  console.log('\n📊 Test 3: Unique reseller values:');
  if (error3) {
    console.error('Error:', error3.message);
  } else {
    const uniqueResellers = [...new Set(resellers?.map(r => r.reseller))];
    console.log('Resellers found:', uniqueResellers);
  }
}

testQuery().catch(console.error);
