import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function addMissingLead() {
  console.log('➕ Adding Missing Lead: Brian Hocutt\n');
  console.log('═'.repeat(100));

  // Extract phone from custom variables
  const phoneVariable = { name: 'phone', value: '(256) 302-2640' };

  const leadData = {
    workspace_name: 'Devin Hodo',
    first_name: 'Brian',
    last_name: 'Hocutt',
    lead_email: 'brianhocutt2012@gmail.com',
    phone: phoneVariable.value,
    title: null,
    company: null,
    custom_variables: [
      { name: 'street address', value: '9515 Union Grove Rd' },
      { name: 'city', value: 'Union Grove' },
      { name: 'state', value: 'AL' },
      { name: 'zip', value: '35175' },
      { name: 'renewal', value: '12' },
      { name: 'phone', value: '(256) 302-2640' },
      { name: 'date of birth', value: '10/11/1965' },
      { name: 'home value', value: '$78K' },
    ],
    bison_conversation_url: 'https://send.maverickmarketingllc.com/workspaces/37/leads/697653',
    pipeline_stage: 'interested',
    date_received: '2025-10-10T19:03:52.000000Z',
    lead_value: 0,
    tags: null,
    interested: true,
    bison_lead_id: '697653',
    bison_reply_id: 4485076,
    bison_reply_uuid: 'a0150ed0-3566-4159-a9f3-cca985d0621f',
    airtable_id: 'bison_reply_4485076',
    last_synced_at: new Date().toISOString(),
  };

  console.log('📋 Lead Details:\n');
  console.log(`   Name: ${leadData.first_name} ${leadData.last_name}`);
  console.log(`   Email: ${leadData.lead_email}`);
  console.log(`   Phone: ${leadData.phone}`);
  console.log(`   Address: 9515 Union Grove Rd, Union Grove, AL 35175`);
  console.log(`   Renewal: December (12)`);
  console.log(`   Home Value: $78K`);
  console.log(`   Date of Birth: 10/11/1965`);
  console.log(`   Date Received: ${new Date(leadData.date_received).toLocaleString()}`);
  console.log('');

  // Check if already exists
  const { data: existing } = await supabase
    .from('client_leads')
    .select('id, lead_email')
    .eq('workspace_name', 'Devin Hodo')
    .eq('lead_email', 'brianhocutt2012@gmail.com')
    .single();

  if (existing) {
    console.log('⚠️  Lead already exists in database!');
    console.log(`   ID: ${existing.id}`);
    console.log('\n   Updating existing record...\n');
  } else {
    console.log('✅ Lead not in database - creating new record...\n');
  }

  // Upsert the lead
  const { data, error } = await supabase
    .from('client_leads')
    .upsert(leadData, {
      onConflict: 'workspace_name,lead_email',
      ignoreDuplicates: false,
    })
    .select();

  if (error) {
    console.error('❌ Error adding lead:', error);
    console.error('   Details:', error.message);
    return;
  }

  console.log('✅ Successfully added/updated lead!\n');
  console.log(`   Record ID: ${data[0]?.id}`);
  console.log(`   Workspace: ${data[0]?.workspace_name}`);
  console.log(`   Email: ${data[0]?.lead_email}`);
  console.log(`   Interested: ${data[0]?.interested ? '✅' : '❌'}`);
  console.log(`   Pipeline Stage: ${data[0]?.pipeline_stage}`);
  console.log('');

  console.log('═'.repeat(100));
  console.log('\n🎯 NEXT STEPS:\n');
  console.log('1. Check Devin Hodo\'s portal - Brian Hocutt should now appear');
  console.log('2. Click on the lead to see all custom variables');
  console.log('3. Click "View in Email Bison" to see the full conversation\n');

  console.log('📝 Lead Message:\n');
  console.log('   "Call me Sunday evening');
  console.log('    Please"\n');

  console.log('✨ Done!\n');
}

addMissingLead().catch(console.error);
