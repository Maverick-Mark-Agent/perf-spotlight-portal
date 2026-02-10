const fs = require('fs');

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODA5MTU2NywiZXhwIjoyMDQzNjY3NTY3fQ.k-ant-api03-5h09QQR7HYaS9f7vfCjENfm6qJ0qjbGnK2FNwDR3DeVwBM_Q6rw3ne7CTp6h2OBQOfrg9IBD6xnthj6hsYbVJQ-Sum12QAA';

// Company tags to look for
const COMPANY_TAGS = ['ScaledMail', 'CheapInboxes', 'Zapmail', 'Mailr'];
// Provider tags to look for
const PROVIDER_TAGS = ['Microsoft', 'Google', 'Outlook'];

async function main() {
  console.log('Fetching email accounts from Supabase Edge Function...\n');

  const response = await fetch('https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/hybrid-email-accounts-v2', {
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    }
  });

  if (!response.ok) {
    console.error('Edge Function error:', response.status, response.statusText);
    const text = await response.text();
    console.error('Response:', text);
    process.exit(1);
  }

  const result = await response.json();
  const accounts = result.data || result;

  console.log(`Fetched ${accounts.length} email accounts\n`);

  // Read burned emails CSV
  const inputFile = '/Users/mac/Downloads/inbox-placement-tests-b108d2f9-4a41-41e9-b140-33f96380194a - Sheet1.csv';
  const content = fs.readFileSync(inputFile, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  const burnedEmails = [];
  for (const line of lines) {
    const fields = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    if (fields.length > 4) {
      let email = fields[4].replace(/^"|"$/g, '').trim().replace(/,+$/, '');
      if (email && email.includes('@')) {
        burnedEmails.push(email);
      }
    }
  }

  console.log(`Found ${burnedEmails.length} burned email addresses\n`);

  // Create map of accounts
  const emailMap = new Map();
  accounts.forEach(account => {
    const email = (account.fields?.['Email'] || account.fields?.['Email Account'] || account.email_address)?.toLowerCase();
    if (email) {
      if (!emailMap.has(email)) {
        emailMap.set(email, []);
      }
      emailMap.get(email).push(account);
    }
  });

  // Process burned emails
  console.log('Processing burned email accounts...\n');
  const results = [];
  let foundCount = 0;

  for (const email of burnedEmails) {
    const emailLower = email.toLowerCase().trim();
    const accountInstances = emailMap.get(emailLower);

    if (accountInstances && accountInstances.length > 0) {
      const account = accountInstances[0];
      const tags = account.fields?.['Tags'] || account.tags || [];

      const companyTag = tags.find(tag =>
        COMPANY_TAGS.some(ct => tag.toLowerCase() === ct.toLowerCase())
      ) || 'N/A';

      const providerTag = tags.find(tag =>
        PROVIDER_TAGS.some(pt => tag.toLowerCase() === ct.toLowerCase())
      ) || 'N/A';

      const workspace = account.fields?.['Client Name (from Client)']?.[0] || account.workspace_name || 'N/A';
      const status = account.fields?.['Status'] || account.status || 'N/A';

      results.push({
        email,
        companyTag,
        providerTag,
        workspace,
        status,
        allTags: tags.join('; ')
      });

      foundCount++;
      console.log(`✓ ${email}: Company=${companyTag}, Provider=${providerTag}, Workspace=${workspace}`);
    } else {
      results.push({
        email,
        companyTag: 'NOT_FOUND',
        providerTag: 'NOT_FOUND',
        workspace: 'NOT_FOUND',
        status: 'NOT_FOUND',
        allTags: 'Email not found'
      });
      console.log(`✗ ${email}: NOT FOUND`);
    }
  }

  // Generate CSV
  const outputFile = '/Users/mac/Downloads/perf-spotlight-portal/burned-accounts-with-tags.csv';
  const csvLines = ['Email,Company Tag,Provider Tag,Workspace,Status,All Tags'];

  for (const result of results) {
    const line = `"${result.email}","${result.companyTag}","${result.providerTag}","${result.workspace}","${result.status}","${result.allTags}"`;
    csvLines.push(line);
  }

  fs.writeFileSync(outputFile, csvLines.join('\n'));

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total burned emails: ${burnedEmails.length}`);
  console.log(`Found: ${foundCount}`);
  console.log(`Not found: ${burnedEmails.length - foundCount}`);
  console.log(`Output file: ${outputFile}`);
  console.log('='.repeat(80));

  // Statistics
  const companyTagCounts = {};
  const providerTagCounts = {};

  results.forEach(r => {
    if (r.companyTag !== 'NOT_FOUND' && r.companyTag !== 'N/A') {
      companyTagCounts[r.companyTag] = (companyTagCounts[r.companyTag] || 0) + 1;
    }
    if (r.providerTag !== 'NOT_FOUND' && r.providerTag !== 'N/A') {
      providerTagCounts[r.providerTag] = (providerTagCounts[r.providerTag] || 0) + 1;
    }
  });

  console.log('\nCompany Tags:');
  Object.entries(companyTagCounts).sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
    console.log(`  ${tag}: ${count}`);
  });

  console.log('\nProvider Tags:');
  Object.entries(providerTagCounts).sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
    console.log(`  ${tag}: ${count}`);
  });
}

main().catch(console.error);