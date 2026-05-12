const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function diagnose() {
  // The key question: sends were working yesterday. Today's only success was at 15:37.
  // email_accounts_raw has 0 rows NOW. But the function succeeded many times yesterday.
  // 
  // Looking at the edge function code again:
  // - If sender_email_id is passed from frontend → skip the email_accounts_raw lookup entirely
  // - If NOT passed → query email_accounts_raw (which now has 0 rows → failure)
  //
  // So the question is: does the frontend pass sender_email_id or not?
  // Let's look at the LiveRepliesBoard and RepliesDashboard to see what they send.

  // Also: let's check if the client_registry table has sender_email_id stored
  console.log('=== client_registry - checking for sender_email fields ===');
  const { data: cr, error: crErr } = await supabase
    .from('client_registry')
    .select('*')
    .limit(2);
  
  if (crErr) console.error(crErr.message);
  else {
    console.log('client_registry columns:', Object.keys(cr[0] || {}).join(', '));
    cr.forEach(r => {
      const relevant = Object.entries(r).filter(([k,v]) => 
        k.includes('email') || k.includes('sender') || k.includes('account') || k.includes('bison')
      );
      console.log(`\n"${r.workspace_name}":`);
      relevant.forEach(([k,v]) => console.log(`  ${k}: ${v}`));
    });
  }

  // Check the reply_templates table for cc_emails or sender info
  console.log('\n=== reply_templates - columns ===');
  const { data: rt, error: rtErr } = await supabase
    .from('reply_templates')
    .select('*')
    .limit(2);
  
  if (rtErr) console.error(rtErr.message);
  else {
    console.log('reply_templates columns:', Object.keys(rt[0] || {}).join(', '));
  }
  
  // Check recent lead_replies to understand what workspace_name values look like
  console.log('\n=== lead_replies - recent rows ===');
  const { data: lr, error: lrErr } = await supabase
    .from('lead_replies')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (lrErr) console.error(lrErr.message);
  else {
    console.log('lead_replies columns:', Object.keys(lr[0] || {}).join(', '));
  }
}

diagnose().catch(console.error);
