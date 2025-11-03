/**
 * Add a realistic sample contact to Kim Wallace's workspace to demonstrate the feature
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function addSampleContact() {
  console.log('📝 Adding sample contact to Kim Wallace workspace...\n');

  const workspaceName = 'Kim Wallace';
  const sampleEmail = 'sarah.johnson.demo@example.com';

  // Check if already exists
  const { data: existing } = await supabase
    .from('client_leads')
    .select('id')
    .eq('workspace_name', workspaceName)
    .eq('lead_email', sampleEmail)
    .maybeSingle();

  if (existing) {
    console.log('⚠️  Sample contact already exists. Removing old version...');
    await supabase
      .from('client_leads')
      .delete()
      .eq('id', existing.id);
  }

  // Add sample contact
  const sampleContact = {
    workspace_name: workspaceName,
    lead_email: sampleEmail,
    first_name: 'Sarah',
    last_name: 'Johnson',
    phone: '(512) 555-7890',
    address: '456 Oak Avenue',
    city: 'Round Rock',
    state: 'TX',
    zip: '78664',
    renewal_date: 'January 10th, 2026',
    birthday: '03/15/1978',
    notes: 'Referred by existing client John Smith. Very interested in bundling home and auto. Current premium expires in 2 months. Wants quote by end of week.',
    custom_variables: [
      { name: 'home value', value: '$525,000' },
      { name: 'income', value: '150-174,999' },
      { name: 'referral source', value: 'Existing Client - John Smith' },
      { name: 'current carrier', value: 'State Farm' },
      { name: 'bundle interest', value: 'Home + Auto' }
    ],
    pipeline_stage: 'interested',
    interested: true,
    date_received: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
    lead_value: 0,
    pipeline_position: 0,
    icp: true,
  };

  const { data: inserted, error } = await supabase
    .from('client_leads')
    .insert([sampleContact])
    .select()
    .single();

  if (error) {
    console.error('❌ Error adding sample contact:', error);
    process.exit(1);
  }

  console.log('✅ Sample contact added successfully!\n');
  console.log('Contact Details:');
  console.log(`  Name: ${inserted.first_name} ${inserted.last_name}`);
  console.log(`  Email: ${inserted.lead_email}`);
  console.log(`  Phone: ${inserted.phone}`);
  console.log(`  Address: ${inserted.address}, ${inserted.city}, ${inserted.state} ${inserted.zip}`);
  console.log(`  Renewal Date: ${inserted.renewal_date}`);
  console.log(`  Notes: ${inserted.notes}`);
  console.log(`  ICP: ${inserted.icp ? 'Yes' : 'No'}`);
  console.log(`  Custom Variables: ${inserted.custom_variables?.length || 0} fields`);
  console.log('\n🎯 This contact will appear in the "Interested" column on Kim Wallace\'s portal!');
  console.log('🔗 Visit: http://localhost:8082/client-portal/Kim%20Wallace');
}

addSampleContact().catch(console.error);
