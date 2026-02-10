import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllRecentWebhooks() {
  console.log('=== CHECKING ALL RECENT WEBHOOKS (ANY WORKSPACE) ===\n');
  console.log(`Current time: ${new Date().toISOString()}\n`);

  // Check ALL webhooks in last 10 minutes, regardless of workspace
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: webhooks } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .gte('created_at', tenMinutesAgo)
    .order('created_at', { ascending: false });

  if (!webhooks || webhooks.length === 0) {
    console.log('❌ NO WEBHOOKS received in the last 10 minutes from ANY workspace\n');
    console.log('This confirms Email Bison is not sending ANY webhooks at all.\n');
  } else {
    console.log(`✅ Found ${webhooks.length} webhook(s) in last 10 minutes:\n`);

    webhooks.forEach((webhook, i) => {
      const ageSeconds = (Date.now() - new Date(webhook.created_at).getTime()) / 1000;
      console.log(`${i + 1}. ${webhook.workspace_name}`);
      console.log(`   Event: ${webhook.event_type}`);
      console.log(`   Time: ${webhook.created_at} (${ageSeconds.toFixed(0)}s ago)`);
      console.log(`   Success: ${webhook.success}`);
      if (webhook.payload?.data?.lead) {
        console.log(`   Lead: ${webhook.payload.data.lead.email}`);
      }
      console.log('');
    });
  }

  // Also check ALL recent leads created (any workspace)
  const { data: leads } = await supabase
    .from('client_leads')
    .select('workspace_name, lead_email, created_at')
    .gte('created_at', tenMinutesAgo)
    .order('created_at', { ascending: false });

  console.log('\n=== ALL LEADS CREATED IN LAST 10 MINUTES ===\n');

  if (!leads || leads.length === 0) {
    console.log('❌ No leads created in last 10 minutes\n');
  } else {
    console.log(`Found ${leads.length} lead(s):\n`);
    leads.forEach((lead, i) => {
      const ageSeconds = (Date.now() - new Date(lead.created_at).getTime()) / 1000;
      console.log(`${i + 1}. ${lead.workspace_name}: ${lead.lead_email}`);
      console.log(`   Created: ${lead.created_at} (${ageSeconds.toFixed(0)}s ago)\n`);
    });
  }

  // Check if you're in the right workspace
  console.log('\n=== WORKSPACE VERIFICATION ===\n');

  const { data: tonyWorkspace } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_instance')
    .eq('workspace_name', 'Tony Schmitz')
    .single();

  if (tonyWorkspace) {
    console.log('Tony Schmitz Workspace Details:');
    console.log(`  Workspace Name: ${tonyWorkspace.workspace_name}`);
    console.log(`  Workspace ID: ${tonyWorkspace.bison_workspace_id}`);
    console.log(`  Instance: ${tonyWorkspace.bison_instance}`);
    console.log(`  URL: https://send.maverickmarketingllc.com\n`);
    console.log('Make sure you\'re marking leads in THIS workspace (ID: 41)');
  }
}

checkAllRecentWebhooks().catch(console.error);
