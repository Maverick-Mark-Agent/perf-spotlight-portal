import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWhichWebhook() {
  console.log('=== CHECKING WHICH WEBHOOK IS BEING CALLED ===\n');

  // Check webhook_delivery_log which is only used by universal-bison-webhook
  const { data: universalLogs } = await supabase
    .from('webhook_delivery_log')
    .select('id, created_at, event_type')
    .eq('workspace_name', 'Tony Schmitz')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('universal-bison-webhook calls (from webhook_delivery_log):');
  if (universalLogs && universalLogs.length > 0) {
    universalLogs.forEach((log, i) => {
      const age = (Date.now() - new Date(log.created_at).getTime()) / 1000 / 60;
      console.log(`  ${i + 1}. ${log.created_at} (${age.toFixed(0)} min ago) - ${log.event_type}`);
    });
  } else {
    console.log('  No logs found (or old webhook is being used)');
  }

  // Check client_leads to see when leads were created
  const { data: leads } = await supabase
    .from('client_leads')
    .select('lead_email, created_at, updated_at')
    .eq('workspace_name', 'Tony Schmitz')
    .eq('pipeline_stage', 'interested')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n\nRecent interested leads in database:');
  if (leads && leads.length > 0) {
    leads.forEach((lead, i) => {
      const age = (Date.now() - new Date(lead.created_at).getTime()) / 1000 / 60;
      console.log(`  ${i + 1}. ${lead.lead_email}`);
      console.log(`      Created: ${lead.created_at} (${age.toFixed(0)} min ago)`);
    });
  }

  // Compare timestamps
  if (universalLogs && universalLogs.length > 0 && leads && leads.length > 0) {
    const lastWebhookTime = new Date(universalLogs[0].created_at).getTime();
    const lastLeadTime = new Date(leads[0].created_at).getTime();
    const timeDiff = Math.abs(lastWebhookTime - lastLeadTime);

    console.log('\n\n=== ANALYSIS ===');

    if (timeDiff < 10000) { // Within 10 seconds
      console.log('✅ Times match - universal-bison-webhook IS being called');
      console.log('   The leads and webhook logs have matching timestamps');
    } else {
      console.log('❌ Times DON\'T match - likely using OLD webhook (bison-interested-webhook)');
      console.log(`   Last webhook log: ${universalLogs[0].created_at}`);
      console.log(`   Last lead created: ${leads[0].created_at}`);
      console.log(`   Time difference: ${(timeDiff / 1000).toFixed(0)} seconds`);
      console.log('\n   This means:');
      console.log('   - Email Bison is calling the OLD webhook (bison-interested-webhook)');
      console.log('   - The OLD webhook saves leads but does NOT send Slack notifications');
      console.log('   - We need to remove the old webhook (#86) from Email Bison');
    }
  }
}

checkWhichWebhook().catch(console.error);
