#!/usr/bin/env node

/**
 * Test Script: Verify Shane Miller Account Count
 * Expected: 444 accounts
 * Current: Showing incorrect count in dashboard
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testShaneMiller() {
  console.log('🔍 TESTING: Shane Miller Account Count\n');
  console.log('Expected: 444 accounts');
  console.log('=' .repeat(70));

  // Test 1: Query database with ALL possible Shane Miller workspace variations
  console.log('\n1️⃣  QUERYING DATABASE: sender_emails_cache');
  console.log('-'.repeat(70));

  const { data: allAccounts, error } = await supabase
    .from('sender_emails_cache')
    .select('email_address, workspace_name, bison_instance');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`✅ Total records in database: ${allAccounts?.length || 0}`);

  // Find all Shane Miller workspace variations
  const shaneVariations = new Set();
  const shaneAccounts = allAccounts.filter(account => {
    const ws = account.workspace_name?.toLowerCase() || '';
    const isShane = ws.includes('shane') && ws.includes('miller');
    if (isShane) {
      shaneVariations.add(account.workspace_name);
    }
    return isShane;
  });

  console.log(`\n📊 Shane Miller Workspace Variations:`);
  shaneVariations.forEach(ws => {
    const count = shaneAccounts.filter(a => a.workspace_name === ws).length;
    console.log(`   - "${ws}": ${count} records`);
  });

  console.log(`\n✅ Total Shane Miller records (with duplicates): ${shaneAccounts.length}`);

  // Test 2: Deduplicate by email address
  console.log('\n\n2️⃣  DEDUPLICATION TEST');
  console.log('-'.repeat(70));

  const uniqueEmails = new Set();
  const duplicates = [];

  shaneAccounts.forEach(account => {
    if (uniqueEmails.has(account.email_address)) {
      duplicates.push(account);
    } else {
      uniqueEmails.add(account.email_address);
    }
  });

  console.log(`✅ Unique Shane Miller emails: ${uniqueEmails.size}`);
  console.log(`⚠️  Duplicate records: ${duplicates.length}`);

  if (duplicates.length > 0) {
    console.log(`\n📋 Sample duplicates (first 5):`);
    duplicates.slice(0, 5).forEach(dup => {
      console.log(`   - ${dup.email_address}`);
      console.log(`     Workspace: ${dup.workspace_name}`);
      console.log(`     Instance: ${dup.bison_instance}\n`);
    });
  }

  // Test 3: Check bison_instance distribution
  console.log('\n3️⃣  BISON INSTANCE DISTRIBUTION');
  console.log('-'.repeat(70));

  const instanceCounts = {};
  shaneAccounts.forEach(account => {
    const instance = account.bison_instance || 'unknown';
    instanceCounts[instance] = (instanceCounts[instance] || 0) + 1;
  });

  Object.entries(instanceCounts).forEach(([instance, count]) => {
    console.log(`   ${instance}: ${count} records`);
  });

  // Test 4: Check if same email appears in multiple instances
  console.log('\n\n4️⃣  CROSS-INSTANCE DUPLICATES');
  console.log('-'.repeat(70));

  const emailInstances = {};
  shaneAccounts.forEach(account => {
    if (!emailInstances[account.email_address]) {
      emailInstances[account.email_address] = [];
    }
    emailInstances[account.email_address].push(account.bison_instance);
  });

  const crossInstanceDuplicates = Object.entries(emailInstances).filter(
    ([email, instances]) => new Set(instances).size > 1
  );

  if (crossInstanceDuplicates.length > 0) {
    console.log(`⚠️  ${crossInstanceDuplicates.length} emails appear in multiple instances`);
    console.log(`\nSamples (first 5):`);
    crossInstanceDuplicates.slice(0, 5).forEach(([email, instances]) => {
      console.log(`   ${email}: [${instances.join(', ')}]`);
    });
  } else {
    console.log(`✅ No emails appear in multiple instances`);
  }

  // Final Analysis
  console.log('\n\n5️⃣  FINAL ANALYSIS');
  console.log('='.repeat(70));

  console.log(`\n📊 Summary:`);
  console.log(`   Total database records (Shane Miller): ${shaneAccounts.length}`);
  console.log(`   Unique email addresses: ${uniqueEmails.size}`);
  console.log(`   Expected count: 444`);
  console.log(`   Difference: ${Math.abs(uniqueEmails.size - 444)}`);

  if (uniqueEmails.size === 444) {
    console.log(`\n✅ COUNT IS CORRECT: ${uniqueEmails.size} unique emails`);
  } else if (uniqueEmails.size < 444) {
    console.log(`\n⚠️  COUNT IS LOW: Missing ${444 - uniqueEmails.size} accounts`);
    console.log(`   Possible causes:`);
    console.log(`   - Database not fully synced`);
    console.log(`   - Polling job hasn't completed`);
    console.log(`   - Some accounts filtered out`);
  } else {
    console.log(`\n⚠️  COUNT IS HIGH: Extra ${uniqueEmails.size - 444} accounts`);
    console.log(`   Possible causes:`);
    console.log(`   - Incorrect expected count (maybe 444 is wrong?)`);
    console.log(`   - Test accounts included`);
    console.log(`   - Multiple workspace entries`);
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

testShaneMiller().catch(console.error);
