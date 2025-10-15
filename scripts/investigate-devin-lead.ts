import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function investigate() {
  console.log('🔍 Investigating Devin Hodo Missing Lead\n');
  console.log('═'.repeat(100));

  // Check webhook delivery log for Devin
  console.log('\n1️⃣ Checking Webhook Delivery Log for Devin Hodo...\n');

  const { data: webhooks, error: webhookError } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .eq('workspace_name', 'Devin Hodo')
    .order('created_at', { ascending: false })
    .limit(10);

  if (webhookError) {
    console.log('❌ Error:', webhookError.message);
  } else if (!webhooks || webhooks.length === 0) {
    console.log('❌ NO webhook deliveries found for Devin Hodo');
    console.log('   This means webhooks are not firing for this client!\n');
  } else {
    console.log(`Found ${webhooks.length} webhook deliveries:\n`);
    for (const wh of webhooks) {
      const time = new Date(wh.created_at).toLocaleString();
      const status = wh.success ? '✅' : '❌';
      console.log(`${status} ${wh.event_type} | ${time}`);
      if (wh.error_message) {
        console.log(`   Error: ${wh.error_message}`);
      }
    }
  }

  // Check webhook health
  console.log('\n2️⃣ Checking Webhook Health for Devin Hodo...\n');

  const { data: health } = await supabase
    .from('webhook_health')
    .select('*')
    .eq('workspace_name', 'Devin Hodo')
    .single();

  if (!health) {
    console.log('❌ NO webhook health record for Devin Hodo');
    console.log('   This confirms webhooks have never fired\n');
  } else {
    console.log('Last Webhook:', health.last_webhook_at ? new Date(health.last_webhook_at).toLocaleString() : 'Never');
    console.log('Count (24h):', health.webhook_count_24h || 0);
    console.log('Healthy:', health.is_healthy ? '✅' : '❌');
    console.log('');
  }

  // Check client leads for Devin
  console.log('\n3️⃣ Checking Existing Leads for Devin Hodo...\n');

  const { data: leads } = await supabase
    .from('client_leads')
    .select('lead_email, first_name, last_name, date_received, pipeline_stage, interested')
    .eq('workspace_name', 'Devin Hodo')
    .order('date_received', { ascending: false })
    .limit(10);

  if (!leads || leads.length === 0) {
    console.log('⚠️  No leads found for Devin Hodo in database\n');
  } else {
    console.log(`Found ${leads.length} leads:\n`);
    for (const lead of leads) {
      const date = lead.date_received ? new Date(lead.date_received).toLocaleString() : 'N/A';
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown';
      console.log(`- ${lead.lead_email} | ${name} | ${date} | ${lead.pipeline_stage}`);
    }
    console.log('');
  }

  // Check webhook configuration
  console.log('\n4️⃣ Checking Webhook Configuration in Client Registry...\n');

  const { data: config } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_api_key, bison_webhook_enabled, bison_webhook_url, bison_instance')
    .eq('workspace_name', 'Devin Hodo')
    .single();

  if (!config) {
    console.log('❌ Devin Hodo not found in client registry\n');
  } else {
    console.log('Workspace Name:', config.workspace_name);
    console.log('Workspace ID:', config.bison_workspace_id);
    console.log('Instance:', config.bison_instance);
    console.log('Has API Key:', config.bison_api_key ? '✅ Yes' : '❌ No');
    console.log('Webhook Enabled:', config.bison_webhook_enabled ? '✅ Yes' : '❌ No');
    console.log('Webhook URL:', config.bison_webhook_url || 'Not set');
    console.log('');
  }

  // Check Email Bison for recent interested leads
  if (config && config.bison_api_key) {
    console.log('\n5️⃣ Checking Email Bison for Recent Interested Leads...\n');

    const baseUrl = config.bison_instance === 'Maverick'
      ? 'https://send.maverickmarketingllc.com/api'
      : 'https://send.longrun.agency/api';

    try {
      const response = await fetch(`${baseUrl}/replies?status=interested&per_page=10`, {
        headers: {
          'Authorization': `Bearer ${config.bison_api_key}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.log(`❌ Failed to fetch from Email Bison: ${response.status}`);
      } else {
        const data = await response.json();
        const replies = data.data || [];

        console.log(`Found ${replies.length} interested leads in Email Bison:\n`);

        for (const reply of replies) {
          const email = reply.from_email_address || 'unknown';
          const name = reply.from_name || 'Unknown';
          const date = reply.date_received ? new Date(reply.date_received).toLocaleString() : 'N/A';

          // Check if this lead is in our database
          const { data: existingLead } = await supabase
            .from('client_leads')
            .select('lead_email')
            .eq('workspace_name', 'Devin Hodo')
            .eq('lead_email', email)
            .single();

          const inDb = existingLead ? '✅ In DB' : '❌ MISSING FROM DB';

          console.log(`${inDb} | ${email} | ${name} | ${date}`);
        }
      }
    } catch (error: any) {
      console.log('❌ Error fetching from Email Bison:', error.message);
    }
  }

  console.log('\n═'.repeat(100));
  console.log('\n📊 DIAGNOSIS:\n');

  if (!webhooks || webhooks.length === 0) {
    console.log('🔴 PROBLEM: Webhooks are not firing for Devin Hodo\n');
    console.log('POSSIBLE CAUSES:');
    console.log('1. Webhook not registered in Email Bison');
    console.log('2. Webhook URL incorrect');
    console.log('3. Lead was marked interested BEFORE webhook was created');
    console.log('4. Workspace name mismatch\n');
    console.log('SOLUTION: Re-run webhook setup or manually sync recent leads');
  }

  console.log('\n═'.repeat(100));
}

investigate().catch(console.error);
