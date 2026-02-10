import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkGreggZips() {
  console.log('Checking Gregg Blanchard ZIP assignments...\n');

  // Check client_zip_assignments table
  const { data: zipAssignments, error: zipError } = await supabase
    .from('client_zip_assignments')
    .select('*')
    .eq('client_name', 'Gregg Blanchard')
    .order('zip_code');

  if (zipError) {
    console.error('Error fetching ZIP assignments:', zipError);
  } else {
    console.log(`Found ${zipAssignments?.length || 0} ZIP assignments in client_zip_assignments`);
    if (zipAssignments && zipAssignments.length > 0) {
      console.log('Sample ZIPs:', zipAssignments.slice(0, 5).map(z => z.zip_code));
      console.log('First assignment:', JSON.stringify(zipAssignments[0], null, 2));
    }
  }

  // Check zip_placeholders table
  const { data: zipPlaceholders, error: placeholderError } = await supabase
    .from('zip_placeholders')
    .select('*')
    .eq('client_name', 'Gregg Blanchard')
    .order('zip_code');

  if (placeholderError) {
    console.error('Error fetching ZIP placeholders:', placeholderError);
  } else {
    console.log(`\nFound ${zipPlaceholders?.length || 0} ZIP placeholders`);
    if (zipPlaceholders && zipPlaceholders.length > 0) {
      console.log('Sample placeholder ZIPs:', zipPlaceholders.slice(0, 5).map(z => z.zip_code));
      console.log('First placeholder:', JSON.stringify(zipPlaceholders[0], null, 2));
    }
  }

  // Check if there are uncommitted ZIPs (no current_month set)
  const { data: uncommitted, error: uncommittedError } = await supabase
    .from('client_zip_assignments')
    .select('*')
    .eq('client_name', 'Gregg Blanchard')
    .is('current_month', null);

  if (uncommittedError) {
    console.error('Error fetching uncommitted ZIPs:', uncommittedError);
  } else {
    console.log(`\nUncommitted ZIPs (no current_month): ${uncommitted?.length || 0}`);
    if (uncommitted && uncommitted.length > 0) {
      console.log('Sample uncommitted:', uncommitted.slice(0, 3));
    }
  }

  // Check client info
  const { data: client, error: clientError } = await supabase
    .from('client_registry')
    .select('*')
    .eq('workspace_name', 'Gregg Blanchard')
    .single();

  if (clientError) {
    console.error('Error fetching client:', clientError);
  } else {
    console.log('\nClient info:', JSON.stringify(client, null, 2));
  }
}

checkGreggZips();
