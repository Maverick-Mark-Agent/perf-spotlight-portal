const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function diagnose() {
  // Prove the theory: 
  // The previously-deployed webhook DID save original_sender_email_id 
  // (from payload.data.sender_email.id) into lead_replies.
  // Our deployment yesterday (with .trim() fixes) OVERWROTE that version 
  // and dropped original_sender_email_id from the upsert.
  //
  // Evidence: 
  // - All pre-deployment replies: original_sender_email_id IS set
  // - All post-deployment replies: original_sender_email_id IS NULL
  //
  // When was the .trim() deployment? We deployed twice yesterday Feb 25.
  // Let's find the exact cutoff point.

  console.log('=== Finding cutoff: when did original_sender_email_id stop being set? ===\n');
  
  const { data: replies } = await supabase
    .from('lead_replies')
    .select('workspace_name, original_sender_email_id, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  
  let lastWithId = null;
  let firstWithout = null;
  
  replies.forEach(r => {
    if (r.original_sender_email_id !== null && !lastWithId) {
      lastWithId = r;
    }
    if (r.original_sender_email_id === null && !firstWithout) {
      firstWithout = r;
    }
  });

  console.log('Most recent reply WITH original_sender_email_id:');
  console.log(`  "${lastWithId?.workspace_name}" at ${lastWithId?.created_at?.substring(0,19)} | id=${lastWithId?.original_sender_email_id}`);
  
  // Find the last reply that had it
  const withIds = replies.filter(r => r.original_sender_email_id !== null);
  const withoutIds = replies.filter(r => r.original_sender_email_id === null);
  
  const lastWithIdItem = withIds[withIds.length - 1];
  console.log('\nLast 5 WITH original_sender_email_id:');
  withIds.slice(0, 5).forEach(r => console.log(`  "${r.workspace_name}" ${r.created_at?.substring(0,19)} | id=${r.original_sender_email_id}`));
  
  console.log('\nFirst 5 WITHOUT (most recent):');
  withoutIds.slice(0, 5).forEach(r => console.log(`  "${r.workspace_name}" ${r.created_at?.substring(0,19)} | id=null`));
  
  // Get the cutoff more precisely - find oldest NULL record
  const { data: oldest } = await supabase
    .from('lead_replies')
    .select('workspace_name, original_sender_email_id, created_at')
    .is('original_sender_email_id', null)
    .order('created_at', { ascending: true })
    .limit(3);
  
  console.log('\nOldest records WITH NULL (when the problem started):');
  oldest.forEach(r => console.log(`  "${r.workspace_name}" at ${r.created_at?.substring(0,19)}`));
  
  // Get newest record WITH the value
  const { data: newest } = await supabase
    .from('lead_replies')
    .select('workspace_name, original_sender_email_id, created_at')
    .not('original_sender_email_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(3);
  
  console.log('\nNewest records WITH original_sender_email_id:');
  newest.forEach(r => console.log(`  "${r.workspace_name}" at ${r.created_at?.substring(0,19)} | id=${r.original_sender_email_id}`));
}

diagnose().catch(console.error);
