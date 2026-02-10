#!/usr/bin/env node

/**
 * Fetch email accounts from Long Run Bison instance with provider and reseller tags
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.com';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODA5MTU2NywiZXhwIjoyMDQzNjY3NTY3fQ.k-ant-api03-5h09QQR7HYaS9f7vfCjENfm6qJ0qjbGnK2FNwDR3DeVwBM_Q6rw3ne7CTp6h2OBQOfrg9IBD6xnthj6hsYbVJQ-Sum12QAA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Read emails from CSV
function readEmailsFromCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const emails = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const email = line.split(',')[0].replace(/"/g, '').trim();
    if (email && email.includes('@')) {
      emails.push(email);
    }
  }

  return emails;
}

async function main() {
  console.log('🔍 Fetching Email Accounts from Long Run Bison Instance\n');
  console.log('='.repeat(80));

  // Read emails from CSV
  const csvPath = 'Email Campaign Health Report - Sheet5.csv';
  const requestedEmails = readEmailsFromCSV(csvPath);

  console.log(`\n📧 Found ${requestedEmails.length} email addresses in CSV\n`);

  // First, check what Bison instances exist in the database
  console.log('📊 Checking available Bison instances...\n');

  const { data: instances, error: instError } = await supabase
    .from('sender_emails_cache')
    .select('bison_instance')
    .limit(1000);

  if (!instError && instances) {
    const uniqueInstances = [...new Set(instances.map(i => i.bison_instance))];
    console.log(`   Available instances: ${uniqueInstances.join(', ')}\n`);
  }

  // Query for all accounts matching the requested emails (any instance)
  console.log('📊 Querying database for all instances...\n');

  const { data: accounts, error } = await supabase
    .from('sender_emails_cache')
    .select('email_address, workspace_name, email_provider, reseller, account_type, status, daily_limit, emails_sent_count, total_replied_count, reply_rate_percentage, bison_instance')
    .in('email_address', requestedEmails);

  if (error) {
    console.error('❌ Error fetching data:', error);
    process.exit(1);
  }

  console.log(`✅ Found ${accounts.length} matching accounts in database\n`);

  // Group by Bison instance
  const byInstance = {
    'Maverick': [],
    'Long Run': [],
    'Other': []
  };

  accounts.forEach(account => {
    if (account.bison_instance === 'Maverick') {
      byInstance['Maverick'].push(account);
    } else if (account.bison_instance === 'Long Run') {
      byInstance['Long Run'].push(account);
    } else {
      byInstance['Other'].push(account);
    }
  });

  console.log('📊 Accounts by Bison Instance:');
  console.log(`   • Maverick: ${byInstance['Maverick'].length} accounts`);
  console.log(`   • Long Run: ${byInstance['Long Run'].length} accounts`);
  console.log(`   • Other: ${byInstance['Other'].length} accounts\n`);

  console.log('='.repeat(80));
  console.log('\n📋 RESULTS (All Instances):\n');

  // Create results array
  const results = [];
  const foundEmails = new Set();

  // Process all found accounts
  accounts.forEach(account => {
    foundEmails.add(account.email_address);
    results.push({
      'Email Account': account.email_address,
      'Bison Instance': account.bison_instance || 'Unknown',
      'Provider': account.email_provider || '',
      'Reseller': account.reseller || '',
      'Account Type': account.account_type || '',
      'Workspace': account.workspace_name || '',
      'Status': account.status || '',
      'Daily Limit': account.daily_limit || 0,
      'Total Sent': account.emails_sent_count || 0,
      'Total Replied': account.total_replied_count || 0,
      'Reply Rate %': account.reply_rate_percentage || 0,
    });
  });

  // Sort by Bison Instance, then by email
  results.sort((a, b) => {
    if (a['Bison Instance'] !== b['Bison Instance']) {
      return a['Bison Instance'].localeCompare(b['Bison Instance']);
    }
    return a['Email Account'].localeCompare(b['Email Account']);
  });

  // Display results
  results.forEach(result => {
    console.log(`Email: ${result['Email Account']}`);
    console.log(`  Bison Instance: ${result['Bison Instance']}`);
    console.log(`  Provider: ${result['Provider']}`);
    console.log(`  Reseller: ${result['Reseller']}`);
    console.log(`  Account Type: ${result['Account Type']}`);
    console.log(`  Workspace: ${result['Workspace']}`);
    console.log(`  Status: ${result['Status']}`);
    console.log(`  Daily Limit: ${result['Daily Limit']}`);
    console.log(`  Total Sent: ${result['Total Sent']}`);
    console.log(`  Total Replied: ${result['Total Replied']}`);
    console.log(`  Reply Rate: ${result['Reply Rate %']}%`);
    console.log();
  });

  // Find emails not in database
  const notFoundEmails = requestedEmails.filter(email => !foundEmails.has(email));

  if (notFoundEmails.length > 0) {
    console.log('='.repeat(80));
    console.log(`\n⚠️  ${notFoundEmails.length} emails NOT FOUND in database:\n`);
    notFoundEmails.slice(0, 20).forEach(email => {
      console.log(`  - ${email}`);
    });
    if (notFoundEmails.length > 20) {
      console.log(`  ... and ${notFoundEmails.length - 20} more`);
    }
    console.log();
  }

  // Create output CSV
  console.log('='.repeat(80));
  console.log('\n💾 Creating output CSVs...\n');

  const csvHeaders = ['Email Account', 'Bison Instance', 'Provider', 'Reseller', 'Account Type', 'Workspace', 'Status', 'Daily Limit', 'Total Sent', 'Total Replied', 'Reply Rate %'];

  // CSV 1: All accounts
  const allCsvRows = [csvHeaders.join(',')];
  results.forEach(result => {
    allCsvRows.push([
      `"${result['Email Account']}"`,
      `"${result['Bison Instance']}"`,
      `"${result['Provider']}"`,
      `"${result['Reseller']}"`,
      `"${result['Account Type']}"`,
      `"${result['Workspace']}"`,
      `"${result['Status']}"`,
      result['Daily Limit'],
      result['Total Sent'],
      result['Total Replied'],
      result['Reply Rate %']
    ].join(','));
  });

  // Add not found emails
  notFoundEmails.forEach(email => {
    allCsvRows.push([
      `"${email}"`,
      '"NOT FOUND"',
      '"NOT FOUND"',
      '"NOT FOUND"',
      '"NOT FOUND"',
      '"NOT FOUND"',
      '"NOT FOUND"',
      '0',
      '0',
      '0',
      '0'
    ].join(','));
  });

  const allOutputPath = 'email-accounts-all-instances.csv';
  fs.writeFileSync(allOutputPath, allCsvRows.join('\n'));
  console.log(`✅ All accounts saved to: ${allOutputPath}`);

  // CSV 2: Long Run only
  const longRunResults = results.filter(r => r['Bison Instance'] === 'Long Run');
  const longRunCsvRows = [csvHeaders.join(',')];
  longRunResults.forEach(result => {
    longRunCsvRows.push([
      `"${result['Email Account']}"`,
      `"${result['Bison Instance']}"`,
      `"${result['Provider']}"`,
      `"${result['Reseller']}"`,
      `"${result['Account Type']}"`,
      `"${result['Workspace']}"`,
      `"${result['Status']}"`,
      result['Daily Limit'],
      result['Total Sent'],
      result['Total Replied'],
      result['Reply Rate %']
    ].join(','));
  });

  const longRunOutputPath = 'email-accounts-longrun-only.csv';
  fs.writeFileSync(longRunOutputPath, longRunCsvRows.join('\n'));
  console.log(`✅ Long Run accounts saved to: ${longRunOutputPath}`);

  console.log(`\n📊 Summary:`);
  console.log(`  • Requested: ${requestedEmails.length} emails`);
  console.log(`  • Found in Maverick: ${byInstance['Maverick'].length} emails`);
  console.log(`  • Found in Long Run: ${byInstance['Long Run'].length} emails`);
  console.log(`  • Found in Other: ${byInstance['Other'].length} emails`);
  console.log(`  • Not Found: ${notFoundEmails.length} emails`);
  console.log();
}

main().catch(console.error);
