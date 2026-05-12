const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function diagnose() {
  // Found it! The payload has data.sender_email as an OBJECT, not a simple ID
  // And yesterday's successes ALL had original_sender_email_id set (27318, 27859, etc)
  // But today's lead_replies have original_sender_email_id = null
  // 
  // This means: the webhook used to store original_sender_email_id, but now it's not.
  // The edge function reads it from the webhook payload and saves it.
  // Let's look at exactly what data.sender_email contains in the webhook payload.

  console.log('=== webhook payload - sender_email object details ===');
  const { data: logs, error } = await supabase
    .from('webhook_delivery_log')
    .select('workspace_name, payload, created_at')
    .eq('event_type', 'lead_replied')
    .order('created_at', { ascending: false })
    .limit(2);
  
  if (error) console.error(error.message);
  else {
    logs.forEach(l => {
      const senderEmail = l.payload?.data?.sender_email;
      console.log(`\n"${l.workspace_name}" [${l.created_at?.substring(0,16)}]:`);
      console.log('  data.sender_email:', JSON.stringify(senderEmail, null, 2));
      const reply = l.payload?.data?.reply;
      console.log('  data.reply (top keys):', Object.keys(reply || {}).join(', '));
      if (reply) {
        console.log('  data.reply.sender_email_id:', reply.sender_email_id);
        console.log('  data.reply.email_account_id:', reply.email_account_id);
      }
    });
  }

  // Also check yesterday's webhook logs to compare
  console.log('\n=== YESTERDAY\'s webhook payload - sender_email object ===');
  const { data: oldLogs, error: oldErr } = await supabase
    .from('webhook_delivery_log')
    .select('workspace_name, payload, created_at')
    .eq('event_type', 'lead_replied')
    .gte('created_at', '2026-02-24T00:00:00Z')
    .lte('created_at', '2026-02-25T00:00:00Z')
    .order('created_at', { ascending: false })
    .limit(2);
  
  if (oldErr) console.error(oldErr.message);
  else {
    oldLogs.forEach(l => {
      const senderEmail = l.payload?.data?.sender_email;
      const reply = l.payload?.data?.reply;
      console.log(`\n"${l.workspace_name}" [${l.created_at?.substring(0,16)}]:`);
      console.log('  data.sender_email:', JSON.stringify(senderEmail, null, 2));
      if (reply) {
        console.log('  data.reply.sender_email_id:', reply.sender_email_id);
        console.log('  data.reply.email_account_id:', reply.email_account_id);
      }
    });
  }
}

diagnose().catch(console.error);
