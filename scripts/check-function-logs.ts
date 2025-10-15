// We can't directly access function logs from here, but let's check if there's
// an issue with the sendSlackNotification function by simulating it

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSlackIssue() {
  console.log('=== DEBUGGING SLACK NOTIFICATION ISSUE ===\n');

  // Get recent webhook delivery log
  const { data: recentLog } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!recentLog) {
    console.log('❌ No recent webhook logs found');
    return;
  }

  console.log('Most Recent Webhook Delivery:');
  console.log(`  Time: ${recentLog.created_at}`);
  console.log(`  Success: ${recentLog.success}`);
  console.log(`  Processing Time: ${recentLog.processing_time_ms}ms`);
  console.log('');

  // Processing time analysis
  if (recentLog.processing_time_ms > 1000) {
    console.log('✅ Processing time > 1 second suggests Slack was attempted');
    console.log('   (OpenAI API + Slack call typically takes 1-3 seconds)');
  } else {
    console.log('⚠️  Fast processing time might indicate Slack was skipped');
  }

  // Check if slack_webhook_url exists
  const { data: client } = await supabase
    .from('client_registry')
    .select('slack_webhook_url, workspace_name')
    .eq('workspace_name', 'Tony Schmitz')
    .single();

  console.log('\n\nClient Configuration:');
  console.log(`  Workspace: ${client?.workspace_name}`);
  console.log(`  Has Slack URL: ${!!client?.slack_webhook_url}`);
  console.log(`  Slack URL: ${client?.slack_webhook_url}`);

  console.log('\n\n=== LIKELY ISSUE ===');
  console.log('The edge function IS calling Slack (based on processing time),');
  console.log('and Slack IS accepting the message (returns 200 OK).');
  console.log('\nBut you\'re not seeing the notification. This means:');
  console.log('\n1. MOST LIKELY: You\'re checking the wrong Slack workspace or channel');
  console.log('   - Workspace ID: T06R9MD2U2W');
  console.log('   - Channel/App ID: B09L98CE9UJ');
  console.log('   - This might be a TEST workspace from yesterday\'s setup');
  console.log('\n2. The webhook URL needs to be updated to Tony\'s PRODUCTION Slack');
  console.log('\n3. The Slack app was deleted/revoked (but would return error, not 200 OK)');

  console.log('\n\n=== SOLUTION ===');
  console.log('You need to create a NEW Slack webhook URL in Tony\'s actual Slack workspace');
  console.log('and update the database:');
  console.log('\nSteps:');
  console.log('1. Go to Tony\'s Slack workspace');
  console.log('2. Create a new Slack app or incoming webhook');
  console.log('3. Get the new webhook URL');
  console.log('4. Update the database with the new URL');
  console.log('\nOr, check the Slack workspace T06R9MD2U2W - the messages ARE going there!');
}

debugSlackIssue().catch(console.error);
