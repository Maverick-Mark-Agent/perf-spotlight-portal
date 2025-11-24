/**
 * Add AgencyZoom webhook URL for Jason Binyon
 *
 * This script updates the client_registry to configure the external API
 * for routing interested leads to AgencyZoom CRM.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const WORKSPACE_NAME = 'Jason Binyon';
const AGENCYZOOM_WEBHOOK_URL = 'https://app.agencyzoom.com/v1/api/lead/webhook/67c22351dae41f31245b890e081c083aaf0d9d9a7759f';

async function main() {
  console.log(`\n=== Adding AgencyZoom Webhook for ${WORKSPACE_NAME} ===\n`);

  // 1. Check current configuration
  console.log('1. Checking current configuration...');
  const { data: current, error: fetchError } = await supabase
    .from('client_registry')
    .select('workspace_name, external_api_url, external_api_token, slack_webhook_url, api_health_status, api_last_successful_call_at')
    .eq('workspace_name', WORKSPACE_NAME)
    .single();

  if (fetchError) {
    console.error('Error fetching current config:', fetchError);
    process.exit(1);
  }

  console.log('\nCurrent configuration:');
  console.log(`  Workspace: ${current.workspace_name}`);
  console.log(`  External API URL: ${current.external_api_url || '(NOT CONFIGURED)'}`);
  console.log(`  External API Token: ${current.external_api_token ? '(set)' : '(not set)'}`);
  console.log(`  Slack Webhook: ${current.slack_webhook_url ? '(configured)' : '(not set)'}`);
  console.log(`  API Health: ${current.api_health_status || 'unknown'}`);
  console.log(`  Last Successful Call: ${current.api_last_successful_call_at || 'never'}`);

  // 2. Update with new AgencyZoom URL
  console.log('\n2. Updating with AgencyZoom webhook URL...');
  console.log(`   New URL: ${AGENCYZOOM_WEBHOOK_URL}`);

  const { error: updateError } = await supabase
    .from('client_registry')
    .update({
      external_api_url: AGENCYZOOM_WEBHOOK_URL,
      api_health_status: 'pending',
      api_notes: `AgencyZoom webhook configured on ${new Date().toISOString()}`
    })
    .eq('workspace_name', WORKSPACE_NAME);

  if (updateError) {
    console.error('Error updating config:', updateError);
    process.exit(1);
  }

  console.log('   ✅ Updated successfully!');

  // 3. Verify the update
  console.log('\n3. Verifying update...');
  const { data: updated } = await supabase
    .from('client_registry')
    .select('workspace_name, external_api_url, api_health_status, api_notes')
    .eq('workspace_name', WORKSPACE_NAME)
    .single();

  console.log('\nUpdated configuration:');
  console.log(`  Workspace: ${updated?.workspace_name}`);
  console.log(`  External API URL: ${updated?.external_api_url}`);
  console.log(`  API Health: ${updated?.api_health_status}`);
  console.log(`  API Notes: ${updated?.api_notes}`);

  // 4. Check recent leads that might need to be resent
  console.log('\n4. Checking recent interested leads that may need manual resend...');
  const { data: recentLeads, error: leadsError } = await supabase
    .from('client_leads')
    .select('lead_email, first_name, last_name, date_received, external_api_sent_at')
    .eq('workspace_name', WORKSPACE_NAME)
    .eq('interested', true)
    .is('external_api_sent_at', null)
    .order('date_received', { ascending: false })
    .limit(10);

  if (leadsError) {
    console.error('Error fetching recent leads:', leadsError);
  } else if (recentLeads && recentLeads.length > 0) {
    console.log(`\n   Found ${recentLeads.length} interested leads NOT sent to external API:`);
    recentLeads.forEach((lead, i) => {
      console.log(`   ${i + 1}. ${lead.lead_email} (${lead.first_name} ${lead.last_name}) - ${lead.date_received}`);
    });
    console.log('\n   These leads need to be manually sent to AgencyZoom or will be sent on next interested event.');
  } else {
    console.log('   No unsent interested leads found.');
  }

  console.log('\n=== Configuration Complete ===\n');
  console.log('Next steps:');
  console.log('1. The next interested lead for Jason Binyon will automatically be sent to AgencyZoom');
  console.log('2. If there are past leads that need resending, run a manual sync script');
  console.log('3. Check Supabase logs for webhook delivery confirmations');
}

main().catch(console.error);
