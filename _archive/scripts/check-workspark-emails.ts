import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWorksparkEmails() {
  console.log('🔍 Checking Workspark email addresses...\n');

  const { data: accounts, error } = await supabase
    .from('sender_emails_cache')
    .select('id, email_address, account_name, status, emails_sent_count')
    .ilike('workspace_name', '%workspark%')
    .order('email_address');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 Total rows: ${accounts?.length || 0}`);

  const uniqueEmails = new Set(accounts?.map(a => a.email_address));
  console.log(`📧 Unique email addresses: ${uniqueEmails.size}\n`);

  if (accounts && accounts.length > 0) {
    console.log('First 10 accounts:');
    accounts.slice(0, 10).forEach((acc, idx) => {
      console.log(`${idx + 1}. ${acc.email_address} - "${acc.account_name}" - ${acc.status} - ${acc.emails_sent_count} sent`);
    });

    console.log('\nLast 10 accounts:');
    accounts.slice(-10).forEach((acc, idx) => {
      console.log(`${accounts.length - 9 + idx}. ${acc.email_address} - "${acc.account_name}" - ${acc.status} - ${acc.emails_sent_count} sent`);
    });
  }

  // Check for duplicate email addresses (shouldn't exist due to unique constraint)
  const emailCounts = new Map<string, number>();
  accounts?.forEach(acc => {
    const email = acc.email_address;
    emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
  });

  const duplicates = Array.from(emailCounts.entries()).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log(`\n⚠️  Found ${duplicates.length} duplicate email addresses (SHOULDN'T HAPPEN!):`);
    duplicates.forEach(([email, count]) => {
      console.log(`  ${email}: appears ${count} times`);
    });
  } else {
    console.log(`\n✅ No duplicate email addresses found (unique constraint working!)`);
  }

  // Check account name distribution
  const nameCounts = new Map<string, number>();
  accounts?.forEach(acc => {
    const name = acc.account_name || 'Unknown';
    nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
  });

  console.log(`\n📝 Account name distribution:`);
  Array.from(nameCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([name, count]) => {
      console.log(`  "${name}": ${count} accounts`);
    });
}

checkWorksparkEmails().catch(console.error);
