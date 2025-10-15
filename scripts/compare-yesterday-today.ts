import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function compareYesterdayToday() {
  console.log('=== COMPARING YESTERDAY VS TODAY ===\n');

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  console.log(`Today: ${now.toISOString()}`);
  console.log(`Yesterday: ${yesterday.toISOString()}\n`);

  // Check webhook deliveries from yesterday
  const yesterdayStart = new Date(yesterday);
  yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterday);
  yesterdayEnd.setHours(23, 59, 59, 999);

  console.log('=== YESTERDAY\'S WEBHOOK ACTIVITY ===');
  console.log(`Checking: ${yesterdayStart.toISOString()} to ${yesterdayEnd.toISOString()}\n`);

  const { data: yesterdayWebhooks } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .gte('created_at', yesterdayStart.toISOString())
    .lte('created_at', yesterdayEnd.toISOString())
    .order('created_at', { ascending: false });

  if (yesterdayWebhooks && yesterdayWebhooks.length > 0) {
    console.log(`✅ Found ${yesterdayWebhooks.length} webhooks yesterday:\n`);
    yesterdayWebhooks.forEach((w, i) => {
      console.log(`${i + 1}. ${w.created_at}`);
      console.log(`   Event: ${w.event_type}`);
      console.log(`   Lead: ${w.payload?.data?.lead?.email}`);
      console.log(`   Success: ${w.success}`);
      console.log('');
    });
  } else {
    console.log('❌ No webhooks found yesterday\n');
  }

  // Check today's webhooks
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  console.log('\n=== TODAY\'S WEBHOOK ACTIVITY ===');
  console.log(`Checking: ${todayStart.toISOString()} to now\n`);

  const { data: todayWebhooks } = await supabase
    .from('webhook_delivery_log')
    .select('*')
    .eq('workspace_name', 'Tony Schmitz')
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: false });

  if (todayWebhooks && todayWebhooks.length > 0) {
    console.log(`✅ Found ${todayWebhooks.length} webhooks today:\n`);
    todayWebhooks.forEach((w, i) => {
      console.log(`${i + 1}. ${w.created_at}`);
      console.log(`   Event: ${w.event_type}`);
      console.log(`   Lead: ${w.payload?.data?.lead?.email}`);
      console.log(`   Success: ${w.success}`);
      console.log('');
    });
  } else {
    console.log('❌ No webhooks found today\n');
  }

  // Check when the webhook was deleted
  console.log('\n=== CHECKING WHAT CHANGED ===\n');

  console.log('Key Question: Did we delete the old webhook today?\n');

  // The old webhook (ID 86) was deleted today
  console.log('Timeline of Events:');
  console.log('- October 13 (Yesterday): Old webhook #86 (bison-interested-webhook) was ACTIVE');
  console.log('  - This webhook saved leads to database');
  console.log('  - But did NOT send Slack notifications');
  console.log('');
  console.log('- October 14 (Today): We deleted old webhook #86');
  console.log('  - Now only webhook #112 (universal-bison-webhook) exists');
  console.log('  - This webhook DOES send Slack notifications');
  console.log('  - But it was created on Oct 10, not yesterday');
  console.log('');

  console.log('\n=== HYPOTHESIS ===\n');
  console.log('Yesterday (Oct 13), you configured webhook #112 for Tony.');
  console.log('But webhook #86 was ALSO still registered.');
  console.log('Email Bison was likely calling webhook #86 (the older one).');
  console.log('\nToday, we deleted webhook #86.');
  console.log('Now Email Bison should be calling webhook #112.');
  console.log('But for some reason, it\'s not sending webhooks at all.\n');

  console.log('Possible reasons:');
  console.log('1. Email Bison caches webhook registrations and hasn\'t refreshed');
  console.log('2. Deleting the old webhook broke something in Email Bison');
  console.log('3. There\'s a different webhook URL registered that we haven\'t seen');
  console.log('4. The n8n workflow URL is what\'s actually registered\n');
}

compareYesterdayToday().catch(console.error);
