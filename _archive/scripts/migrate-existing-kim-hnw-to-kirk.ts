import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const HIGH_NET_WORTH_THRESHOLD = 900000; // $900k+ homes
const TEXAS_AGENCIES = ['Kim Wallace', 'David Amiri', 'John Roberts', 'Jason Binyon'];

async function main() {
  console.log('=== Migrating Existing HNW Texas Contacts to Kirk Hodgson ===\n');
  console.log(`⚠️  This script MOVES (not copies) HNW contacts from Texas agencies to Kirk`);
  console.log(`Threshold: ≥$${HIGH_NET_WORTH_THRESHOLD.toLocaleString()}`);
  console.log(`Agencies: ${TEXAS_AGENCIES.join(', ')}\n`);

  // Get Kirk Hodgson workspace
  console.log('Step 1: Finding Kirk Hodgson workspace...');
  const { data: kirkWorkspace, error: kirkError } = await supabase
    .from('client_registry')
    .select('workspace_name, display_name')
    .ilike('display_name', '%Kirk%Hodg%')
    .single();

  if (kirkError || !kirkWorkspace) {
    console.error('❌ Could not find Kirk Hodgson workspace:', kirkError);
    return;
  }

  console.log(`✅ Found: ${kirkWorkspace.display_name} (${kirkWorkspace.workspace_name})\n`);

  let totalMoved = 0;
  const summary: Record<string, { raw: number; verified: number }> = {};

  // Process each Texas agency
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
      summary[agencyName] = { raw: 0, verified: 0 };
      continue;
    }

    console.log(`  Found workspace: ${agencyWorkspace.workspace_name}`);

    //
    // === MIGRATE RAW_CONTACTS ===
    //
    console.log(`\n  Processing raw_contacts...`);
    const { data: rawHNW, error: rawError } = await supabase
      .from('raw_contacts')
      .select('*')
      .eq('workspace_name', agencyWorkspace.workspace_name)
      .eq('property_state', 'TX')
      .gte('home_value_estimate', HIGH_NET_WORTH_THRESHOLD);

    if (rawError) {
      console.error(`  ❌ Error fetching raw contacts:`, rawError);
      summary[agencyName] = { raw: 0, verified: 0 };
      continue;
    }

    console.log(`    Found ${rawHNW?.length || 0} HNW Texas raw contacts`);

    let rawMoved = 0;
    if (rawHNW && rawHNW.length > 0) {
      // Check for duplicates in Kirk's pipeline
      const emails = rawHNW.map(c => c.email);
      const { data: existingKirk } = await supabase
        .from('raw_contacts')
        .select('email, month')
        .eq('workspace_name', kirkWorkspace.workspace_name)
        .in('email', emails);

      const existingSet = new Set(
        existingKirk?.map(c => `${c.email}-${c.month}`) || []
      );

      const newContacts = rawHNW.filter(
        c => !existingSet.has(`${c.email}-${c.month}`)
      );

      console.log(`    ${newContacts.length} new contacts to move`);

      if (newContacts.length > 0) {
        // 1. Insert into Kirk's raw_contacts
        const kirkContacts = newContacts.map(contact => {
          const { id, created_at, processed_at, ...contactData } = contact;
          return {
            ...contactData,
            workspace_name: kirkWorkspace.workspace_name,
            client_name: kirkWorkspace.display_name,
            uploaded_by: `migration_from_${agencyWorkspace.workspace_name}`,
          };
        });

        const { error: insertError } = await supabase
          .from('raw_contacts')
          .insert(kirkContacts);

        if (insertError) {
          console.error(`    ❌ Error inserting to Kirk:`, insertError);
        } else {
          // 2. Delete from original agency's raw_contacts
          const idsToDelete = newContacts.map(c => c.id);
          const { error: deleteError } = await supabase
            .from('raw_contacts')
            .delete()
            .in('id', idsToDelete);

          if (deleteError) {
            console.error(`    ❌ Error deleting from ${agencyName}:`, deleteError);
          } else {
            rawMoved = newContacts.length;
            console.log(`    ✅ Moved ${rawMoved} raw contacts to Kirk Hodgson`);
          }
        }
      }
    }

    //
    // === MIGRATE VERIFIED_CONTACTS ===
    //
    console.log(`\n  Processing verified_contacts...`);
    const { data: verifiedHNW, error: verifiedError } = await supabase
      .from('verified_contacts')
      .select('*')
      .eq('workspace_name', agencyWorkspace.workspace_name)
      .eq('property_state', 'TX')
      .gte('home_value_estimate', HIGH_NET_WORTH_THRESHOLD);

    if (verifiedError) {
      console.error(`  ❌ Error fetching verified contacts:`, verifiedError);
      summary[agencyName] = { raw: rawMoved, verified: 0 };
      continue;
    }

    console.log(`    Found ${verifiedHNW?.length || 0} HNW Texas verified contacts`);

    let verifiedMoved = 0;
    if (verifiedHNW && verifiedHNW.length > 0) {
      // Check for duplicates
      const emails = verifiedHNW.map(c => c.email);
      const { data: existingKirk } = await supabase
        .from('verified_contacts')
        .select('email, month')
        .eq('workspace_name', kirkWorkspace.workspace_name)
        .in('email', emails);

      const existingSet = new Set(
        existingKirk?.map(c => `${c.email}-${c.month}`) || []
      );

      const newContacts = verifiedHNW.filter(
        c => !existingSet.has(`${c.email}-${c.month}`)
      );

      console.log(`    ${newContacts.length} new contacts to move`);

      if (newContacts.length > 0) {
        // 1. Insert into Kirk's verified_contacts
        const kirkContacts = newContacts.map(contact => {
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
          .insert(kirkContacts);

        if (insertError) {
          console.error(`    ❌ Error inserting to Kirk:`, insertError);
        } else {
          // 2. Delete from original agency's verified_contacts
          const idsToDelete = newContacts.map(c => c.id);
          const { error: deleteError } = await supabase
            .from('verified_contacts')
            .delete()
            .in('id', idsToDelete);

          if (deleteError) {
            console.error(`    ❌ Error deleting from ${agencyName}:`, deleteError);
          } else {
            verifiedMoved = newContacts.length;
            console.log(`    ✅ Moved ${verifiedMoved} verified contacts to Kirk Hodgson`);
          }
        }
      }
    }

    summary[agencyName] = { raw: rawMoved, verified: verifiedMoved };
    totalMoved += rawMoved + verifiedMoved;
  }

  // Final Summary
  console.log('\n\n=== MIGRATION SUMMARY ===');
  console.log(`\nTotal contacts moved to Kirk Hodgson: ${totalMoved}\n`);

  console.log('Breakdown by agency:');
  Object.entries(summary).forEach(([agency, counts]) => {
    const total = counts.raw + counts.verified;
    if (total > 0) {
      console.log(`  ${agency}: ${total} total (${counts.raw} raw, ${counts.verified} verified)`);
    } else {
      console.log(`  ${agency}: No HNW Texas contacts found`);
    }
  });

  // Verify Kirk's final counts
  console.log('\n=== Kirk Hodgson Final Counts ===');
  const { data: kirkRaw } = await supabase
    .from('raw_contacts')
    .select('month')
    .eq('workspace_name', kirkWorkspace.workspace_name)
    .eq('property_state', 'TX')
    .gte('home_value_estimate', HIGH_NET_WORTH_THRESHOLD);

  const { data: kirkVerified } = await supabase
    .from('verified_contacts')
    .select('month')
    .eq('workspace_name', kirkWorkspace.workspace_name)
    .eq('property_state', 'TX')
    .gte('home_value_estimate', HIGH_NET_WORTH_THRESHOLD);

  console.log(`Raw HNW TX contacts: ${kirkRaw?.length || 0}`);
  console.log(`Verified HNW TX contacts: ${kirkVerified?.length || 0}`);

  console.log('\n✅ Migration complete!');
  console.log('📝 Note: Going forward, new uploads will automatically route HNW contacts to Kirk.');
}

main().catch(console.error);
