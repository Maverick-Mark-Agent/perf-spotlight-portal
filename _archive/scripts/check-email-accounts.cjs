const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODA5MTU2NywiZXhwIjoyMDQzNjY3NTY3fQ.k-ant-api03-5h09QQR7HYaS9f7vfCjENfm6qJ0qjbGnK2FNwDR3DeVwBM_Q6rw3ne7CTp6h2OBQOfrg9IBD6xnthj6hsYbVJQ-Sum12QAA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmailAccountsData() {
  console.log('🔍 Checking sender_emails_cache table...\n');

  // Get total count
  const { count: totalCount, error: countError } = await supabase
    .from('sender_emails_cache')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error getting count:', countError);
    return;
  }

  console.log('📊 Total records in sender_emails_cache:', totalCount);

  // Get sample data
  const { data: sampleData, error: sampleError } = await supabase
    .from('sender_emails_cache')
    .select('*')
    .limit(3);

  if (sampleError) {
    console.error('❌ Error getting sample:', sampleError);
    return;
  }

  console.log('\n📋 Sample records (first 3):');
  sampleData.forEach((record, i) => {
    console.log(`\n--- Record ${i+1} ---`);
    console.log('Email:', record.email_address);
    console.log('Workspace:', record.workspace_name);
    console.log('Status:', record.status);
    console.log('Bison Instance:', record.bison_instance_id);
  });

  // Check for duplicates
  const { data: allData, error: allError } = await supabase
    .from('sender_emails_cache')
    .select('email_address, workspace_name, bison_instance_id')
    .order('last_synced_at', { ascending: false })
    .limit(totalCount || 10000);

  if (allError) {
    console.error('❌ Error getting all data:', allError);
    return;
  }

  console.log('\n🔄 Analyzing duplicates...');

  // Count by email only (global duplicates)
  const emailCounts = {};
  allData.forEach(record => {
    const email = record.email_address;
    emailCounts[email] = (emailCounts[email] || 0) + 1;
  });

  const globalDuplicates = Object.entries(emailCounts).filter(([_, count]) => count > 1).length;

  // Count by email+workspace (per-workspace duplicates)
  const emailWorkspaceCounts = {};
  allData.forEach(record => {
    const key = `${record.email_address}|${record.workspace_name}`;
    emailWorkspaceCounts[key] = (emailWorkspaceCounts[key] || 0) + 1;
  });

  const perWorkspaceDuplicates = Object.entries(emailWorkspaceCounts).filter(([_, count]) => count > 1).length;

  console.log('Global duplicates (same email, any workspace):', globalDuplicates);
  console.log('Per-workspace duplicates (same email+workspace):', perWorkspaceDuplicates);

  // Count unique by workspace
  const workspaceCounts = {};
  const uniquePerWorkspace = {};

  allData.forEach(record => {
    const workspace = record.workspace_name;
    const key = `${record.email_address}|${workspace}`;

    if (!uniquePerWorkspace[workspace]) {
      uniquePerWorkspace[workspace] = new Set();
    }
    uniquePerWorkspace[workspace].add(key);
  });

  Object.entries(uniquePerWorkspace).forEach(([workspace, emails]) => {
    workspaceCounts[workspace] = emails.size;
  });

  console.log('\n📊 Top 10 clients by email account count (deduplicated per workspace):');
  Object.entries(workspaceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([workspace, count]) => {
      console.log(`  ${workspace}: ${count} accounts`);
    });

  const totalUniquePerWorkspace = Object.values(workspaceCounts).reduce((sum, count) => sum + count, 0);
  const totalClients = Object.keys(workspaceCounts).length;
  const avgPerClient = (totalUniquePerWorkspace / totalClients).toFixed(1);

  console.log('\n✅ Summary:');
  console.log('Total raw records:', totalCount);
  console.log('Total unique (email+workspace):', totalUniquePerWorkspace);
  console.log('Total clients:', totalClients);
  console.log('Average per client:', avgPerClient);
}

checkEmailAccountsData().catch(console.error);