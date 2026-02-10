const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function triggerCacheSync() {
  console.log('🔄 Triggering sync-email-accounts-cache function...\n');
  console.log('This will:');
  console.log('  1. Fetch all email accounts from Email Bison API');
  console.log('  2. Update sender_emails_cache table');
  console.log('  3. Refresh materialized view');
  console.log('  4. This may take 2-5 minutes for 4000+ accounts\n');

  try {
    const { data, error } = await supabase.functions.invoke('sync-email-accounts-cache', {
      body: { manual: true }
    });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('\n✅ Sync completed successfully!');
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('\nYou can now refresh your dashboard to see fresh data!');

  } catch (err) {
    console.error('❌ Exception:', err.message);
  }
}

triggerCacheSync();
