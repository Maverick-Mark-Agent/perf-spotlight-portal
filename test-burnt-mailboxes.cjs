const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, anonKey);

async function testBurntMailboxes() {
  console.log('🔥 Fetching BURNT MAILBOX accounts specifically...\n');

  const { data, error } = await supabase
    .from('email_accounts_view')
    .select('email_address, email_provider, reseller, emails_sent_count, total_replied_count, workspace_name');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  // Filter for burnt mailboxes: <0.4% reply rate, 200+ sent
  const burntMailboxes = data.filter(account => {
    const replyRate = account.emails_sent_count > 0
      ? (account.total_replied_count / account.emails_sent_count) * 100
      : 0;
    return replyRate < 0.4 && account.emails_sent_count >= 200;
  });

  console.log(`✅ Found ${burntMailboxes.length} burnt mailboxes\n`);
  console.log('First 10 burnt mailboxes:\n');

  burntMailboxes.slice(0, 10).forEach((account, i) => {
    const replyRate = account.emails_sent_count > 0
      ? (account.total_replied_count / account.emails_sent_count) * 100
      : 0;

    console.log(`${i + 1}. ${account.email_address}`);
    console.log(`   Workspace: ${account.workspace_name}`);
    console.log(`   Provider: ${account.email_provider || 'NULL'}`);
    console.log(`   Reseller: ${account.reseller || 'NULL'}`);
    console.log(`   Sent: ${account.emails_sent_count}, Replies: ${account.total_replied_count}, Rate: ${replyRate.toFixed(2)}%\n`);
  });

  // Count how many have provider/reseller
  const withProvider = burntMailboxes.filter(a => a.email_provider).length;
  const withReseller = burntMailboxes.filter(a => a.reseller).length;

  console.log(`📊 Burnt mailbox coverage:`);
  console.log(`   With provider: ${withProvider}/${burntMailboxes.length} (${((withProvider/burntMailboxes.length)*100).toFixed(1)}%)`);
  console.log(`   With reseller: ${withReseller}/${burntMailboxes.length} (${((withReseller/burntMailboxes.length)*100).toFixed(1)}%)`);
}

testBurntMailboxes();
