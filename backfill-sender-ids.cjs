const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function backfill() {
  // Get all lead_replies in the gap period that have null original_sender_email_id
  // Gap: 2026-02-25T16:24:38 onwards
  console.log('Fetching gap-period lead_replies with null original_sender_email_id...');
  const { data: gapReplies, error: gapErr } = await supabase
    .from('lead_replies')
    .select('id, bison_reply_id, bison_reply_numeric_id, workspace_name, lead_email')
    .is('original_sender_email_id', null)
    .gte('created_at', '2026-02-25T16:24:00Z')
    .order('created_at', { ascending: true });

  if (gapErr) { console.error('Error:', gapErr.message); return; }
  console.log(`Found ${gapReplies.length} gap-period replies to backfill\n`);

  let fixed = 0, notFound = 0;

  for (const reply of gapReplies) {
    // Find the matching webhook log entry by bison_reply_numeric_id or bison_reply_id
    const { data: logs } = await supabase
      .from('webhook_delivery_log')
      .select('payload')
      .eq('event_type', 'lead_replied')
      .eq('workspace_name', reply.workspace_name)
      .gte('created_at', '2026-02-25T16:24:00Z')
      .order('created_at', { ascending: true });

    // Match the specific reply by its numeric ID in the payload
    let senderEmailId = null;
    for (const log of (logs || [])) {
      const replyId = log.payload?.data?.reply?.id;
      if (replyId && replyId === reply.bison_reply_numeric_id) {
        senderEmailId = log.payload?.data?.sender_email?.id;
        break;
      }
    }

    if (senderEmailId) {
      const { error: updateErr } = await supabase
        .from('lead_replies')
        .update({ original_sender_email_id: senderEmailId })
        .eq('id', reply.id);

      if (updateErr) {
        console.error(`  ❌ Failed to update "${reply.workspace_name}" (${reply.lead_email}): ${updateErr.message}`);
      } else {
        console.log(`  ✅ Fixed "${reply.workspace_name}" (${reply.lead_email}) → sender_id=${senderEmailId}`);
        fixed++;
      }
    } else {
      console.log(`  ⚠️  No webhook log match for "${reply.workspace_name}" (${reply.lead_email}) numeric_id=${reply.bison_reply_numeric_id}`);
      notFound++;
    }
  }

  console.log(`\nDone: ${fixed} fixed, ${notFound} not found in webhook logs`);
}

backfill().catch(console.error);
