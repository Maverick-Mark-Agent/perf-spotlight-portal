const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function check() {
  // Key finding: lead_replies HAS 19 interested leads but webhook_delivery_log has ZERO events.
  // This means the leads got into lead_replies via lead_REPLIED webhook (not lead_interested).
  // The AI marked them as interested, but the handleLeadInterested handler never ran.
  // So Slack only fires from handleLeadInterested, not handleLeadReplied.
  //
  // Let's confirm: check what events are in webhook_delivery_log for workspace_id 22

  console.log('=== All recent webhook_delivery_log events (last 100) ===');
  const { data: allLogs } = await supabase
    .from('webhook_delivery_log')
    .select('workspace_name, event_type, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  // Group by workspace
  const byWs = {};
  allLogs?.forEach(l => {
    if (!byWs[l.workspace_name]) byWs[l.workspace_name] = {};
    byWs[l.workspace_name][l.event_type] = (byWs[l.workspace_name][l.event_type] || 0) + 1;
  });

  console.log('Recent webhook events by workspace:');
  Object.entries(byWs).forEach(([ws, events]) => {
    console.log(`  "${ws}": ${Object.entries(events).map(([k,v]) => `${k}(${v})`).join(', ')}`);
  });

  // Now check: does handleLeadReplied send Slack for interested leads?
  // Read the webhook function to see if it calls sendSlackNotification
  console.log('\n=== Checking the webhook code flow ===');
  console.log('The handleLeadReplied function runs AI sentiment analysis.');
  console.log('If AI marks as interested → does it send Slack? Let\'s check...');

  // Check if there are ANY slack notifications at all recently
  console.log('\n=== All recent Slack notifications (last 20) ===');
  const { data: notifs } = await supabase
    .from('slack_notifications_sent')
    .select('workspace_name, notification_type, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  
  console.log(`Total recent Slack notifs: ${notifs?.length}`);
  notifs?.forEach(n => console.log(`  [${n.created_at?.substring(0,16)}] "${n.workspace_name}" | ${n.notification_type}`));
}

check().catch(console.error);
