import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkAccess() {
  const userId = '09322929-6078-4b08-bd55-e3e1ff773028';

  const { data, error } = await supabase
    .from('user_workspace_access')
    .select('*')
    .eq('user_id', userId);

  console.log('Tommy\'s workspace access entries:');
  console.log(JSON.stringify(data, null, 2));

  if (error) {
    console.error('Error:', error);
  }
}

checkAccess();
