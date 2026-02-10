import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkApiKeys() {
  const { data, error } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_api_key')
    .order('workspace_name');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('All workspaces in client_registry:');
  data?.forEach(row => {
    console.log(`  ${row.workspace_name}:`);
    console.log(`    - Workspace ID: ${row.bison_workspace_id}`);
    console.log(`    - Has API Key: ${!!row.bison_api_key}`);
    if (row.bison_api_key) {
      console.log(`    - API Key: ${row.bison_api_key.substring(0, 20)}...`);
    }
  });
}

checkApiKeys().catch(console.error);
