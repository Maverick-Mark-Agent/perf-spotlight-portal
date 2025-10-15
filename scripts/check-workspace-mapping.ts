import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWorkspaceMapping() {
  console.log('=== Checking Workspace Mappings ===\n');

  // Check client_registry for both workspaces
  const { data: registryData, error: registryError } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key')
    .in('workspace_name', ['Workspark', 'Radiant Energy'])
    .order('workspace_name');

  if (registryError) {
    console.error('Error fetching client_registry:', registryError);
    return;
  }

  console.log('Client Registry Data:');
  registryData?.forEach(row => {
    console.log(`  ${row.workspace_name}:`);
    console.log(`    - Bison Workspace ID: ${row.bison_workspace_id}`);
    console.log(`    - Bison Instance: ${row.bison_instance}`);
    console.log(`    - Has Custom API Key: ${!!row.bison_api_key}`);
  });

  console.log('\n=== Checking Sender Email Cache ===\n');

  // Check sender_emails_cache for both workspaces
  const { data: cacheData, error: cacheError } = await supabase
    .from('sender_emails_cache')
    .select('workspace_name, bison_workspace_id, email_address, account_name')
    .in('workspace_name', ['Workspark', 'Radiant Energy']);

  if (cacheError) {
    console.error('Error fetching sender_emails_cache:', cacheError);
    return;
  }

  // Group by workspace_name
  const workspark = cacheData?.filter(a => a.workspace_name === 'Workspark') || [];
  const radiant = cacheData?.filter(a => a.workspace_name === 'Radiant Energy') || [];

  console.log(`Workspark (${workspark.length} accounts):`);
  console.log(`  Bison Workspace IDs: ${[...new Set(workspark.map(a => a.bison_workspace_id))].join(', ')}`);
  console.log(`  Account Names: ${[...new Set(workspark.map(a => a.account_name))].slice(0, 5).join(', ')}...`);
  console.log(`  Sample Emails: ${workspark.slice(0, 3).map(a => a.email_address).join(', ')}`);

  console.log(`\nRadiant Energy (${radiant.length} accounts):`);
  console.log(`  Bison Workspace IDs: ${[...new Set(radiant.map(a => a.bison_workspace_id))].join(', ')}`);
  console.log(`  Account Names: ${[...new Set(radiant.map(a => a.account_name))].slice(0, 5).join(', ')}...`);
  console.log(`  Sample Emails: ${radiant.slice(0, 3).map(a => a.email_address).join(', ')}`);

  // Check if there are any lesley.redman emails in the cache
  console.log('\n=== Searching for Workspark-specific emails ===\n');
  const { data: lesleyAccounts, error: lesleyError } = await supabase
    .from('sender_emails_cache')
    .select('workspace_name, email_address, account_name, bison_workspace_id')
    .ilike('email_address', '%lesley.redman%');

  if (lesleyError) {
    console.error('Error searching for lesley.redman:', lesleyError);
  } else if (lesleyAccounts && lesleyAccounts.length > 0) {
    console.log('Found lesley.redman accounts:');
    lesleyAccounts.forEach(acc => {
      console.log(`  ${acc.email_address} -> ${acc.workspace_name} (Bison ID: ${acc.bison_workspace_id})`);
    });
  } else {
    console.log('No lesley.redman accounts found in cache');
  }

  // Check for @empowerworkspark.com domain
  console.log('\n=== Searching for @empowerworkspark.com emails ===\n');
  const { data: empowerAccounts, error: empowerError } = await supabase
    .from('sender_emails_cache')
    .select('workspace_name, email_address, account_name, bison_workspace_id')
    .ilike('email_address', '%@empowerworkspark.com%');

  if (empowerError) {
    console.error('Error searching for empowerworkspark.com:', empowerError);
  } else if (empowerAccounts && empowerAccounts.length > 0) {
    console.log(`Found ${empowerAccounts.length} @empowerworkspark.com accounts:`);
    empowerAccounts.forEach(acc => {
      console.log(`  ${acc.email_address} -> ${acc.workspace_name} (Bison ID: ${acc.bison_workspace_id})`);
    });
  } else {
    console.log('No @empowerworkspark.com accounts found in cache');
  }
}

checkWorkspaceMapping().catch(console.error);
