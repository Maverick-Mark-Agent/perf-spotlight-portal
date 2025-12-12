const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteBurnedAccounts() {
  console.log('Reading Zapmail burned accounts CSV...\n');

  // Read the CSV
  const csvPath = '/Users/mac/Downloads/Burnt Accounts - Zapmail.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.trim().split('\n');

  // Skip header
  const dataLines = lines.slice(1);

  const emailsToDelete = [];
  const accountsByWorkspace = {};

  // Parse CSV and organize by workspace
  for (const line of dataLines) {
    if (!line.trim()) continue;

    // Simple CSV parse (works since no commas in quoted fields in this CSV)
    const fields = line.split(',');
    const email = fields[0].trim().toLowerCase();
    const workspace = fields[1].trim();

    emailsToDelete.push(email);

    if (!accountsByWorkspace[workspace]) {
      accountsByWorkspace[workspace] = [];
    }
    accountsByWorkspace[workspace].push(email);
  }

  console.log(`Found ${emailsToDelete.length} accounts to delete across ${Object.keys(accountsByWorkspace).length} workspaces\n`);

  // Show breakdown by workspace
  console.log('Accounts to delete by workspace:');
  for (const [workspace, emails] of Object.entries(accountsByWorkspace)) {
    console.log(`  ${workspace}: ${emails.length} accounts`);
  }
  console.log();

  // First, verify these accounts exist in the database
  console.log('Verifying accounts in database...\n');
  const { data: existingAccounts, error: fetchError } = await supabase
    .from('sender_emails_cache')
    .select('email_address, workspace_name')
    .in('email_address', emailsToDelete);

  if (fetchError) {
    console.error('Error fetching accounts:', fetchError);
    return;
  }

  console.log(`Found ${existingAccounts.length} accounts in database (out of ${emailsToDelete.length})`);

  const existingEmails = new Set(existingAccounts.map(a => a.email_address.toLowerCase()));
  const notFound = emailsToDelete.filter(email => !existingEmails.has(email));

  if (notFound.length > 0) {
    console.log(`\n⚠️  ${notFound.length} accounts NOT found in database:`);
    notFound.slice(0, 10).forEach(email => console.log(`  - ${email}`));
    if (notFound.length > 10) {
      console.log(`  ... and ${notFound.length - 10} more`);
    }
  }

  // Delete accounts
  console.log('\n🗑️  Deleting accounts from Email Bison...\n');

  const { data: deletedData, error: deleteError } = await supabase
    .from('sender_emails_cache')
    .delete()
    .in('email_address', emailsToDelete)
    .select();

  if (deleteError) {
    console.error('❌ Error deleting accounts:', deleteError);
    return;
  }

  console.log(`✅ Successfully deleted ${deletedData.length} accounts\n`);

  // Show summary by workspace
  const deletedByWorkspace = {};
  for (const account of deletedData) {
    const workspace = account.workspace_name || 'Unknown';
    deletedByWorkspace[workspace] = (deletedByWorkspace[workspace] || 0) + 1;
  }

  console.log('================================================================================');
  console.log('DELETION SUMMARY');
  console.log('================================================================================');
  console.log(`Total accounts deleted: ${deletedData.length}`);
  console.log('\nDeleted by workspace:');
  for (const [workspace, count] of Object.entries(deletedByWorkspace).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${workspace}: ${count} accounts`);
  }
  console.log('================================================================================\n');
}

deleteBurnedAccounts().catch(console.error);