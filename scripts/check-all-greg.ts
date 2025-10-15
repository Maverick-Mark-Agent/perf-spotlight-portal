import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllGreg() {
  console.log('\n=== Searching for Greg Blanchard ===\n');

  // Check client_registry with partial match
  const { data: clients, error: clientError } = await supabase
    .from('client_registry')
    .select('*')
    .ilike('display_name', '%Greg%');

  if (clientError) {
    console.error('Error fetching clients:', clientError);
    return;
  }

  console.log(`Found ${clients?.length || 0} clients with "Greg" in name:\n`);
  clients?.forEach(c => {
    console.log({
      display_name: c.display_name,
      workspace_name: c.workspace_name,
      client_type: c.client_type,
      is_active: c.is_active,
    });
  });

  // Check if any have ZIP entries
  if (clients && clients.length > 0) {
    console.log('\n=== Checking ZIP entries ===\n');
    for (const client of clients) {
      const { data: zips } = await supabase
        .from('client_zipcodes')
        .select('count')
        .eq('workspace_name', client.workspace_name);

      console.log(`${client.display_name}: ${zips?.[0]?.count || 0} ZIP entries`);
    }
  }
}

checkAllGreg();
