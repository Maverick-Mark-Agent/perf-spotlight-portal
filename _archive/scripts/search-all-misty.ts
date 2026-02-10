import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function searchAllMisty() {
  console.log('=== SEARCHING FOR MISTY DYKES EVERYWHERE ===\n');

  const email = 'mistydykes@icloud.com';

  // 1. Check client_leads
  console.log('1. Checking client_leads table...');
  const { data: leads } = await supabase
    .from('client_leads')
    .select('*')
    .eq('lead_email', email);

  if (leads && leads.length > 0) {
    console.log(`   ✅ Found ${leads.length} record(s):`);
    leads.forEach(lead => {
      console.log(`      Workspace: ${lead.workspace_name}`);
      console.log(`      Stage: ${lead.pipeline_stage}`);
      console.log(`      Created: ${lead.created_at}`);
    });
  } else {
    console.log('   ❌ Not found in client_leads');
  }

  // 2. Check ANY lead with 'misty' in name or email
  console.log('\n2. Checking for any lead with "misty"...');
  const { data: mistyLeads } = await supabase
    .from('client_leads')
    .select('lead_email, first_name, last_name, workspace_name, created_at')
    .or('lead_email.ilike.%misty%,first_name.ilike.%misty%,last_name.ilike.%misty%');

  if (mistyLeads && mistyLeads.length > 0) {
    console.log(`   Found ${mistyLeads.length} lead(s) with "misty":`);
    mistyLeads.forEach(lead => {
      console.log(`      ${lead.first_name} ${lead.last_name} - ${lead.lead_email} (${lead.workspace_name})`);
    });
  } else {
    console.log('   ❌ No leads with "misty" found');
  }

  // 3. Check webhook logs for this email
  console.log('\n3. Checking webhook_delivery_log...');
  const { data: webhooks } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (webhooks) {
    const mistyWebhook = webhooks.find(w => {
      const leadEmail = w.payload?.data?.lead?.email;
      return leadEmail?.toLowerCase() === email.toLowerCase();
    });

    if (mistyWebhook) {
      console.log('   ✅ Found webhook for this email:');
      console.log(`      Time: ${mistyWebhook.created_at}`);
      console.log(`      Success: ${mistyWebhook.success}`);
    } else {
      console.log('   ❌ No webhook found in last 50 deliveries');
    }
  }

  // 4. Check when you marked it as interested
  console.log('\n4. Timeline check:');
  console.log(`   Current time: ${new Date().toISOString()}`);
  console.log('   You marked the lead ~5-15 minutes ago');

  console.log('\n=== CONCLUSION ===');
  console.log('If mistydykes@icloud.com is not in the database and no webhook was logged,');
  console.log('this means Email Bison did NOT send a webhook for this lead.');
  console.log('\nPossible reasons:');
  console.log('1. The lead was not actually marked as "interested" in Email Bison');
  console.log('2. Email Bison had an issue sending the webhook');
  console.log('3. You marked it in a different workspace (not Tony Schmitz)');
  console.log('4. The webhook event is queued and delayed');
}

searchAllMisty().catch(console.error);
