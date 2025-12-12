#!/usr/bin/env node

/**
 * Match email accounts with their provider and reseller tags
 * from the burned accounts CSV file
 */

const fs = require('fs');

// Read emails from the input CSV
function readEmailsFromCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const emails = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const email = line.split(',')[0].replace(/"/g, '').trim();
    if (email && email.includes('@')) {
      emails.push(email.toLowerCase());
    }
  }

  return emails;
}

// Read the burned accounts CSV
function readBurnedAccountsCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const accounts = {};

  // Parse CSV manually (handle quoted fields with commas)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Split by comma but respect quotes
    const fields = [];
    let currentField = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim());

    if (fields.length >= 5) {
      const email = fields[0].toLowerCase();
      const reseller = fields[1]; // Company Tag = Reseller
      const provider = fields[2]; // Provider Tag
      const workspace = fields[3];
      const status = fields[4];
      const allTags = fields[5] || '';

      accounts[email] = {
        email: fields[0],
        reseller,
        provider,
        workspace,
        status,
        allTags
      };
    }
  }

  return accounts;
}

async function main() {
  console.log('🔍 Matching Email Accounts with Provider & Reseller Tags\n');
  console.log('='.repeat(80));

  // Read requested emails
  const csvPath = 'Email Campaign Health Report - Sheet5.csv';
  const requestedEmails = readEmailsFromCSV(csvPath);
  console.log(`\n📧 Found ${requestedEmails.length} email addresses in input CSV\n`);

  // Read burned accounts data
  const burnedAccountsPath = 'burned-accounts-with-tags-latest.csv';
  const accounts = readBurnedAccountsCSV(burnedAccountsPath);
  console.log(`📊 Loaded ${Object.keys(accounts).length} accounts from database\n`);

  console.log('='.repeat(80));
  console.log('\n📋 MATCHING RESULTS:\n');

  const results = [];
  const foundEmails = new Set();
  const notFoundEmails = [];

  // Match requested emails
  requestedEmails.forEach(email => {
    const account = accounts[email];

    if (account) {
      foundEmails.add(email);
      results.push({
        'Email Account': account.email,
        'Provider': account.provider,
        'Reseller': account.reseller,
        'Workspace': account.workspace,
        'Status': account.status,
        'All Tags': account.allTags
      });

      console.log(`✅ ${account.email}`);
      console.log(`   Provider: ${account.provider}`);
      console.log(`   Reseller: ${account.reseller}`);
      console.log(`   Workspace: ${account.workspace}`);
      console.log(`   Status: ${account.status}`);
      console.log();
    } else {
      notFoundEmails.push(email);
    }
  });

  // Show not found emails
  if (notFoundEmails.length > 0) {
    console.log('='.repeat(80));
    console.log(`\n⚠️  ${notFoundEmails.length} emails NOT FOUND in database:\n`);
    notFoundEmails.forEach(email => {
      console.log(`  ❌ ${email}`);
    });
    console.log();
  }

  // Create output CSV
  console.log('='.repeat(80));
  console.log('\n💾 Creating output CSV...\n');

  const csvHeaders = ['Email Account', 'Provider', 'Reseller', 'Workspace', 'Status', 'All Tags'];
  const csvRows = [csvHeaders.join(',')];

  // Add found accounts
  results.forEach(result => {
    csvRows.push([
      `"${result['Email Account']}"`,
      `"${result['Provider']}"`,
      `"${result['Reseller']}"`,
      `"${result['Workspace']}"`,
      `"${result['Status']}"`,
      `"${result['All Tags']}"`
    ].join(','));
  });

  // Add not found emails
  notFoundEmails.forEach(email => {
    csvRows.push([
      `"${email}"`,
      '"NOT FOUND"',
      '"NOT FOUND"',
      '"NOT FOUND"',
      '"NOT FOUND"',
      '""'
    ].join(','));
  });

  const outputPath = 'email-accounts-with-provider-reseller-tags.csv';
  fs.writeFileSync(outputPath, csvRows.join('\n'));

  console.log(`✅ Output saved to: ${outputPath}`);
  console.log(`\n📊 Summary:`);
  console.log(`  • Requested: ${requestedEmails.length} emails`);
  console.log(`  • Found: ${results.length} emails`);
  console.log(`  • Not Found: ${notFoundEmails.length} emails`);
  console.log();
  console.log('='.repeat(80));
}

main().catch(console.error);
