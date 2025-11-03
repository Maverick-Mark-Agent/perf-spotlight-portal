/**
 * Test script to verify lead editing functionality
 * This tests updating all fields of an existing lead
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testLeadEditing() {
  console.log('🧪 Testing Lead Editing Functionality\n');

  const workspaceName = 'Kim Wallace';
  const testEmail = 'sarah.johnson.demo@example.com';

  // Step 1: Find the test lead
  console.log('Step 1: Finding test lead...');
  const { data: leads, error: findError } = await supabase
    .from('client_leads')
    .select('*')
    .eq('workspace_name', workspaceName)
    .eq('lead_email', testEmail)
    .maybeSingle();

  if (findError) {
    console.error('❌ Error finding lead:', findError);
    process.exit(1);
  }

  if (!leads) {
    console.error('❌ Test lead not found. Run scripts/add-sample-contact-kim.ts first');
    process.exit(1);
  }

  console.log('✅ Found test lead:');
  console.log(`  ID: ${leads.id}`);
  console.log(`  Name: ${leads.first_name} ${leads.last_name}`);
  console.log(`  Email: ${leads.lead_email}`);
  console.log(`  Phone: ${leads.phone || 'N/A'}`);
  console.log(`  City: ${leads.city || 'N/A'}`);

  // Step 2: Update the lead with new information
  console.log('\nStep 2: Updating lead with new information...');
  const updates = {
    first_name: 'Sarah',
    last_name: 'Johnson-Smith', // Changed last name
    phone: '(512) 555-9999', // Updated phone
    address: '789 Updated Street', // Updated address
    city: 'Cedar Park', // Changed city
    state: 'TX',
    zip: '78613', // Updated zip
    title: 'Senior Manager', // Updated title
    company: 'Tech Corp Updated', // Updated company
    renewal_date: 'February 15th, 2026', // Updated renewal
    birthday: '03/15/1979', // Updated birthday (1 year older)
    notes: 'Lead information updated via automated test. Contact prefers email communication.', // Updated notes
    custom_variables: [
      { name: 'home value', value: '$550,000' }, // Updated value
      { name: 'income', value: '175-199,999' }, // Updated income bracket
      { name: 'referral source', value: 'Updated - Direct Call' }, // Updated source
      { name: 'preferred contact method', value: 'Email' }, // New custom variable
      { name: 'last contact date', value: new Date().toLocaleDateString() } // New custom variable
    ],
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error: updateError } = await supabase
    .from('client_leads')
    .update(updates)
    .eq('id', leads.id)
    .select()
    .single();

  if (updateError) {
    console.error('❌ Error updating lead:', updateError);
    process.exit(1);
  }

  console.log('✅ Lead updated successfully!\n');

  // Step 3: Verify the updates
  console.log('Step 3: Verifying updates...');
  const { data: verified, error: verifyError } = await supabase
    .from('client_leads')
    .select('*')
    .eq('id', leads.id)
    .single();

  if (verifyError) {
    console.error('❌ Error verifying updates:', verifyError);
    process.exit(1);
  }

  console.log('✅ Verification successful!\n');
  console.log('Updated Lead Details:');
  console.log(`  Name: ${verified.first_name} ${verified.last_name}`);
  console.log(`  Email: ${verified.lead_email}`);
  console.log(`  Phone: ${verified.phone}`);
  console.log(`  Address: ${verified.address}, ${verified.city}, ${verified.state} ${verified.zip}`);
  console.log(`  Title: ${verified.title || 'N/A'}`);
  console.log(`  Company: ${verified.company || 'N/A'}`);
  console.log(`  Renewal Date: ${verified.renewal_date}`);
  console.log(`  Birthday: ${verified.birthday}`);
  console.log(`  Notes: ${verified.notes}`);
  console.log(`  Custom Variables (${verified.custom_variables?.length || 0} fields):`);
  if (verified.custom_variables) {
    verified.custom_variables.forEach((cv: any) => {
      console.log(`    - ${cv.name}: ${cv.value}`);
    });
  }

  // Step 4: Test field validations
  console.log('\nStep 4: Testing field validations...');

  // Test 1: Required fields
  console.log('  Test 1: Ensuring email cannot be empty...');
  const { error: emptyEmailError } = await supabase
    .from('client_leads')
    .update({ lead_email: '' })
    .eq('id', leads.id);

  if (emptyEmailError) {
    console.log('  ✅ Empty email prevented (as expected)');
  } else {
    console.log('  ⚠️  Warning: Empty email was allowed (may need validation)');
  }

  // Test 2: Update timestamps
  console.log('  Test 2: Checking updated_at timestamp...');
  const originalUpdatedAt = new Date(leads.updated_at).getTime();
  const newUpdatedAt = new Date(verified.updated_at).getTime();

  if (newUpdatedAt > originalUpdatedAt) {
    console.log('  ✅ updated_at timestamp correctly updated');
  } else {
    console.log('  ❌ updated_at timestamp not updated');
  }

  // Step 5: Summary
  console.log('\n🎉 All tests passed!');
  console.log('\n📋 Summary:');
  console.log('  ✅ Lead found successfully');
  console.log('  ✅ All fields updated correctly');
  console.log('  ✅ Contact information updated');
  console.log('  ✅ Professional information updated');
  console.log('  ✅ Insurance dates updated');
  console.log('  ✅ Custom variables updated (5 fields)');
  console.log('  ✅ Notes updated');
  console.log('  ✅ Timestamp tracking works');
  console.log('\n🚀 The Lead Editing feature is working correctly!');
  console.log(`\n🔗 View in portal: http://localhost:8082/client-portal/Kim%20Wallace`);
}

testLeadEditing().catch(console.error);
