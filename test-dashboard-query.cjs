const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, anonKey);

async function testDashboardQuery() {
  console.log('🔍 Testing what the dashboard sees...\n');

  // Query exactly like the dashboard does
  const { data, error } = await supabase
    .from('sender_emails_cache')
    .select('*');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`✅ Total accounts: ${data.length}`);

  if (data.length > 0) {
    const mostRecent = data.reduce((latest, account) => {
      const accountTime = new Date(account.last_synced_at);
      const latestTime = new Date(latest.last_synced_at);
      return accountTime > latestTime ? account : latest;
    });

    console.log(`\n📅 Most recent sync:`);
    console.log(`   Email: ${mostRecent.email_address}`);
    console.log(`   Time: ${mostRecent.last_synced_at}`);
    console.log(`   Age: ${((Date.now() - new Date(mostRecent.last_synced_at)) / 1000 / 60).toFixed(1)} minutes`);

    // Check burnt mailboxes
    const burntMailboxes = data.filter(account => {
      const replyRate = account.reply_rate_percentage || 0;
      const emailsSent = account.emails_sent_count || 0;
      return emailsSent >= 200 && replyRate < 0.4;
    });

    console.log(`\n🔥 Burnt mailboxes (< 0.4% reply rate, 200+ sent):`);
    console.log(`   Total: ${burntMailboxes.length}`);

    if (burntMailboxes.length > 0) {
      console.log(`\n   Sample (top 5):`);
      burntMailboxes
        .sort((a, b) => b.emails_sent_count - a.emails_sent_count)
        .slice(0, 5)
        .forEach((account, i) => {
          console.log(`   ${i + 1}. ${account.email_address}`);
          console.log(`      Sent: ${account.emails_sent_count}, Replies: ${account.total_replied_count}, Rate: ${account.reply_rate_percentage}%`);
        });
    }
  }
}

testDashboardQuery();
