const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, anonKey);

async function testAPI() {
  console.log('🔍 Testing what the API returns...\n');

  // Get a small sample
  const { data, error } = await supabase
    .from('sender_emails_cache')
    .select('email_address, workspace_name, last_synced_at, emails_sent_count, reply_rate_percentage')
    .limit(5);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ API Response (sample):');
  data.forEach(account => {
    const age = (Date.now() - new Date(account.last_synced_at)) / 1000 / 60 / 60;
    console.log(`  ${account.email_address}`);
    console.log(`    Last synced: ${account.last_synced_at}`);
    console.log(`    Age: ${age.toFixed(1)} hours`);
    console.log(`    Sent: ${account.emails_sent_count}, Reply rate: ${account.reply_rate_percentage}%`);
    console.log('');
  });

  // Check burnt mailboxes
  const { data: burntData, error: burntError } = await supabase
    .from('sender_emails_cache')
    .select('email_address')
    .gte('emails_sent_count', 200)
    .lt('reply_rate_percentage', 0.4);

  if (!burntError) {
    console.log(`\n🔥 Burnt mailboxes count: ${burntData.length}`);
  }
}

testAPI();
