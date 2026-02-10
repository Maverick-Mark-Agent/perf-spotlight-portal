import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== Investigating Kim Wallace Contact Uploads ===\n');

  // Step 1: Get Kim Wallace's workspace
  const { data: kimWorkspace } = await supabase
    .from('client_registry')
    .select('workspace_name, display_name')
    .ilike('display_name', '%Kim Wallace%')
    .single();

  if (!kimWorkspace) {
    console.error('Could not find Kim Wallace workspace');
    return;
  }

  console.log(`Found: ${kimWorkspace.display_name} (${kimWorkspace.workspace_name})\n`);

  // Check raw_contacts
  console.log('Checking raw_contacts table...');
  const { data: rawContacts } = await supabase
    .from('raw_contacts')
    .select('month, property_state, home_value_estimate, count')
    .eq('workspace_name', kimWorkspace.workspace_name);

  if (rawContacts && rawContacts.length > 0) {
    console.log(`Found ${rawContacts.length} raw contacts`);

    // Group by month
    const byMonth = rawContacts.reduce((acc: any, contact: any) => {
      const month = contact.month || 'unknown';
      if (!acc[month]) {
        acc[month] = { total: 0, texas: 0, highNetWorth: 0 };
      }
      acc[month].total++;
      if (contact.property_state === 'TX') {
        acc[month].texas++;
        if ((contact.home_value_estimate || 0) >= 750000) {
          acc[month].highNetWorth++;
        }
      }
      return acc;
    }, {});

    console.log('\nBreakdown by month:');
    Object.entries(byMonth).forEach(([month, stats]: [string, any]) => {
      console.log(`  ${month}: ${stats.total} total, ${stats.texas} TX, ${stats.highNetWorth} HNW TX (≥$750k)`);
    });
  } else {
    console.log('No raw_contacts found for Kim Wallace');
  }

  // Check verified_contacts
  console.log('\n\nChecking verified_contacts table...');
  const { data: verifiedContacts } = await supabase
    .from('verified_contacts')
    .select('month, property_state, home_value_estimate')
    .eq('workspace_name', kimWorkspace.workspace_name);

  if (verifiedContacts && verifiedContacts.length > 0) {
    console.log(`Found ${verifiedContacts.length} verified contacts`);

    // Group by month
    const byMonth = verifiedContacts.reduce((acc: any, contact: any) => {
      const month = contact.month || 'unknown';
      if (!acc[month]) {
        acc[month] = { total: 0, texas: 0, highNetWorth: 0 };
      }
      acc[month].total++;
      if (contact.property_state === 'TX') {
        acc[month].texas++;
        if ((contact.home_value_estimate || 0) >= 750000) {
          acc[month].highNetWorth++;
        }
      }
      return acc;
    }, {});

    console.log('\nBreakdown by month:');
    Object.entries(byMonth).forEach(([month, stats]: [string, any]) => {
      console.log(`  ${month}: ${stats.total} total, ${stats.texas} TX, ${stats.highNetWorth} HNW TX (≥$750k)`);
    });
  } else {
    console.log('No verified_contacts found for Kim Wallace');
  }

  // Check all months available
  console.log('\n\nChecking all available months in the system...');
  const { data: allMonths } = await supabase
    .from('raw_contacts')
    .select('month')
    .order('month');

  if (allMonths) {
    const uniqueMonths = [...new Set(allMonths.map((m: any) => m.month))];
    console.log('Months with data:', uniqueMonths.join(', '));
  }

  // Check Kirk Hodgson
  console.log('\n\n=== Kirk Hodgson Comparison ===');
  const { data: kirkWorkspace } = await supabase
    .from('client_registry')
    .select('workspace_name, display_name')
    .ilike('display_name', '%Kirk%Hodg%')
    .single();

  if (kirkWorkspace) {
    console.log(`Found: ${kirkWorkspace.display_name} (${kirkWorkspace.workspace_name})\n`);

    const { data: kirkRaw } = await supabase
      .from('raw_contacts')
      .select('month, property_state, home_value_estimate')
      .eq('workspace_name', kirkWorkspace.workspace_name);

    const { data: kirkVerified } = await supabase
      .from('verified_contacts')
      .select('month, property_state, home_value_estimate')
      .eq('workspace_name', kirkWorkspace.workspace_name);

    console.log(`Kirk's raw contacts: ${kirkRaw?.length || 0}`);
    console.log(`Kirk's verified contacts: ${kirkVerified?.length || 0}`);

    if (kirkRaw && kirkRaw.length > 0) {
      const kirkMonths = [...new Set(kirkRaw.map((c: any) => c.month))];
      console.log(`Kirk's months: ${kirkMonths.join(', ')}`);
    }
  }
}

main().catch(console.error);
