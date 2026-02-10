import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateWorkspark() {
  console.log('🔍 Investigating Workspark account count discrepancy...\n');

  // Get all Workspark accounts from cache
  const { data: accounts, error } = await supabase
    .from('sender_emails_cache')
    .select('*')
    .ilike('workspace_name', '%workspark%');

  if (error) {
    console.error('❌ Error fetching accounts:', error);
    return;
  }

  console.log(`📊 Total rows in cache for Workspark: ${accounts?.length || 0}`);

  if (!accounts || accounts.length === 0) {
    console.log('No Workspark accounts found');
    return;
  }

  // Check for duplicates by sender_email_id
  const senderIdCount = new Map<string, number>();
  accounts.forEach(acc => {
    const id = acc.sender_email_id;
    senderIdCount.set(id, (senderIdCount.get(id) || 0) + 1);
  });

  const duplicateIds = Array.from(senderIdCount.entries()).filter(([_, count]) => count > 1);
  console.log(`\n🔍 Unique sender_email_ids: ${senderIdCount.size}`);
  console.log(`⚠️  Duplicate sender_email_ids: ${duplicateIds.length}`);

  if (duplicateIds.length > 0) {
    console.log('\n📝 Duplicate accounts:');
    duplicateIds.slice(0, 10).forEach(([id, count]) => {
      const dupes = accounts.filter(acc => acc.sender_email_id === id);
      console.log(`\nID: ${id} (appears ${count} times)`);
      dupes.forEach((acc, idx) => {
        console.log(`  ${idx + 1}. Account: ${acc.account_name}, Email: ${acc.email}, Last synced: ${acc.last_synced_at}`);
      });
    });
  }

  // Check for duplicates by account_name
  const accountNameCount = new Map<string, number>();
  accounts.forEach(acc => {
    const name = acc.account_name;
    accountNameCount.set(name, (accountNameCount.get(name) || 0) + 1);
  });

  const duplicateNames = Array.from(accountNameCount.entries()).filter(([_, count]) => count > 1);
  console.log(`\n🔍 Unique account_names: ${accountNameCount.size}`);
  console.log(`⚠️  Duplicate account_names: ${duplicateNames.length}`);

  if (duplicateNames.length > 0) {
    console.log('\n📝 Accounts with duplicate names:');
    duplicateNames.slice(0, 5).forEach(([name, count]) => {
      console.log(`  "${name}" appears ${count} times`);
    });
  }

  // Check last_synced_at times
  const syncTimes = accounts.map(acc => new Date(acc.last_synced_at).getTime());
  const uniqueSyncTimes = new Set(syncTimes);
  console.log(`\n🕐 Unique sync timestamps: ${uniqueSyncTimes.size}`);

  if (uniqueSyncTimes.size > 1) {
    console.log('⚠️  Multiple sync times detected - data may be from different polling runs');
    const sortedTimes = Array.from(uniqueSyncTimes).sort((a, b) => b - a);
    sortedTimes.slice(0, 3).forEach(time => {
      const date = new Date(time);
      const accountsAtTime = accounts.filter(acc => new Date(acc.last_synced_at).getTime() === time);
      console.log(`  ${date.toISOString()}: ${accountsAtTime.length} accounts`);
    });
  }
}

investigateWorkspark().catch(console.error);
