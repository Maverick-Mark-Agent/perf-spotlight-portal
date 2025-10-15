import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGregBlanchard() {
  console.log('\n=== Checking Greg Blanchard ===\n');

  // Check client_registry
  const { data: client, error: clientError } = await supabase
    .from('client_registry')
    .select('*')
    .eq('display_name', 'Greg Blanchard')
    .single();

  if (clientError) {
    console.error('Error fetching client:', clientError);
    return;
  }

  console.log('Client Registry:', {
    display_name: client.display_name,
    workspace_name: client.workspace_name,
    client_type: client.client_type,
    is_active: client.is_active,
  });

  // Check client_zipcodes
  const { data: zips, error: zipError } = await supabase
    .from('client_zipcodes')
    .select('*')
    .eq('workspace_name', client.workspace_name);

  console.log('\nZIP Entries:', zips?.length || 0);
  if (zips && zips.length > 0) {
    console.log('First few entries:', zips.slice(0, 3));
  } else {
    console.log('❌ No ZIP entries found!');
  }
}

checkGregBlanchard();
