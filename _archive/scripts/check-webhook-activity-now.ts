import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentActivity() {
  console.log('=== CHECKING RECENT WEBHOOK ACTIVITY ===\n');

  // Get current time
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  console.log(`Current time: ${now.toISOString()}`);
  console.log(`Checking last 5 minutes (since ${fiveMinutesAgo.toISOString()})\n`);

  // Check webhook_delivery_log for recent webhooks
  const { data: recentWebhooks, error } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .gte('created_at', fiveMinutesAgo.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching webhooks:', error);
    return;
  }

  console.log(`Total webhooks in last 5 minutes: ${recentWebhooks.length}\n`);

  if (recentWebhooks.length === 0) {
    console.log('❌ NO WEBHOOKS RECEIVED IN LAST 5 MINUTES');
    console.log('\nThis means Email Bison is not sending webhooks to our endpoint.');
    console.log('\nPossible causes:');
    console.log('1. Lead was not marked as interested (or was already marked before)');
    console.log('2. Webhook #115 is not registered properly');
    console.log('3. Email Bison cache has not cleared yet');
    console.log('4. Testing on wrong workspace (not Tony Schmitz)');

    // Check all webhooks today
    console.log('\n--- All webhooks today for Tony Schmitz ---');
    const { data: todayWebhooks } = await supabase
      .from('webhook_delivery_log')
      .select('*')
      .eq('workspace_name', 'Tony Schmitz')
      .gte('created_at', new Date().toISOString().split('T')[0] + 'T00:00:00Z')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log(`Total Tony webhooks today: ${todayWebhooks?.length || 0}`);
    todayWebhooks?.forEach((wh, idx) => {
      console.log(`\n${idx + 1}. ${wh.created_at}`);
      console.log(`   Event: ${wh.event_type}`);
      console.log(`   Success: ${wh.success}`);
      console.log(`   Lead: ${wh.payload?.data?.lead?.email || 'N/A'}`);
    });

  } else {
    console.log('✅ WEBHOOKS RECEIVED!\n');

    recentWebhooks.forEach((wh, idx) => {
      console.log(`--- Webhook ${idx + 1} ---`);
      console.log(`Time: ${wh.created_at}`);
      console.log(`Workspace: ${wh.workspace_name}`);
      console.log(`Event: ${wh.event_type}`);
      console.log(`Success: ${wh.success}`);
      console.log(`Error: ${wh.error_message || 'None'}`);
      console.log(`Processing Time: ${wh.processing_time_ms}ms`);

      const lead = wh.payload?.data?.lead;
      if (lead) {
        console.log(`Lead Email: ${lead.email}`);
        console.log(`Lead Name: ${lead.first_name} ${lead.last_name}`);
      }
      console.log();
    });

    // Check if Tony's webhooks are in there
    const tonyWebhooks = recentWebhooks.filter(w =>
      w.workspace_name?.toLowerCase().includes('tony')
    );

    if (tonyWebhooks.length > 0) {
      console.log(`\n✅ Found ${tonyWebhooks.length} Tony Schmitz webhook(s)`);

      // Check if leads were saved to database
      console.log('\nChecking if leads were saved to database...');
      const { data: recentLeads } = await supabase
        .from('client_leads')
        .select('*')
        .eq('workspace_name', 'Tony Schmitz')
        .gte('created_at', fiveMinutesAgo.toISOString())
        .order('created_at', { ascending: false });

      console.log(`Leads saved in last 5 minutes: ${recentLeads?.length || 0}`);
      recentLeads?.forEach(lead => {
        console.log(`  - ${lead.first_name} ${lead.last_name} (${lead.lead_email})`);
      });

      if (recentLeads && recentLeads.length > 0) {
        console.log('\n✅ Leads ARE being saved to database!');
        console.log('⚠️ If you\'re not seeing Slack notifications, check:');
        console.log('1. The correct Slack channel');
        console.log('2. Edge Function logs for Slack errors');
      } else {
        console.log('\n❌ Leads are NOT being saved to database');
        console.log('Check Edge Function logs for errors');
      }
    } else {
      console.log('\n⚠️ No Tony Schmitz webhooks in last 5 minutes');
      console.log('Webhooks received were for other workspaces');
    }
  }

  // Check webhook registration
  console.log('\n--- Checking Email Bison Webhook Registration ---');
  const { data: client } = await supabase
    .from('client_registry')
    .select('bison_api_key, workspace_name')
    .eq('workspace_name', 'Tony Schmitz')
    .single();

  if (client?.bison_api_key) {
    const response = await fetch('https://send.maverickmarketingllc.com/api/webhook-url', {
      headers: {
        'Authorization': `Bearer ${client.bison_api_key}`,
        'Content-Type': 'application/json'
      }
    });

    const webhooks = await response.json();
    console.log('Registered webhooks in Email Bison:');
    console.log(JSON.stringify(webhooks, null, 2));
  }
}

checkRecentActivity().catch(console.error);
