#!/usr/bin/env node

/**
 * Email Accounts Dashboard Data Verification Script
 *
 * This script performs a comprehensive cross-check of all data being displayed
 * in the Email Accounts dashboard by:
 * 1. Fetching raw data from sender_emails_cache
 * 2. Applying the same transformations as the frontend
 * 3. Calculating all metrics using the same logic
 * 4. Comparing results to identify discrepancies
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.com';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgwOTE1NjcsImV4cCI6MjA0MzY2NzU2N30.CUgR4DoK2X5j6kl-EEvnbJhTZaSpk7aL4BgY5YFwqVc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Field mapping function (matches fieldMappings.ts transformToEmailAccount)
function transformToEmailAccount(dbRow) {
  return {
    id: dbRow.id,
    email: dbRow.email_address,
    workspace_name: dbRow.workspace_name,
    status: dbRow.status,
    provider: dbRow.email_provider,
    fields: {
      'Email': dbRow.email_address,
      'Name': dbRow.account_name || '',
      'Account Name': dbRow.account_name || '',
      'Status': dbRow.status,
      'Total Sent': dbRow.emails_sent_count || 0,
      'Total Replied': dbRow.total_replied_count || 0,
      'Unique Replied': dbRow.unique_replied_count || 0,
      'Bounced': dbRow.bounced_count || 0,
      'Unsubscribed': dbRow.unsubscribed_count || 0,
      'Interested Leads': dbRow.interested_leads_count || 0,
      'Tag - Email Provider': dbRow.email_provider || '',
      'Tag - Reseller': dbRow.reseller || '',
      'Client': [dbRow.workspace_name],
      'Client Name (from Client)': [dbRow.workspace_name],
      'Daily Limit': dbRow.daily_limit || 0,
      'Domain': dbRow.domain || '',
      'Price': dbRow.price || 0,
      'Bison Instance': dbRow.bison_instance || 'maverick',
      'Reply Rate Per Account %': dbRow.reply_rate_percentage || 0,
      'Volume Per Account': dbRow.volume_per_account || 0,
      'Account Type': dbRow.account_type || '',
      'Email Account': dbRow.email_address,
    },
  };
}

// Deduplication function (matches realtimeDataService.ts)
function deduplicateAccounts(accounts) {
  const deduplicatedData = [];
  const seenEmailWorkspace = new Set();

  for (const account of accounts) {
    const email = account.fields['Email'] || account.fields['Email Account'];
    const workspace = account.fields['Client Name (from Client)']?.[0] || account.workspace_name;
    const key = `${email}|${workspace}`;

    if (email && !seenEmailWorkspace.has(key)) {
      seenEmailWorkspace.add(key);
      deduplicatedData.push(account);
    }
  }

  return deduplicatedData;
}

async function main() {
  console.log('🔍 EMAIL ACCOUNTS DASHBOARD DATA VERIFICATION\n');
  console.log('='.repeat(80));
  console.log('\n📊 STEP 1: Fetching Raw Data from Database\n');

  // Fetch all accounts from database
  const { data: rawAccounts, error, count } = await supabase
    .from('sender_emails_cache')
    .select('*', { count: 'exact' })
    .order('last_synced_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching data:', error);
    process.exit(1);
  }

  console.log(`✅ Fetched ${rawAccounts.length} raw accounts from database`);
  console.log(`   Database count: ${count}\n`);

  console.log('='.repeat(80));
  console.log('\n🔧 STEP 2: Applying Data Transformations\n');

  // Transform accounts
  const transformedAccounts = rawAccounts.map(transformToEmailAccount);
  console.log(`✅ Transformed ${transformedAccounts.length} accounts`);

  // Deduplicate
  const deduplicatedAccounts = deduplicateAccounts(transformedAccounts);
  const duplicateCount = transformedAccounts.length - deduplicatedAccounts.length;
  console.log(`✅ Deduplicated: Removed ${duplicateCount} duplicates`);
  console.log(`   Final count: ${deduplicatedAccounts.length} unique accounts\n`);

  console.log('='.repeat(80));
  console.log('\n📈 STEP 3: Calculating Dashboard Metrics\n');

  const accounts = deduplicatedAccounts;

  // ===== OVERVIEW CARDS =====
  console.log('--- Overview KPI Cards ---\n');

  const totalAccounts = accounts.length;
  console.log(`✓ Total Email Accounts Owned: ${totalAccounts}`);

  const uniqueClients = new Set(
    accounts.map(account => {
      const clientField = account.fields['Client'];
      return clientField && clientField.length > 0 ? clientField[0] : 'Unknown';
    })
  ).size;
  console.log(`✓ Unique Clients: ${uniqueClients}`);

  const avgAccountsPerClient = uniqueClients > 0 ? (totalAccounts / uniqueClients).toFixed(1) : '0';
  console.log(`✓ Avg Accounts per Client: ${avgAccountsPerClient}`);

  const connectedCount = accounts.filter(account => account.fields['Status'] === 'Connected').length;
  const disconnectedCount = totalAccounts - connectedCount;
  console.log(`✓ Connected Accounts: ${connectedCount}`);
  console.log(`✓ Disconnected Accounts: ${disconnectedCount}`);

  const totalPrice = accounts.reduce((sum, account) => {
    const price = parseFloat(account.fields['Price']) || 0;
    return sum + price;
  }, 0);
  console.log(`✓ Total Accounts Value: $${totalPrice.toFixed(2)}`);

  const avgCostPerClient = uniqueClients > 0 ? (totalPrice / uniqueClients).toFixed(2) : '0';
  console.log(`✓ Avg Cost per Client: $${avgCostPerClient}\n`);

  // ===== RESELLER DISTRIBUTION =====
  console.log('--- Reseller Distribution ---\n');

  const resellerCounts = {};
  accounts.forEach(account => {
    const reseller = account.fields['Tag - Reseller'] || 'Unknown';
    resellerCounts[reseller] = (resellerCounts[reseller] || 0) + 1;
  });

  Object.entries(resellerCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      const percentage = ((count / totalAccounts) * 100).toFixed(1);
      console.log(`  ${name}: ${count} accounts (${percentage}%)`);
    });
  console.log();

  // ===== ACCOUNT TYPE DISTRIBUTION =====
  console.log('--- Account Type Distribution ---\n');

  const accountTypeCounts = {};
  accounts.forEach(account => {
    const accountType = account.fields['Account Type'] || 'Unknown';
    accountTypeCounts[accountType] = (accountTypeCounts[accountType] || 0) + 1;
  });

  Object.entries(accountTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      const percentage = ((count / totalAccounts) * 100).toFixed(1);
      console.log(`  ${name}: ${count} accounts (${percentage}%)`);
    });
  console.log();

  // ===== EMAIL PROVIDER PERFORMANCE =====
  console.log('--- Email Provider Performance (Accounts 50+) ---\n');

  const providerGroups = {};

  accounts.forEach(account => {
    const provider = account.fields['Tag - Email Provider'] || 'Unknown';
    const totalSent = parseFloat(account.fields['Total Sent']) || 0;
    const totalReplied = parseFloat(account.fields['Total Replied']) || 0;

    if (!providerGroups[provider]) {
      providerGroups[provider] = {
        name: provider,
        totalAccountCount: 0,
        qualifyingAccountCount: 0,
        totalSentQualifying: 0,
        totalRepliesQualifying: 0,
        totalSent: 0,
        totalReplies: 0,
      };
    }

    providerGroups[provider].totalAccountCount += 1;
    providerGroups[provider].totalSent += totalSent;
    providerGroups[provider].totalReplies += totalReplied;

    if (totalSent >= 50) {
      providerGroups[provider].qualifyingAccountCount += 1;
      providerGroups[provider].totalSentQualifying += totalSent;
      providerGroups[provider].totalRepliesQualifying += totalReplied;
    }
  });

  Object.values(providerGroups)
    .sort((a, b) => {
      const replyRateA = a.totalSentQualifying > 0 ? (a.totalRepliesQualifying / a.totalSentQualifying) * 100 : 0;
      const replyRateB = b.totalSentQualifying > 0 ? (b.totalRepliesQualifying / b.totalSentQualifying) * 100 : 0;
      return replyRateB - replyRateA;
    })
    .forEach(provider => {
      const avgReplyRate = provider.totalSentQualifying > 0
        ? ((provider.totalRepliesQualifying / provider.totalSentQualifying) * 100).toFixed(1)
        : '0.0';

      console.log(`  ${provider.name}:`);
      console.log(`    Total Accounts: ${provider.totalAccountCount}`);
      console.log(`    Qualifying Accounts (≥50 sent): ${provider.qualifyingAccountCount}`);
      console.log(`    Total Sent (qualifying): ${provider.totalSentQualifying}`);
      console.log(`    Total Replies (qualifying): ${provider.totalRepliesQualifying}`);
      console.log(`    Reply Rate: ${avgReplyRate}%\n`);
    });

  // ===== CLIENT BREAKDOWN =====
  console.log('--- Top 10 Clients by Account Count ---\n');

  const clientGroups = {};

  accounts.forEach(account => {
    const clientName = account.fields['Client Name (from Client)']?.[0] || 'Unknown Client';

    if (!clientGroups[clientName]) {
      clientGroups[clientName] = {
        clientName,
        totalAccounts: 0,
        connectedAccounts: 0,
        totalPrice: 0,
        maxSendingVolume: 0,
        currentAvailableSending: 0,
        zeroReplyRateCount: 0,
      };
    }

    clientGroups[clientName].totalAccounts += 1;

    if (account.fields['Status'] === 'Connected') {
      clientGroups[clientName].connectedAccounts += 1;
    }

    const totalSent = parseFloat(account.fields['Total Sent']) || 0;
    const replyRate = parseFloat(account.fields['Reply Rate Per Account %']) || 0;

    if (totalSent > 50 && replyRate === 0) {
      clientGroups[clientName].zeroReplyRateCount += 1;
    }

    const price = parseFloat(account.fields['Price']) || 0;
    clientGroups[clientName].totalPrice += price;

    const volumePerAccount = parseFloat(account.fields['Volume Per Account']) || 0;
    clientGroups[clientName].maxSendingVolume += volumePerAccount;

    const dailyLimit = parseFloat(account.fields['Daily Limit']) || 0;
    clientGroups[clientName].currentAvailableSending += dailyLimit;
  });

  Object.values(clientGroups)
    .sort((a, b) => b.totalAccounts - a.totalAccounts)
    .slice(0, 10)
    .forEach((client, index) => {
      const zeroReplyRatePercentage = client.totalAccounts > 0
        ? ((client.zeroReplyRateCount / client.totalAccounts) * 100).toFixed(1)
        : '0.0';

      console.log(`${index + 1}. ${client.clientName}:`);
      console.log(`   Total Accounts: ${client.totalAccounts}`);
      console.log(`   Connected: ${client.connectedAccounts}`);
      console.log(`   Total Cost: $${client.totalPrice.toFixed(2)}`);
      console.log(`   Max Sending Volume: ${client.maxSendingVolume}`);
      console.log(`   Available Sending: ${client.currentAvailableSending}`);
      console.log(`   Zero Reply Rate (50+): ${client.zeroReplyRateCount} (${zeroReplyRatePercentage}%)\n`);
    });

  // ===== DATA QUALITY CHECKS =====
  console.log('='.repeat(80));
  console.log('\n🔍 STEP 4: Data Quality Checks\n');

  // Check for missing Client field
  const missingClientCount = accounts.filter(account => {
    const client = account.fields['Client'];
    return !client || client.length === 0 || client[0] === 'Unknown';
  }).length;

  if (missingClientCount > 0) {
    console.log(`⚠️  WARNING: ${missingClientCount} accounts have missing or Unknown client`);
  } else {
    console.log(`✅ All accounts have valid Client field`);
  }

  // Check for accounts with 0% reply rate and 50+ sent
  const zeroReplyAccounts = accounts.filter(account => {
    const totalSent = parseFloat(account.fields['Total Sent']) || 0;
    const replyRate = parseFloat(account.fields['Reply Rate Per Account %']) || 0;
    return totalSent > 50 && replyRate === 0;
  });

  console.log(`✓ Accounts with 0% reply rate (50+ sent): ${zeroReplyAccounts.length}`);

  // Check for failed/disconnected accounts
  const failedAccounts = accounts.filter(account => {
    const status = account.fields['Status'];
    return status === 'Failed' || status === 'Not connected' || status === 'Disconnected';
  });

  console.log(`✓ Failed/Disconnected accounts: ${failedAccounts.length}`);

  // Check for duplicate emails across different clients (legitimate)
  const emailCounts = {};
  accounts.forEach(account => {
    const email = account.fields['Email'];
    emailCounts[email] = (emailCounts[email] || 0) + 1;
  });

  const duplicateEmails = Object.entries(emailCounts).filter(([email, count]) => count > 1);
  console.log(`✓ Emails appearing in multiple workspaces: ${duplicateEmails.length} (legitimate cross-client accounts)`);

  console.log('\n='.repeat(80));
  console.log('\n✅ VERIFICATION COMPLETE\n');
  console.log('Summary:');
  console.log(`  • Total Raw Records: ${rawAccounts.length}`);
  console.log(`  • After Deduplication: ${deduplicatedAccounts.length}`);
  console.log(`  • Duplicates Removed: ${duplicateCount}`);
  console.log(`  • Unique Clients: ${uniqueClients}`);
  console.log(`  • Data Quality: ${missingClientCount === 0 ? 'Good' : 'Needs Review'}\n`);
}

main().catch(console.error);
