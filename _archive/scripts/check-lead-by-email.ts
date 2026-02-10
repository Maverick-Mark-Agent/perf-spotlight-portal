import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLeadByEmail() {
  const email = process.argv[2];

  if (!email) {
    console.log('Usage: npx tsx scripts/check-lead-by-email.ts <email>');
    console.log('Example: npx tsx scripts/check-lead-by-email.ts test@example.com');
    return;
  }

  console.log(`=== CHECKING LEAD: ${email} ===\n`);

  // Check if lead exists in database
  const { data: lead } = await supabase
    .from('client_leads')
    .select('*')
    .eq('lead_email', email)
    .eq('workspace_name', 'Tony Schmitz')
    .maybeSingle();

  if (lead) {
    console.log('✅ Lead EXISTS in database:');
    console.log(`   Name: ${lead.first_name} ${lead.last_name}`);
    console.log(`   Stage: ${lead.pipeline_stage}`);
    console.log(`   Interested: ${lead.interested}`);
    console.log(`   Created: ${lead.created_at}`);
    console.log(`   Updated: ${lead.updated_at}`);
    console.log('\n⚠️  This lead already exists in the database!');
    console.log('Email Bison won\'t send another webhook for re-marking existing leads.\n');
  } else {
    console.log('❌ Lead NOT found in database');
    console.log('This is a NEW lead - Email Bison should send a webhook when marked as interested.\n');
  }

  // Check webhook logs for this email
  const { data: webhooks } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (webhooks) {
    const matchingWebhooks = webhooks.filter(w => {
      const leadEmail = w.payload?.data?.lead?.email;
      return leadEmail?.toLowerCase() === email.toLowerCase();
    });

    if (matchingWebhooks.length > 0) {
      console.log(`\n✅ Found ${matchingWebhooks.length} webhook(s) for this email:`);
      matchingWebhooks.forEach((w, i) => {
        console.log(`   ${i + 1}. ${w.created_at} - ${w.event_type}`);
      });
      console.log('\nThis lead has received webhooks before.');
    } else {
      console.log('\n❌ No webhooks found for this email in recent history');
    }
  }
}

checkLeadByEmail().catch(console.error);
