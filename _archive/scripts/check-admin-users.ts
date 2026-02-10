import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAdminUsers() {
  console.log('Checking admin users...\n');

  const { data, error } = await supabase
    .from('user_workspace_access')
    .select('user_id, workspace_name, role')
    .eq('role', 'admin');

  if (error) {
    console.error('Error fetching admin users:', error);
    return;
  }

  console.log(`Found ${data?.length || 0} admin access entries:\n`);

  for (const entry of data || []) {
    console.log(`User ID: ${entry.user_id}`);
    console.log(`Workspace: ${entry.workspace_name}`);
    console.log(`Role: ${entry.role}`);
    console.log('---');
  }
}

checkAdminUsers();
