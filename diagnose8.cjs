const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function diagnose() {
  // Yesterday's lead_replies HAD original_sender_email_id set.
  // But today's DON'T.
  // The webhook code does NOT save it. So something ELSE was setting it.
  //
  // Could it be the frontend? Let's look at a yesterday's working reply
  // to understand the reply UUID, and find when original_sender_email_id was set.

  // Find yesterday's sent_replies and get their lead_replies record
  const { data: success } = await supabase
    .from('sent_replies')
    .select('reply_uuid, workspace_name, created_at')
    .eq('status', 'sent')
    .gte('created_at', '2026-02-24T00:00:00Z')
    .lte('created_at', '2026-02-25T00:00:00Z')
    .limit(3);
  
  console.log('=== Yesterday\'s working send - lead_replies record ===');
  for (const s of (success || [])) {
    const { data: lr } = await supabase
      .from('lead_replies')
      .select('original_sender_email_id, updated_at, created_at, bison_reply_numeric_id')
      .eq('id', s.reply_uuid)
      .single();
    console.log(`"${s.workspace_name}":`);
    console.log(`  original_sender_email_id: ${lr?.original_sender_email_id}`);
    console.log(`  created_at: ${lr?.created_at?.substring(0,19)}`);
    console.log(`  updated_at: ${lr?.updated_at?.substring(0,19)}`);
    console.log(`  reply sent_at: ${s.created_at?.substring(0,19)}`);
  }

  // Check if the Email Accounts page or some sync job populates email_accounts_raw
  // Let's look at sender_emails_cache
  console.log('\n=== sender_emails_cache table ===');
  const { data: cache, error: cacheErr } = await supabase
    .from('sender_emails_cache')
    .select('workspace_name, email_address, bison_account_id, status, updated_at')
    .order('updated_at', { ascending: false })
    .limit(10);
  
  if (cacheErr) console.log('sender_emails_cache error:', cacheErr.message);
  else {
    console.log(`${cache.length} rows in sender_emails_cache:`);
    cache.forEach(c => console.log(`  "${c.workspace_name}": ${c.email_address} | status=${c.status} | id=${c.bison_account_id} | updated=${c.updated_at?.substring(0,16)}`));
  }
}

diagnose().catch(console.error);
