#!/usr/bin/env node

/**
 * Enrich Sheet4 accounts with tags from Email Bison
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const COMPANY_TAGS = ['ScaledMail', 'CheapInboxes', 'Zapmail', 'Mailr'];
const PROVIDER_TAGS = ['Microsoft', 'Google', 'Outlook'];

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

async function main() {
  console.log('Creating Supabase client...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('Fetching ALL email accounts from sender_emails_cache...\n');

  // Get total count
  const { count: totalCount } = await supabase
    .from('sender_emails_cache')
    .select('*', { count: 'exact', head: true });

  console.log(`Found ${totalCount || 0} total accounts in cache`);

  // Fetch ALL accounts
  const { data: accounts, error } = await supabase
    .from('sender_emails_cache')
    .select('*')
    .order('last_synced_at', { ascending: false })
    .limit(totalCount || 50000);

  if (error) {
    console.error('Supabase error:', error);
    process.exit(1);
  }

  console.log(`Fetched ${accounts.length} accounts from Supabase\n`);

  // Create map of accounts by email
  const emailMap = new Map();
  accounts.forEach(account => {
    const email = account.email_address?.toLowerCase();
    if (email) {
      if (!emailMap.has(email)) {
        emailMap.set(email, []);
      }
      emailMap.get(email).push(account);
    }
  });

  // Read Sheet4 CSV
  const inputFile = '/Users/mac/Downloads/Burnt Accounts - Sheet4.csv';
  const content = fs.readFileSync(inputFile, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  console.log(`Processing ${lines.length - 1} accounts from Sheet4...\n`);

  const results = [];
  let foundCount = 0;
  let notFoundCount = 0;

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);

    if (fields.length >= 7) {
      const email = fields[0].trim().toLowerCase();
      const workspace = fields[1].trim();
      const status = fields[2].trim();
      const sent = fields[3].trim();
      const replies = fields[4].trim();
      const bounceRate = fields[5].trim();
      const replyRate = fields[6].trim();

      // Look up in Email Bison
      const accountInstances = emailMap.get(email);

      if (accountInstances && accountInstances.length > 0) {
        const account = accountInstances[0];
        const tags = account.tags || [];

        // Extract tag names
        const tagNames = tags.map(t => t.name || t);

        const companyTag = tagNames.find(tag =>
          COMPANY_TAGS.some(ct => tag.toLowerCase() === ct.toLowerCase())
        ) || 'N/A';

        const providerTag = tagNames.find(tag =>
          PROVIDER_TAGS.some(pt => tag.toLowerCase() === pt.toLowerCase())
        ) || 'N/A';

        const bisonWorkspace = account.workspace_name || 'N/A';
        const accountStatus = account.status || 'N/A';

        results.push({
          email,
          sheet4Workspace: workspace,
          bisonWorkspace,
          status,
          accountStatus,
          companyTag,
          providerTag,
          sent,
          replies,
          bounceRate,
          replyRate,
          allTags: tagNames.join('; ')
        });

        foundCount++;
      } else {
        results.push({
          email,
          sheet4Workspace: workspace,
          bisonWorkspace: 'NOT_FOUND',
          status,
          accountStatus: 'NOT_FOUND',
          companyTag: 'NOT_FOUND',
          providerTag: 'NOT_FOUND',
          sent,
          replies,
          bounceRate,
          replyRate,
          allTags: 'Email not found in Bison'
        });
        notFoundCount++;
      }
    }
  }

  // Generate CSV
  const outputFile = '/Users/mac/Downloads/sheet4-accounts-with-tags.csv';
  const csvLines = [
    'Email,Sheet4 Workspace,Bison Workspace,Sheet4 Status,Bison Account Status,Company Tag (Reseller),Provider Tag,Sent,Replies,Bounce Rate,Reply Rate,All Tags'
  ];

  results.forEach(result => {
    const line = `"${result.email}","${result.sheet4Workspace}","${result.bisonWorkspace}","${result.status}","${result.accountStatus}","${result.companyTag}","${result.providerTag}","${result.sent}","${result.replies}","${result.bounceRate}","${result.replyRate}","${result.allTags}"`;
    csvLines.push(line);
  });

  fs.writeFileSync(outputFile, csvLines.join('\n'));

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total accounts processed: ${results.length}`);
  console.log(`Found in Email Bison: ${foundCount}`);
  console.log(`Not found: ${notFoundCount}`);
  console.log(`Output file: ${outputFile}`);
  console.log('='.repeat(80));

  // Statistics
  const companyTagCounts = {};
  const providerTagCounts = {};
  const workspaceCounts = {};

  results.forEach(r => {
    if (r.companyTag !== 'NOT_FOUND' && r.companyTag !== 'N/A') {
      companyTagCounts[r.companyTag] = (companyTagCounts[r.companyTag] || 0) + 1;
    }
    if (r.providerTag !== 'NOT_FOUND' && r.providerTag !== 'N/A') {
      providerTagCounts[r.providerTag] = (providerTagCounts[r.providerTag] || 0) + 1;
    }
    if (r.bisonWorkspace !== 'NOT_FOUND' && r.bisonWorkspace !== 'N/A') {
      workspaceCounts[r.bisonWorkspace] = (workspaceCounts[r.bisonWorkspace] || 0) + 1;
    }
  });

  console.log('\nCompany Tags (Resellers):');
  Object.entries(companyTagCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, count]) => {
      console.log(`  ${tag}: ${count}`);
    });

  console.log('\nProvider Tags:');
  Object.entries(providerTagCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, count]) => {
      console.log(`  ${tag}: ${count}`);
    });

  console.log('\nTop 10 Workspaces:');
  Object.entries(workspaceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([workspace, count]) => {
      console.log(`  ${workspace}: ${count}`);
    });
}

main().catch(console.error);
