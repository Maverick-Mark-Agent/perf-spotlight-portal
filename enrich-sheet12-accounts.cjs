#!/usr/bin/env node

/**
 * Enrich Sheet12 accounts with reseller and provider tags from Email Bison
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

  // Read Sheet12 CSV
  const csvPath = '/Users/mac/Downloads/Burnt Accounts - Sheet12.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.trim().split('\n');

  console.log(`Processing ${lines.length - 1} accounts from Sheet12...\n`);

  const results = [];
  const stats = {
    found: 0,
    notFound: 0,
    byReseller: {},
    byProvider: {},
    byWorkspace: {}
  };

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const fields = parseCSVLine(line);
    const email = fields[0]?.trim().toLowerCase();
    const workspace = fields[1]?.trim();
    const status = fields[2]?.trim();
    const sent = fields[3]?.trim();
    const replies = fields[4]?.trim();
    const bounceRate = fields[5]?.trim();
    const replyRate = fields[6]?.trim();

    if (!email) continue;

    // Look up in Email Bison
    const accountInstances = emailMap.get(email);

    let companyTag = 'N/A';
    let providerTag = 'N/A';
    let bisonWorkspace = 'N/A';
    let accountStatus = 'N/A';
    let allTags = 'N/A';

    if (accountInstances && accountInstances.length > 0) {
      stats.found++;
      const account = accountInstances[0];
      const tags = account.tags || [];
      const tagNames = tags.map(t => t.name || t);

      companyTag = tagNames.find(tag =>
        COMPANY_TAGS.some(ct => tag.toLowerCase() === ct.toLowerCase())
      ) || 'N/A';

      providerTag = tagNames.find(tag =>
        PROVIDER_TAGS.some(pt => tag.toLowerCase() === pt.toLowerCase())
      ) || 'N/A';

      bisonWorkspace = account.workspace_name || 'N/A';
      accountStatus = account.status || 'N/A';
      allTags = tagNames.join('; ');

      // Update stats
      stats.byReseller[companyTag] = (stats.byReseller[companyTag] || 0) + 1;
      stats.byProvider[providerTag] = (stats.byProvider[providerTag] || 0) + 1;
      stats.byWorkspace[workspace] = (stats.byWorkspace[workspace] || 0) + 1;
    } else {
      stats.notFound++;
    }

    results.push({
      email,
      workspace,
      bisonWorkspace,
      status,
      accountStatus,
      companyTag,
      providerTag,
      sent,
      replies,
      bounceRate,
      replyRate,
      allTags
    });
  }

  // Write output CSV
  const outputPath = '/Users/mac/Downloads/sheet12-accounts-with-tags.csv';
  const csvLines = [
    'Email,Workspace,Bison Workspace,Status,Bison Account Status,Company Tag (Reseller),Provider Tag,Sent,Replies,Bounce Rate,Reply Rate,All Tags'
  ];

  for (const row of results) {
    const line = [
      row.email,
      row.workspace,
      row.bisonWorkspace,
      row.status,
      row.accountStatus,
      row.companyTag,
      row.providerTag,
      row.sent,
      row.replies,
      row.bounceRate,
      row.replyRate,
      row.allTags
    ].join(',');
    csvLines.push(line);
  }

  fs.writeFileSync(outputPath, csvLines.join('\n'));

  console.log('\n================================================================================');
  console.log('SUMMARY');
  console.log('================================================================================');
  console.log(`Total accounts processed: ${results.length}`);
  console.log(`Found in Email Bison: ${stats.found}`);
  console.log(`Not found: ${stats.notFound}`);
  console.log(`Output file: ${outputPath}`);
  console.log('================================================================================\n');

  console.log('Company Tags (Resellers):');
  for (const [tag, count] of Object.entries(stats.byReseller).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tag}: ${count}`);
  }

  console.log('\nProvider Tags:');
  for (const [tag, count] of Object.entries(stats.byProvider).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tag}: ${count}`);
  }

  console.log('\nTop 10 Workspaces:');
  const sortedWorkspaces = Object.entries(stats.byWorkspace).sort((a, b) => b[1] - a[1]);
  sortedWorkspaces.slice(0, 10).forEach(([workspace, count]) => {
    console.log(`  ${workspace}: ${count}`);
  });
}

main().catch(console.error);