const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function diagnose() {
  // Yesterday's sends were working. Today only 1 succeeded (Mark Mercer at 15:37).
  // The edge function uses email_accounts_raw - but that table has 0 rows.
  // So HOW were yesterday's sends working?
  // Answer: the function falls back to sender_email_id passed from the frontend.
  // Let's check what the frontend actually sends.

  // Check the lead_replies table for recent ones - do they have bison_reply_numeric_id?
  console.log('=== Recent lead_replies with send attempts ===');
  const { data: replies, error } = await supabase
    .from('lead_replies')
    .select('id, workspace_name, bison_reply_numeric_id, bison_reply_id, lead_email, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) console.error(error.message);
  else {
    replies.forEach(r => {
      console.log(`  [${r.created_at?.substring(0,16)}] "${r.workspace_name}" | numeric_id=${r.bison_reply_numeric_id} | uuid_id=${r.bison_reply_id?.substring(0,8)}`);
    });
  }

  // Check what today's failing sends look like - any new failures TODAY?
  console.log('\n=== Today\'s send attempts (Feb 25) ===');
  const { data: today, error: todayErr } = await supabase
    .from('sent_replies')
    .select('workspace_name, status, error_message, created_at')
    .gte('created_at', '2026-02-25T00:00:00Z')
    .order('created_at', { ascending: false });
  
  if (todayErr) console.error(todayErr.message);
  else {
    console.log(`${today.length} attempts today:`);
    today.forEach(s => console.log(`  [${s.created_at?.substring(0,16)}] "${s.workspace_name}" => ${s.status}: ${s.error_message?.substring(0,120) || 'ok'}`));
  }

  // The real question: how did it work before without email_accounts_raw?
  // Check the ReplyTemplatesTab or LiveRepliesBoard for sender_email_id
  console.log('\n=== Check sent_replies for sender_email_id field ===');
  const { data: sr, error: srErr } = await supabase
    .from('sent_replies')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (srErr) console.error(srErr.message);
  else {
    console.log('Most recent sent_replies columns:', Object.keys(sr[0] || {}).join(', '));
    console.log('Most recent record:', JSON.stringify(sr[0], null, 2));
  }
}

diagnose().catch(console.error);
