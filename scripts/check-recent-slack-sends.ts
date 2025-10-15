import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentSlackSends() {
  console.log('=== CHECKING FOR SLACK NOTIFICATION INDICATORS ===\n');

  // 1. Check the most recent webhook deliveries
  const { data: logs } = await supabase
    .from('webhook_delivery_log')
    .select('id, created_at, event_type, workspace_name, success, processing_time_ms, payload')
    .eq('workspace_name', 'Tony Schmitz')
    .eq('event_type', 'lead_interested')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!logs || logs.length === 0) {
    console.log('No recent webhook logs found');
    return;
  }

  const mostRecent = logs[0];
  console.log('Most Recent Webhook Delivery:');
  console.log(`  Time: ${mostRecent.created_at}`);
  console.log(`  Success: ${mostRecent.success}`);
  console.log(`  Processing Time: ${mostRecent.processing_time_ms}ms`);

  // If processing time is over 1000ms, the Slack call might be happening
  // (OpenAI API call takes time)
  if (mostRecent.processing_time_ms && mostRecent.processing_time_ms > 1000) {
    console.log('\n  ✅ Processing time suggests Slack notification was attempted');
    console.log('     (OpenAI API + Slack webhook call takes ~1-3 seconds)');
  } else {
    console.log('\n  ⚠️  Fast processing time might mean Slack wasn\'t called');
  }

  // 2. Check if we can detect any patterns
  const { data: allLogs } = await supabase
    .from('webhook_delivery_log')
    .select('processing_time_ms')
    .eq('workspace_name', 'Tony Schmitz')
    .eq('event_type', 'lead_interested')
    .order('created_at', { ascending: false })
    .limit(10);

  if (allLogs) {
    console.log('\n\nLast 10 Processing Times:');
    allLogs.forEach((log, i) => {
      console.log(`  ${i + 1}. ${log.processing_time_ms}ms`);
    });

    const avgTime = allLogs.reduce((sum, log) => sum + (log.processing_time_ms || 0), 0) / allLogs.length;
    console.log(`\n  Average: ${avgTime.toFixed(0)}ms`);

    if (avgTime > 1000) {
      console.log('  ✅ Average time suggests Slack notifications are being sent');
    } else {
      console.log('  ⚠️  Fast average time - Slack might not be sending');
    }
  }

  // 3. Check the test lead we just created
  console.log('\n\n=== CHECKING FOR TEST LEAD ===');
  const { data: testLead } = await supabase
    .from('client_leads')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .ilike('lead_email', '%test-lead%')
    .order('created_at', { ascending: false })
    .limit(1);

  if (testLead && testLead.length > 0) {
    console.log('✅ Test lead was created in database:');
    console.log(`   Email: ${testLead[0].lead_email}`);
    console.log(`   Created: ${testLead[0].created_at}`);
    console.log('\nThis confirms the webhook function ran and created the lead.');
    console.log('But we need to check if Slack notification was also sent.');
  }
}

checkRecentSlackSends().catch(console.error);
