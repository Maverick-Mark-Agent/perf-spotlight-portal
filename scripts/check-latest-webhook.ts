import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLatestWebhook() {
  console.log('=== CHECKING LATEST WEBHOOK ACTIVITY ===\n');
  console.log(`Current time: ${new Date().toISOString()}\n`);

  // Check all recent webhooks for Tony Schmitz (any event type)
  const { data: webhooks, error } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching webhooks:', error);
    return;
  }

  if (!webhooks || webhooks.length === 0) {
    console.log('❌ No webhooks found for Tony Schmitz');
    return;
  }

  console.log(`Found ${webhooks.length} recent webhooks:\n`);

  webhooks.forEach((webhook, i) => {
    const ageMinutes = (Date.now() - new Date(webhook.created_at).getTime()) / 1000 / 60;
    console.log(`${i + 1}. ${webhook.event_type}`);
    console.log(`   Time: ${webhook.created_at} (${ageMinutes.toFixed(1)} minutes ago)`);
    console.log(`   Success: ${webhook.success}`);

    if (webhook.payload?.data?.lead) {
      console.log(`   Lead: ${webhook.payload.data.lead.email}`);
    }
    console.log('');
  });

  // Check if there's been a webhook in the last 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const recentWebhook = webhooks.find(w => w.created_at > fiveMinutesAgo);

  if (recentWebhook) {
    console.log('✅ Found webhook in last 5 minutes!');
    console.log('The webhook IS being triggered.\n');
  } else {
    console.log('❌ No webhook in last 5 minutes');
    console.log('This suggests Email Bison is NOT sending webhooks.\n');
  }

  // Check most recent lead
  const { data: leads } = await supabase
    .from('client_leads')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .order('created_at', { ascending: false })
    .limit(1);

  if (leads && leads.length > 0) {
    const lead = leads[0];
    const leadAge = (Date.now() - new Date(lead.created_at).getTime()) / 1000 / 60;
    console.log('Most recent lead in database:');
    console.log(`  Email: ${lead.lead_email}`);
    console.log(`  Created: ${lead.created_at} (${leadAge.toFixed(1)} minutes ago)`);
    console.log(`  Stage: ${lead.pipeline_stage}`);
  }
}

checkLatestWebhook().catch(console.error);
