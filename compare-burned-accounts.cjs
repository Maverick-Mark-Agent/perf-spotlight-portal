#!/usr/bin/env node

/**
 * Compare burned accounts from Sheet4 (100+ sent, 0 replies) with inbox placement test results
 */

const fs = require('fs');

/**
 * Parse CSV with quoted fields
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

// Read Sheet4 CSV (100+ emails sent, 0 replies)
const sheet4File = '/Users/mac/Downloads/Burnt Accounts - Sheet4.csv';
const sheet4Content = fs.readFileSync(sheet4File, 'utf-8');
const sheet4Lines = sheet4Content.split('\n').filter(line => line.trim());

console.log('Reading Sheet4 (100+ sent, 0 replies)...');
const sheet4Map = new Map();

// Skip header
for (let i = 1; i < sheet4Lines.length; i++) {
  const fields = parseCSVLine(sheet4Lines[i]);
  if (fields.length >= 7) {
    const email = fields[0].trim().toLowerCase();
    const workspace = fields[1].trim();
    const status = fields[2].trim();
    const sent = fields[3].trim();
    const replies = fields[4].trim();
    const bounceRate = fields[5].trim();
    const replyRate = fields[6].trim();

    sheet4Map.set(email, {
      email,
      workspace,
      status,
      sent,
      replies,
      bounceRate,
      replyRate
    });
  }
}

console.log(`Sheet4 accounts: ${sheet4Map.size}`);

// Read latest inbox placement test results
const inboxTestFile = '/Users/mac/Downloads/perf-spotlight-portal/burned-accounts-with-tags-latest.csv';
const inboxTestContent = fs.readFileSync(inboxTestFile, 'utf-8');
const inboxTestLines = inboxTestContent.split('\n').filter(line => line.trim());

console.log('Reading latest inbox placement test...');
const inboxTestMap = new Map();

// Skip header
for (let i = 1; i < inboxTestLines.length; i++) {
  const match = inboxTestLines[i].match(/"([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)"/);
  if (match) {
    const email = match[1].trim().toLowerCase();
    const companyTag = match[2].trim();
    const providerTag = match[3].trim();
    const workspace = match[4].trim();
    const accountStatus = match[5].trim();
    const allTags = match[6].trim();

    inboxTestMap.set(email, {
      email,
      companyTag,
      providerTag,
      workspace,
      accountStatus,
      allTags
    });
  }
}

console.log(`Inbox placement test accounts: ${inboxTestMap.size}`);

// Find accounts in both
const inBoth = [];
const onlyInInboxTest = [];

inboxTestMap.forEach((inboxData, email) => {
  if (sheet4Map.has(email)) {
    // Account exists in both
    const sheet4Data = sheet4Map.get(email);
    inBoth.push({
      email: inboxData.email,
      // From inbox test
      companyTag: inboxData.companyTag,
      providerTag: inboxData.providerTag,
      inboxTestWorkspace: inboxData.workspace,
      accountStatus: inboxData.accountStatus,
      allTags: inboxData.allTags,
      // From Sheet4
      sheet4Workspace: sheet4Data.workspace,
      sheet4Status: sheet4Data.status,
      sent: sheet4Data.sent,
      replies: sheet4Data.replies,
      bounceRate: sheet4Data.bounceRate,
      replyRate: sheet4Data.replyRate,
      // Match status
      matchStatus: 'IN_BOTH'
    });
  } else {
    // Only in inbox test
    onlyInInboxTest.push({
      email: inboxData.email,
      // From inbox test
      companyTag: inboxData.companyTag,
      providerTag: inboxData.providerTag,
      inboxTestWorkspace: inboxData.workspace,
      accountStatus: inboxData.accountStatus,
      allTags: inboxData.allTags,
      // From Sheet4
      sheet4Workspace: 'N/A',
      sheet4Status: 'N/A',
      sent: 'N/A',
      replies: 'N/A',
      bounceRate: 'N/A',
      replyRate: 'N/A',
      // Match status
      matchStatus: 'ONLY_IN_INBOX_TEST'
    });
  }
});

console.log(`\nAccounts in both: ${inBoth.length}`);
console.log(`Accounts only in inbox test: ${onlyInInboxTest.length}`);

// Combine results
const allResults = [...inBoth, ...onlyInInboxTest];

// Generate CSV
const outputFile = '/Users/mac/Downloads/burned-accounts-comparison.csv';
const csvLines = [
  'Email,Match Status,Company Tag,Provider Tag,Inbox Test Workspace,Account Status,All Tags,Sheet4 Workspace,Sheet4 Status,Sent,Replies,Bounce Rate,Reply Rate'
];

allResults.forEach(result => {
  const line = `"${result.email}","${result.matchStatus}","${result.companyTag}","${result.providerTag}","${result.inboxTestWorkspace}","${result.accountStatus}","${result.allTags}","${result.sheet4Workspace}","${result.sheet4Status}","${result.sent}","${result.replies}","${result.bounceRate}","${result.replyRate}"`;
  csvLines.push(line);
});

fs.writeFileSync(outputFile, csvLines.join('\n'));

console.log('\n' + '='.repeat(80));
console.log('COMPARISON SUMMARY');
console.log('='.repeat(80));
console.log(`Accounts in both CSVs: ${inBoth.length}`);
console.log(`Accounts only in inbox placement test: ${onlyInInboxTest.length}`);
console.log(`Total accounts in output: ${allResults.length}`);
console.log(`\nOutput file: ${outputFile}`);
console.log('='.repeat(80));

// Statistics
console.log('\n' + '='.repeat(80));
console.log('BREAKDOWN BY MATCH STATUS');
console.log('='.repeat(80));

const inBothByClient = {};
inBoth.forEach(r => {
  const client = r.inboxTestWorkspace;
  inBothByClient[client] = (inBothByClient[client] || 0) + 1;
});

console.log('\nAccounts appearing in BOTH (inbox test AND high-volume zero-reply):');
Object.entries(inBothByClient)
  .sort((a, b) => b[1] - a[1])
  .forEach(([client, count]) => {
    console.log(`  ${client}: ${count} accounts`);
  });

const onlyInboxByClient = {};
onlyInInboxTest.forEach(r => {
  const client = r.inboxTestWorkspace;
  onlyInboxByClient[client] = (onlyInboxByClient[client] || 0) + 1;
});

console.log('\nAccounts ONLY in inbox placement test (not yet showing in email metrics):');
Object.entries(onlyInboxByClient)
  .sort((a, b) => b[1] - a[1])
  .forEach(([client, count]) => {
    console.log(`  ${client}: ${count} accounts`);
  });

console.log('\n' + '='.repeat(80));
console.log('KEY INSIGHTS');
console.log('='.repeat(80));
console.log(`${inBoth.length} accounts are confirmed burned by BOTH methods:`);
console.log(`  - Failed inbox placement test`);
console.log(`  - Sent 100+ emails with 0 replies`);
console.log(`\n${onlyInInboxTest.length} accounts failed inbox test but haven't sent 100+ emails yet`);
console.log(`  - These are early warning signals`);
console.log(`  - May not yet show in email metrics`);