import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllDuplicates() {
  console.log('🔍 Checking for duplicate accounts across all clients...\n');

  // Get all accounts
  const { data: allAccounts, error } = await supabase
    .from('sender_emails_cache')
    .select('workspace_name, account_name, email_address, id');

  if (error) {
    console.error('❌ Error fetching accounts:', error);
    return;
  }

  console.log(`📊 Total rows in cache: ${allAccounts?.length || 0}\n`);

  // Group by workspace
  const workspaceGroups = new Map<string, any[]>();
  allAccounts?.forEach(acc => {
    const ws = acc.workspace_name || 'Unknown';
    if (!workspaceGroups.has(ws)) {
      workspaceGroups.set(ws, []);
    }
    workspaceGroups.get(ws)!.push(acc);
  });

  console.log(`📁 Found ${workspaceGroups.size} unique workspaces\n`);

  // Check each workspace for issues
  const problemWorkspaces: any[] = [];

  for (const [workspaceName, accounts] of workspaceGroups.entries()) {
    // Count unique by different fields
    const uniqueIds = new Set(accounts.map(a => a.id)).size;
    const uniqueEmails = new Set(accounts.map(a => a.email_address)).size;
    const uniqueAccountNames = new Set(accounts.map(a => a.account_name)).size;

    // Check for undefined emails
    const undefinedEmails = accounts.filter(a => !a.email_address || a.email_address === null);

    // Flag as problem if:
    // 1. All emails are null/undefined
    // 2. Very low unique account names compared to total rows
    const hasProblem = (
      undefinedEmails.length === accounts.length ||
      (uniqueAccountNames < 10 && accounts.length > 100)
    );

    if (hasProblem) {
      problemWorkspaces.push({
        workspace: workspaceName,
        totalRows: accounts.length,
        uniqueIds,
        uniqueEmails,
        uniqueAccountNames,
        undefinedEmails: undefinedEmails.length
      });
    }
  }

  if (problemWorkspaces.length === 0) {
    console.log('✅ No duplicate issues found!');
    return;
  }

  console.log(`⚠️  Found ${problemWorkspaces.length} workspaces with potential duplicate issues:\n`);

  problemWorkspaces.sort((a, b) => b.totalRows - a.totalRows);

  problemWorkspaces.forEach(ws => {
    console.log(`📛 ${ws.workspace}`);
    console.log(`   Total Rows: ${ws.totalRows}`);
    console.log(`   Unique IDs: ${ws.uniqueIds}`);
    console.log(`   Unique Emails: ${ws.uniqueEmails}`);
    console.log(`   Unique Account Names: ${ws.uniqueAccountNames}`);
    console.log(`   Undefined Emails: ${ws.undefinedEmails}`);

    if (ws.undefinedEmails === ws.totalRows) {
      console.log(`   🚨 ALL accounts missing email_address!`);
    }
    if (ws.uniqueAccountNames < 10 && ws.totalRows > 100) {
      console.log(`   🚨 Likely duplicates: ${ws.totalRows} rows but only ${ws.uniqueAccountNames} unique names!`);
    }
    console.log('');
  });

  // Calculate total duplicate rows
  const totalExpectedRows = problemWorkspaces.reduce((sum, ws) => sum + ws.uniqueAccountNames, 0);
  const totalActualRows = problemWorkspaces.reduce((sum, ws) => sum + ws.totalRows, 0);
  const totalDuplicates = totalActualRows - totalExpectedRows;

  console.log(`\n📊 Summary:`);
  console.log(`   Problem workspaces: ${problemWorkspaces.length}`);
  console.log(`   Total rows (with duplicates): ${totalActualRows}`);
  console.log(`   Expected rows (unique accounts): ${totalExpectedRows}`);
  console.log(`   Estimated duplicate rows: ${totalDuplicates}`);
}

checkAllDuplicates().catch(console.error);
