const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function diagnose() {
  // The working sends yesterday DID succeed - let's find out what sender_email_id was used
  // Check sent_replies with bison_reply_id to see if there's a pattern for working ones

  // Find workspaces that HAVE worked recently - get their reply UUIDs and cross ref
  console.log('=== Checking yesterday\'s successful sends for sender info ===');
  const { data: successes, error } = await supabase
    .from('sent_replies')
    .select('reply_uuid, workspace_name, bison_reply_id, status')
    .eq('status', 'sent')
    .gte('created_at', '2026-02-24T00:00:00Z')
    .lte('created_at', '2026-02-25T00:00:00Z')
    .limit(5);
  
  if (error) console.error(error.message);
  else {
    console.log(`${successes.length} successful sends yesterday`);
    // Cross-reference with lead_replies to find original_sender_email_id
    for (const s of successes) {
      const { data: lr } = await supabase
        .from('lead_replies')
        .select('original_sender_email_id, bison_reply_numeric_id, workspace_name')
        .eq('id', s.reply_uuid)
        .single();
      console.log(`  "${s.workspace_name}": bison_reply_id=${s.bison_reply_id}, original_sender_id=${lr?.original_sender_email_id}, numeric_id=${lr?.bison_reply_numeric_id}`);
    }
  }

  // Check the webhook code - does it store original_sender_email_id?
  // Check what the webhook stores when a lead_replied event comes in
  // Look at the webhook_delivery_log to understand what data comes in
  console.log('\n=== webhook_delivery_log - recent events with sender_email ===');
  const { data: logs, error: logErr } = await supabase
    .from('webhook_delivery_log')
    .select('event_type, workspace_name, payload, created_at')
    .eq('event_type', 'lead_replied')
    .order('created_at', { ascending: false })
    .limit(3);
  
  if (logErr) console.error(logErr.message);
  else {
    logs.forEach(l => {
      const payload = l.payload;
      const sender = payload?.data?.sender_email_id || payload?.event?.sender_email_id || 
                     payload?.sender_email_id || 'NOT FOUND';
      const senderEmail = payload?.data?.sender_email || payload?.event?.sender_email || 'NOT FOUND';
      console.log(`  [${l.created_at?.substring(0,16)}] "${l.workspace_name}":`);
      console.log(`    sender_email_id: ${sender}`);
      console.log(`    sender_email: ${senderEmail}`);
      // Log all top-level keys 
      console.log(`    payload keys: ${Object.keys(payload || {}).join(', ')}`);
      if (payload?.event) console.log(`    event keys: ${Object.keys(payload.event).join(', ')}`);
      if (payload?.data) console.log(`    data keys: ${Object.keys(payload.data).join(', ')}`);
    });
  }
}

diagnose().catch(console.error);
