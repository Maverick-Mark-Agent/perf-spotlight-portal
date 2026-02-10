#!/usr/bin/env node

/**
 * Fetch email accounts with their provider tags
 * Matches accounts from the provided CSV list
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.com';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODA5MTU2NywiZXhwIjoyMDQzNjY3NTY3fQ.k-ant-api03-5h09QQR7HYaS9f7vfCjENfm6qJ0qjbGnK2FNwDR3DeVwBM_Q6rw3ne7CTp6h2OBQOfrg9IBD6xnthj6hsYbVJQ-Sum12QAA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Read the CSV file and extract email addresses
function readEmailsFromCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const emails = [];

  // Skip header row, process data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Extract email from first column (may have quotes)
    const email = line.split(',')[0].replace(/"/g, '').trim();
    if (email && email.includes('@')) {
      emails.push(email);
    }
  }

  return emails;
}

async function main() {
  console.log('🔍 Fetching Email Accounts with Provider Tags\n');
  console.log('='.repeat(80));

  // Read emails from CSV
  const csvPath = 'Email Campaign Health Report - Sheet5.csv';
  const requestedEmails = readEmailsFromCSV(csvPath);

  console.log(`\n📧 Found ${requestedEmails.length} email addresses in CSV\n`);

  // Fetch all accounts from database
  console.log('📊 Querying database...\n');

  const { data: accounts, error } = await supabase
    .from('sender_emails_cache')
    .select('email_address, workspace_name, email_provider, reseller, account_type, status, daily_limit, emails_sent_count, total_replied_count, reply_rate_percentage')
    .in('email_address', requestedEmails);

  if (error) {
    console.error('❌ Error fetching data:', error);
    process.exit(1);
  }

  console.log(`✅ Found ${accounts.length} matching accounts in database\n`);
  console.log('='.repeat(80));
  console.log('\n📋 RESULTS:\n');

  // Create results array
  const results = [];
  const foundEmails = new Set();

  // Process found accounts
  accounts.forEach(account => {
    foundEmails.add(account.email_address);
    results.push({
      'Email Account': account.email_address,
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

  // Sort by email
  results.sort((a, b) => a['Email Account'].localeCompare(b['Email Account']));

  // Display results
  results.forEach(result => {
    console.log(`Email: ${result['Email Account']}`);
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
    notFoundEmails.forEach(email => {
      console.log(`  - ${email}`);
    });
    console.log();
  }

  // Create output CSV
  console.log('='.repeat(80));
  console.log('\n💾 Creating output CSV...\n');

  const csvHeaders = ['Email Account', 'Provider', 'Reseller', 'Account Type', 'Workspace', 'Status', 'Daily Limit', 'Total Sent', 'Total Replied', 'Reply Rate %'];
  const csvRows = [csvHeaders.join(',')];

  results.forEach(result => {
    csvRows.push([
      `"${result['Email Account']}"`,
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

  // Add not found emails to CSV
  notFoundEmails.forEach(email => {
    csvRows.push([
      `"${email}"`,
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

  const outputPath = 'email-accounts-with-tags.csv';
  fs.writeFileSync(outputPath, csvRows.join('\n'));

  console.log(`✅ Output saved to: ${outputPath}`);
  console.log(`\n📊 Summary:`);
  console.log(`  • Requested: ${requestedEmails.length} emails`);
  console.log(`  • Found: ${accounts.length} emails`);
  console.log(`  • Not Found: ${notFoundEmails.length} emails`);
  console.log();
}

main().catch(console.error);
