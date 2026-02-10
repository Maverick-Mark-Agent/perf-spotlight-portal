import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const HIGH_NET_WORTH_THRESHOLD = 750000; // $750k+ homes
const TEXAS_AGENCIES = ['Kim Wallace', 'David Amiri', 'John Roberts', 'Jason Binyon'];

async function main() {
  console.log('=== Retroactive High Net Worth Texas Contact Filtering to Kirk Hodgson ===\n');
  console.log(`Agencies to process: ${TEXAS_AGENCIES.join(', ')}`);
  console.log(`HNW Threshold: $${HIGH_NET_WORTH_THRESHOLD.toLocaleString()}\n`);

  // Step 1: Get Kirk Hodgson's workspace
  console.log('Step 1: Finding Kirk Hodgson workspace...');
  const { data: kirkWorkspace, error: kirkWorkspaceError } = await supabase
    .from('client_registry')
    .select('workspace_name, display_name')
    .ilike('display_name', '%Kirk%Hodg%')
    .single();

  if (kirkWorkspaceError || !kirkWorkspace) {
    console.error('Could not find Kirk Hodgson workspace:', kirkWorkspaceError);
    return;
  }

  console.log(`Found: ${kirkWorkspace.display_name} (${kirkWorkspace.workspace_name})\n`);

  // Step 2: Process each Texas agency
  let totalContactsCopied = 0;
  const summaryByAgency: Record<string, { raw: number; verified: number }> = {};

  for (const agencyName of TEXAS_AGENCIES) {
    console.log(`\n=== Processing ${agencyName} ===`);

    // Get agency workspace
    const { data: agencyWorkspace } = await supabase
      .from('client_registry')
      .select('workspace_name, display_name')
      .ilike('display_name', `%${agencyName}%`)
      .single();

    if (!agencyWorkspace) {
      console.log(`  ⚠️  Workspace not found for ${agencyName}, skipping...`);
      continue;
    }

    console.log(`  Found workspace: ${agencyWorkspace.workspace_name}`);

    // Process RAW contacts
    console.log(`\n  Checking raw_contacts...`);
    const { data: rawContacts } = await supabase
      .from('raw_contacts')
      .select('*')
      .eq('workspace_name', agencyWorkspace.workspace_name)
      .eq('property_state', 'TX')
      .gte('home_value_estimate', HIGH_NET_WORTH_THRESHOLD);

    console.log(`    Found ${rawContacts?.length || 0} HNW Texas raw contacts`);

    let rawCopied = 0;
    if (rawContacts && rawContacts.length > 0) {
      // Check for existing contacts in Kirk's pipeline
      const rawEmails = rawContacts.map(c => c.email);
      const { data: existingKirkRaw } = await supabase
        .from('raw_contacts')
        .select('email, month')
        .eq('workspace_name', kirkWorkspace.workspace_name)
        .in('email', rawEmails);

      const existingSet = new Set(
        existingKirkRaw?.map(c => `${c.email}-${c.month}`) || []
      );

      const newRawContacts = rawContacts.filter(
        c => !existingSet.has(`${c.email}-${c.month}`)
      );

      console.log(`    ${newRawContacts.length} new contacts to copy`);

      if (newRawContacts.length > 0) {
        const contactsToInsert = newRawContacts.map(contact => {
          const { id, created_at, processed_at, ...contactData } = contact;
          return {
            ...contactData,
            workspace_name: kirkWorkspace.workspace_name,
            client_name: kirkWorkspace.display_name,
            is_high_net_worth: true,
            uploaded_by: `hnw_filter_from_${agencyWorkspace.workspace_name}`,
          };
        });

        const { error: insertError } = await supabase
          .from('raw_contacts')
          .insert(contactsToInsert);

        if (insertError) {
          console.error(`    ❌ Error inserting raw contacts:`, insertError);
        } else {
          rawCopied = newRawContacts.length;
          console.log(`    ✅ Copied ${rawCopied} raw contacts to Kirk Hodgson`);
        }
      }
    }

    // Process VERIFIED contacts
    console.log(`\n  Checking verified_contacts...`);
    const { data: verifiedContacts } = await supabase
      .from('verified_contacts')
      .select('*')
      .eq('workspace_name', agencyWorkspace.workspace_name)
      .eq('property_state', 'TX')
      .gte('home_value_estimate', HIGH_NET_WORTH_THRESHOLD);

    console.log(`    Found ${verifiedContacts?.length || 0} HNW Texas verified contacts`);

    let verifiedCopied = 0;
    if (verifiedContacts && verifiedContacts.length > 0) {
      // Check for existing contacts
      const verifiedEmails = verifiedContacts.map(c => c.email);
      const { data: existingKirkVerified } = await supabase
        .from('verified_contacts')
        .select('email, month')
        .eq('workspace_name', kirkWorkspace.workspace_name)
        .in('email', verifiedEmails);

      const existingSet = new Set(
        existingKirkVerified?.map(c => `${c.email}-${c.month}`) || []
      );

      const newVerifiedContacts = verifiedContacts.filter(
        c => !existingSet.has(`${c.email}-${c.month}`)
      );

      console.log(`    ${newVerifiedContacts.length} new contacts to copy`);

      if (newVerifiedContacts.length > 0) {
        const contactsToInsert = newVerifiedContacts.map(contact => {
          const { id, raw_contact_id, created_at, updated_at, ...contactData } = contact;
          return {
            ...contactData,
            workspace_name: kirkWorkspace.workspace_name,
            is_high_net_worth: true,
            target_campaign: 'HNW Evergreen',
          };
        });

        const { error: insertError } = await supabase
          .from('verified_contacts')
          .insert(contactsToInsert);

        if (insertError) {
          console.error(`    ❌ Error inserting verified contacts:`, insertError);
        } else {
          verifiedCopied = newVerifiedContacts.length;
          console.log(`    ✅ Copied ${verifiedCopied} verified contacts to Kirk Hodgson`);
        }
      }
    }

    summaryByAgency[agencyName] = {
      raw: rawCopied,
      verified: verifiedCopied,
    };

    totalContactsCopied += rawCopied + verifiedCopied;
  }

  // Final summary
  console.log('\n\n=== FINAL SUMMARY ===');
  console.log(`\nTotal contacts copied to Kirk Hodgson: ${totalContactsCopied}\n`);

  console.log('Breakdown by agency:');
  Object.entries(summaryByAgency).forEach(([agency, counts]) => {
    const total = counts.raw + counts.verified;
    if (total > 0) {
      console.log(`  ${agency}: ${total} total (${counts.raw} raw, ${counts.verified} verified)`);
    } else {
      console.log(`  ${agency}: No HNW Texas contacts found`);
    }
  });

  // Verify Kirk's final counts
  console.log('\n=== Kirk Hodgson Final Counts ===');
  const { data: kirkRawFinal } = await supabase
    .from('raw_contacts')
    .select('month, property_state, home_value_estimate')
    .eq('workspace_name', kirkWorkspace.workspace_name)
    .eq('property_state', 'TX')
    .gte('home_value_estimate', HIGH_NET_WORTH_THRESHOLD);

  const { data: kirkVerifiedFinal } = await supabase
    .from('verified_contacts')
    .select('month, property_state, home_value_estimate')
    .eq('workspace_name', kirkWorkspace.workspace_name)
    .eq('property_state', 'TX')
    .gte('home_value_estimate', HIGH_NET_WORTH_THRESHOLD);

  console.log(`Raw HNW TX contacts: ${kirkRawFinal?.length || 0}`);
  console.log(`Verified HNW TX contacts: ${kirkVerifiedFinal?.length || 0}`);

  if (kirkVerifiedFinal && kirkVerifiedFinal.length > 0) {
    const byMonth = kirkVerifiedFinal.reduce((acc: any, c: any) => {
      const month = c.month || 'unknown';
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});
    console.log('\nVerified contacts by month:');
    Object.entries(byMonth)
      .sort()
      .forEach(([month, count]) => {
        console.log(`  ${month}: ${count} contacts`);
      });
  }

  console.log('\n✅ Retroactive filtering complete!');
  console.log('📝 Note: Going forward, you should update the process-contact-upload function');
  console.log('   to automatically duplicate HNW Texas contacts to Kirk Hodgson at upload time.');
}

main().catch(console.error);
