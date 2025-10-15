import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMistyDykes() {
  console.log('=== CHECKING FOR MISTY DYKES ===\n');

  const email = 'mistydykes@icloud.com';

  // Check if this lead exists in the database
  const { data: lead, error: leadError } = await supabase
    .from('client_leads')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .eq('lead_email', email)
    .maybeSingle();

  if (leadError) {
    console.error('Error checking lead:', leadError);
  }

  if (lead) {
    console.log('✅ Lead found in database:');
    console.log(JSON.stringify(lead, null, 2));
  } else {
    console.log('❌ Lead NOT found in database');
    console.log('\nThis confirms the webhook was never triggered by Email Bison.');
  }

  // Check webhook logs for this email
  const { data: webhooks } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .order('created_at', { ascending: false })
    .limit(20);

  if (webhooks) {
    const mistyWebhook = webhooks.find(w => {
      const leadEmail = w.payload?.data?.lead?.email;
      return leadEmail?.toLowerCase() === email.toLowerCase();
    });

    if (mistyWebhook) {
      console.log('\n✅ Webhook found for this email:');
      console.log(JSON.stringify(mistyWebhook, null, 2));
    } else {
      console.log('\n❌ No webhook found in last 20 webhook deliveries for this email');
    }
  }

  console.log('\n=== CONCLUSION ===');
  console.log('If the lead is not in the database and no webhook was logged,');
  console.log('this means Email Bison did NOT send a webhook for this event.');
  console.log('\nPossible reasons:');
  console.log('1. Webhook is not registered in Email Bison for workspace 41');
  console.log('2. The lead was not actually marked as interested in Email Bison');
  console.log('3. Webhook registration is pointing to the wrong URL');
}

checkMistyDykes().catch(console.error);
