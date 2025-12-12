#!/usr/bin/env node

/**
 * Diagnostic Script: Investigate Incorrect Account Counts
 *
 * Issue: Shane Miller showing 505 accounts instead of 44
 * Total accounts incorrect as well
 *
 * This script will check for:
 * 1. Duplicate records in sender_emails_cache
 * 2. Multiple bison_instance entries for same workspace
 * 3. Data transformation issues
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODA5MTU2NywiZXhwIjoyMDQzNjY3NTY3fQ.k-ant-api03-5h09QQR7HYaS9f7vfCjENfm6qJ0qjbGnK2FNwDR3DeVwBM_Q6rw3ne7CTp6h2OBQOfrg9IBD6xnthj6hsYbVJQ-Sum12QAA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseAccountCounts() {
  console.log('🔍 DIAGNOSTIC REPORT: Incorrect Account Counts\n');
  console.log('=' .repeat(70));

  // 1. Check total count
  console.log('\n1️⃣  TOTAL ACCOUNT COUNT IN DATABASE');
  console.log('-'.repeat(70));

  const { count: totalCount, error: countError } = await supabase
    .from('sender_emails_cache')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error fetching total count:', countError);
  } else {
    console.log(`✅ Total records in sender_emails_cache: ${totalCount}`);
  }

  // 2. Check Shane Miller specifically
  console.log('\n\n2️⃣  SHANE MILLER ACCOUNT COUNT');
  console.log('-'.repeat(70));

  const { data: shaneAccounts, error: shaneError } = await supabase
    .from('sender_emails_cache')
    .select('email_address, workspace_name, bison_instance')
    .or('workspace_name.ilike.%Shane%Miller%,workspace_name.ilike.%Miller%Shane%');

  if (shaneError) {
    console.error('❌ Error fetching Shane Miller accounts:', shaneError);
  } else {
    console.log(`✅ Shane Miller records found: ${shaneAccounts?.length || 0}`);
    console.log('\nWorkspace variations:');
    const workspaces = [...new Set(shaneAccounts?.map(a => a.workspace_name) || [])];
    workspaces.forEach(ws => {
      const count = shaneAccounts?.filter(a => a.workspace_name === ws).length;
      console.log(`   - "${ws}": ${count} accounts`);
    });
  }

  // 3. Check for duplicate email addresses
  console.log('\n\n3️⃣  DUPLICATE EMAIL ADDRESSES');
  console.log('-'.repeat(70));

  const { data: allAccounts, error: allError } = await supabase
    .from('sender_emails_cache')
    .select('email_address, workspace_name, bison_instance');

  if (allError) {
    console.error('❌ Error fetching all accounts:', allError);
  } else {
    // Find duplicates
    const emailCounts = {};
    allAccounts.forEach(account => {
      if (!emailCounts[account.email_address]) {
        emailCounts[account.email_address] = [];
      }
      emailCounts[account.email_address].push({
        workspace: account.workspace_name,
        instance: account.bison_instance
      });
    });

    const duplicates = Object.entries(emailCounts).filter(([email, occurrences]) => occurrences.length > 1);

    console.log(`✅ Total unique emails: ${Object.keys(emailCounts).length}`);
    console.log(`⚠️  Duplicate emails: ${duplicates.length}`);

    if (duplicates.length > 0) {
      console.log('\nTop 10 duplicates:');
      duplicates.slice(0, 10).forEach(([email, occurrences]) => {
        console.log(`\n   📧 ${email} (appears ${occurrences.length} times):`);
        occurrences.forEach(occ => {
          console.log(`      - Workspace: ${occ.workspace}, Instance: ${occ.instance}`);
        });
      });
    }
  }

  // 4. Check workspace breakdown
  console.log('\n\n4️⃣  WORKSPACE BREAKDOWN');
  console.log('-'.repeat(70));

  if (allAccounts) {
    const workspaceCounts = {};
    allAccounts.forEach(account => {
      const key = `${account.workspace_name} (${account.bison_instance})`;
      workspaceCounts[key] = (workspaceCounts[key] || 0) + 1;
    });

    const sorted = Object.entries(workspaceCounts).sort((a, b) => b[1] - a[1]);

    console.log('Top 20 workspaces by account count:\n');
    sorted.slice(0, 20).forEach(([workspace, count], index) => {
      console.log(`   ${(index + 1).toString().padStart(2)}. ${workspace.padEnd(50)} : ${count} accounts`);
    });
  }

  // 5. Check for multiple bison instances
  console.log('\n\n5️⃣  MULTIPLE BISON INSTANCES CHECK');
  console.log('-'.repeat(70));

  if (allAccounts) {
    const workspaceInstances = {};
    allAccounts.forEach(account => {
      if (!workspaceInstances[account.workspace_name]) {
        workspaceInstances[account.workspace_name] = new Set();
      }
      workspaceInstances[account.workspace_name].add(account.bison_instance);
    });

    const multiInstance = Object.entries(workspaceInstances).filter(([ws, instances]) => instances.size > 1);

    if (multiInstance.length > 0) {
      console.log(`⚠️  ${multiInstance.length} workspaces appear in multiple instances:\n`);
      multiInstance.forEach(([workspace, instances]) => {
        console.log(`   - ${workspace}: [${Array.from(instances).join(', ')}]`);
      });
    } else {
      console.log('✅ No workspaces appear in multiple instances');
    }
  }

  // 6. Root cause analysis
  console.log('\n\n6️⃣  ROOT CAUSE ANALYSIS');
  console.log('='.repeat(70));

  if (duplicates && duplicates.length > 0) {
    console.log('\n❌ ISSUE FOUND: Duplicate email addresses in database');
    console.log(`   - ${duplicates.length} emails appear multiple times`);
    console.log(`   - This causes inflated account counts per workspace`);
    console.log(`   - Shane Miller likely has duplicate entries`);
    console.log('\n📋 LIKELY CAUSE:');
    console.log('   The unique constraint (email_address, workspace_name) allows');
    console.log('   the same email to appear multiple times if workspace_name differs');
    console.log('   OR if bison_instance differs (Maverick vs Long Run)');
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Diagnostic complete!');
  console.log('='.repeat(70) + '\n');
}

diagnoseAccountCounts().catch(console.error);
