const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, anonKey);

async function findAllZapmail() {
  console.log('🔍 Searching for ALL Zapmail accounts in database...\n');

  // Search by reseller field
  const { data: byReseller, error: err1 } = await supabase
    .from('sender_emails_cache')
    .select('email_address, emails_sent_count, total_replied_count, reply_rate_percentage, workspace_name')
    .eq('reseller', 'Zapmail');

  console.log(`Method 1 - By reseller field:`);
  console.log(`  Found: ${byReseller?.length || 0} accounts`);
  if (byReseller && byReseller.length > 0) {
    const withActivity = byReseller.filter(a => (a.emails_sent_count || 0) > 0);
    console.log(`  With send activity: ${withActivity.length}`);
    console.log(`  Sample accounts:`);
    byReseller.slice(0, 5).forEach(a => {
      console.log(`    - ${a.email_address}: ${a.emails_sent_count || 0} sent`);
    });
  }

  // Search by tags containing Zapmail
  const { data: byTags, error: err2 } = await supabase
    .from('sender_emails_cache')
    .select('email_address, emails_sent_count, total_replied_count, reply_rate_percentage, workspace_name, tags')
    .contains('tags', ['Zapmail']);

  console.log(`\nMethod 2 - By tags array:`);
  console.log(`  Found: ${byTags?.length || 0} accounts`);
  if (byTags && byTags.length > 0) {
    const withActivity = byTags.filter(a => (a.emails_sent_count || 0) > 0);
    console.log(`  With send activity: ${withActivity.length}`);
    console.log(`  Sample accounts:`);
    byTags.slice(0, 5).forEach(a => {
      console.log(`    - ${a.email_address}: ${a.emails_sent_count || 0} sent`);
    });
  }

  // Get total count and workspaces
  const { data: allAccounts } = await supabase
    .from('sender_emails_cache')
    .select('workspace_name, emails_sent_count')
    .gt('emails_sent_count', 0);

  const workspaces = [...new Set(allAccounts?.map(a => a.workspace_name))];
  console.log(`\n📊 Database overview:`);
  console.log(`  Total accounts with send activity: ${allAccounts?.length || 0}`);
  console.log(`  Unique workspaces: ${workspaces.length}`);
  console.log(`  Workspaces:`, workspaces.slice(0, 10));
}

findAllZapmail().catch(console.error);
