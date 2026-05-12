const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function check() {
  // Check most recent webhook events (last 30 min)
  console.log('=== Recent webhook_delivery_log (last 30 min) ===');
  const { data: logs } = await supabase
    .from('webhook_delivery_log')
    .select('workspace_name, event_type, created_at')
    .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  if (!logs?.length) console.log('❌ No webhook events received in last 30 min');
  else logs.forEach(l => console.log(`  [${l.created_at?.substring(0,19)}] "${l.workspace_name}" | ${l.event_type}`));

  // Check most recent lead_replies
  console.log('\n=== Most recent lead_replies (last 30 min) ===');
  const { data: replies } = await supabase
    .from('lead_replies')
    .select('workspace_name, lead_email, is_interested, sentiment, created_at')
    .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  if (!replies?.length) console.log('❌ No new lead_replies in last 30 min');
  else replies.forEach(r => console.log(`  [${r.created_at?.substring(0,19)}] "${r.workspace_name}" | ${r.lead_email} | interested=${r.is_interested} | sentiment=${r.sentiment}`));

  // Check most recent slack_notifications_sent
  console.log('\n=== Most recent slack_notifications_sent (last 30 min) ===');
  const { data: notifs } = await supabase
    .from('slack_notifications_sent')
    .select('workspace_name, notification_type, lead_email, created_at')
    .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  if (!notifs?.length) console.log('❌ No Slack notifications sent in last 30 min');
  else notifs.forEach(n => console.log(`  [${n.created_at?.substring(0,19)}] "${n.workspace_name}" | ${n.notification_type} | ${n.lead_email}`));

  // Also check last 2 hours in case timing is off
  console.log('\n=== Slack notifications last 2 hours ===');
  const { data: notifs2h } = await supabase
    .from('slack_notifications_sent')
    .select('workspace_name, notification_type, lead_email, created_at')
    .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  if (!notifs2h?.length) console.log('❌ No Slack notifications sent in last 2 hours');
  else notifs2h.forEach(n => console.log(`  [${n.created_at?.substring(0,19)}] "${n.workspace_name}" | ${n.notification_type} | ${n.lead_email}`));
}

check().catch(console.error);
