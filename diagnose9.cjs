const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function diagnose() {
  // Interesting: yesterday's records have created_at and updated_at just seconds apart.
  // So original_sender_email_id was set at upsert time - when the webhook fired.
  // But the current webhook code doesn't include original_sender_email_id in the upsert!
  // 
  // This means: the webhook was recently CHANGED to remove original_sender_email_id from the upsert.
  // And that change broke the send-reply flow.
  //
  // The timeline:
  // - Yesterday works: webhook stored original_sender_email_id → send-reply used it
  // - Today broken: webhook no longer stores it (due to recent code change) → 
  //   send-reply falls back to email_accounts_raw (which is empty) → FAIL
  //
  // The fix is simple: add original_sender_email_id back to the webhook upsert,
  // reading it from payload.data.sender_email.id

  // Let's verify: sender_emails_cache columns
  console.log('=== sender_emails_cache columns ===');
  const { data: cache, error } = await supabase
    .from('sender_emails_cache')
    .select('*')
    .limit(1);
  
  if (error) console.log('Error:', error.message);
  else console.log('Columns:', Object.keys(cache[0] || {}).join(', '));

  // Verify the today's failing case: what does the send-reply function receive?
  // Check if there's a frontend component passing sender_email_id
  // Let's look at how send-reply is called from the frontend
  console.log('\n=== Checking today\'s only successful send (Mark Mercer at 15:37) ===');
  const { data: success } = await supabase
    .from('sent_replies')
    .select('reply_uuid')
    .eq('workspace_name', 'Mark Mercer Agency')
    .eq('status', 'sent')
    .gte('created_at', '2026-02-25T00:00:00Z')
    .single();
  
  if (success) {
    const { data: lr } = await supabase
      .from('lead_replies')
      .select('original_sender_email_id, created_at, updated_at')
      .eq('id', success.reply_uuid)
      .single();
    console.log(`Mark Mercer success reply:`);
    console.log(`  original_sender_email_id: ${lr?.original_sender_email_id}`);
    console.log(`  created_at: ${lr?.created_at?.substring(0,19)}`);
    console.log(`  updated_at: ${lr?.updated_at?.substring(0,19)}`);
  }
  
  // Now check when the webhook function was last deployed
  // Check if there were any recent git commits to the webhook function
  console.log('\n=== Quick summary of findings ===');
  console.log('The problem:');
  console.log('1. send-reply-via-bison uses original_sender_email_id from lead_replies as sender_email_id');
  console.log('   (OR falls back to email_accounts_raw which has 0 rows)');
  console.log('2. The webhook handler (handleLeadReplied) NO LONGER saves original_sender_email_id');  
  console.log('3. Yesterday\'s records had it → sends worked');
  console.log('4. Today\'s records DON\'T have it → falls back to empty email_accounts_raw → FAIL');
  console.log('');
  console.log('The fix:');
  console.log('Add original_sender_email_id: payload.data?.sender_email?.id || null');
  console.log('to the lead_replies upsert in handleLeadReplied()');
}

diagnose().catch(console.error);
