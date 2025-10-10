/**
 * Sync Email Bison Workspaces to client_registry
 *
 * This script:
 * 1. Fetches all workspaces from Email Bison API
 * 2. Compares with existing client_registry records
 * 3. Inserts missing workspaces as inactive clients
 * 4. Updates bison_workspace_id for existing clients where missing
 *
 * Run with: tsx scripts/sync-bison-workspaces.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

// Maverick Email Bison instance
const MAVERICK_BISON_API_KEY = process.env.EMAIL_BISON_API_KEY || '77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d';
const MAVERICK_BISON_BASE_URL = 'https://send.maverickmarketingllc.com/api';

// Long Run Email Bison instance
const LONGRUN_BISON_API_KEY = process.env.LONG_RUN_BISON_API_KEY || '32|MiBV8URxMy8jnGZUq5SVBD5V0jaPbwKmtime9YXxca69e009';
const LONGRUN_BISON_BASE_URL = 'https://send.longrun.agency/api';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface BisonWorkspace {
  id: number;
  name: string;
  instance: 'Maverick' | 'Long Run';
}

interface BisonInstance {
  name: 'Maverick' | 'Long Run';
  baseUrl: string;
  apiKey: string;
}

async function fetchAllBisonWorkspaces(): Promise<BisonWorkspace[]> {
  console.log('📡 Fetching workspaces from all Email Bison instances...\n');

  const instances: BisonInstance[] = [
    {
      name: 'Maverick',
      baseUrl: MAVERICK_BISON_BASE_URL,
      apiKey: MAVERICK_BISON_API_KEY,
    },
    {
      name: 'Long Run',
      baseUrl: LONGRUN_BISON_BASE_URL,
      apiKey: LONGRUN_BISON_API_KEY,
    },
  ];

  const allWorkspaces: BisonWorkspace[] = [];

  for (const instance of instances) {
    console.log(`📡 Fetching from ${instance.name} Email Bison (${instance.baseUrl})...`);

    const response = await fetch(`${instance.baseUrl}/workspaces`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${instance.apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch ${instance.name} workspaces: ${response.status} ${response.statusText}`);
      continue;
    }

    const data = await response.json();
    const workspaces = data.data || [];

    console.log(`✅ Found ${workspaces.length} workspaces in ${instance.name}`);

    // Add instance metadata to each workspace
    workspaces.forEach((ws: any) => {
      allWorkspaces.push({
        id: ws.id,
        name: ws.name,
        instance: instance.name,
      });
    });
  }

  console.log(`\n✅ Total workspaces found: ${allWorkspaces.length}`);
  return allWorkspaces;
}

async function syncWorkspaces() {
  try {
    // Fetch all workspaces from Email Bison
    const bisonWorkspaces = await fetchAllBisonWorkspaces();

    // Fetch all existing clients from client_registry
    const { data: existingClients, error: fetchError } = await supabase
      .from('client_registry')
      .select('workspace_id, workspace_name, bison_workspace_id, bison_workspace_name');

    if (fetchError) {
      throw fetchError;
    }

    console.log(`📊 Current client_registry has ${existingClients?.length || 0} records`);

    // Create maps for easy lookup
    const existingByBisonId = new Map(
      (existingClients || [])
        .filter(c => c.bison_workspace_id)
        .map(c => [c.bison_workspace_id, c])
    );

    const existingByName = new Map(
      (existingClients || []).map(c => [c.workspace_name, c])
    );

    console.log('\n🔍 Analysis:');
    console.log(`  - ${existingByBisonId.size} clients have bison_workspace_id mapped`);
    console.log(`  - ${existingClients!.length - existingByBisonId.size} clients missing bison_workspace_id`);

    // Track changes
    const toInsert: any[] = [];
    const toUpdate: any[] = [];

    // Process each Bison workspace
    console.log('\n📋 Processing workspaces...\n');
    for (const bisonWs of bisonWorkspaces) {
      const existingById = existingByBisonId.get(bisonWs.id);
      const existingByNameMatch = existingByName.get(bisonWs.name);

      if (existingById) {
        // Already mapped correctly
        console.log(`✓ [${bisonWs.instance}] ${bisonWs.name} (ID: ${bisonWs.id}) - already mapped`);
      } else if (existingByNameMatch) {
        // Found by name match - update with bison_workspace_id
        console.log(`🔄 [${bisonWs.instance}] ${bisonWs.name} (ID: ${bisonWs.id}) - updating workspace ID mapping`);
        toUpdate.push({
          workspace_id: existingByNameMatch.workspace_id,
          bison_workspace_id: bisonWs.id,
          bison_workspace_name: bisonWs.name,
        });
      } else {
        // New workspace - insert as inactive
        console.log(`➕ [${bisonWs.instance}] ${bisonWs.name} (ID: ${bisonWs.id}) - NEW workspace, adding as inactive`);
        toInsert.push({
          workspace_id: bisonWs.id, // Use Bison ID as workspace_id
          workspace_name: bisonWs.name,
          display_name: bisonWs.name,
          bison_workspace_id: bisonWs.id,
          bison_workspace_name: bisonWs.name,
          is_active: false, // Start as inactive until configured
          billing_type: 'per_lead',
          price_per_lead: 0,
          retainer_amount: 0,
          monthly_kpi_target: 0,
        });
      }
    }

    // Apply updates
    console.log('\n📝 Applying changes...');

    if (toUpdate.length > 0) {
      console.log(`\n🔄 Updating ${toUpdate.length} existing clients with workspace IDs...`);
      for (const update of toUpdate) {
        const { error } = await supabase
          .from('client_registry')
          .update({
            bison_workspace_id: update.bison_workspace_id,
            bison_workspace_name: update.bison_workspace_name,
          })
          .eq('workspace_id', update.workspace_id);

        if (error) {
          console.error(`  ❌ Failed to update workspace_id ${update.workspace_id}:`, error.message);
        } else {
          console.log(`  ✅ Updated workspace_id ${update.workspace_id}`);
        }
      }
    }

    if (toInsert.length > 0) {
      console.log(`\n➕ Inserting ${toInsert.length} new workspaces...`);
      const { error: insertError } = await supabase
        .from('client_registry')
        .insert(toInsert);

      if (insertError) {
        console.error('  ❌ Insert failed:', insertError.message);
      } else {
        console.log(`  ✅ Inserted ${toInsert.length} new workspaces`);
      }
    }

    console.log('\n✅ Sync complete!');
    console.log('\n📋 Summary:');
    console.log(`  - ${toUpdate.length} workspaces updated with mapping`);
    console.log(`  - ${toInsert.length} new workspaces added (inactive)`);
    console.log(`  - ${bisonWorkspaces.length - toUpdate.length - toInsert.length} already synced`);

    if (toInsert.length > 0) {
      console.log('\n⚠️  Note: New workspaces added as INACTIVE.');
      console.log('   Configure targets and billing in Client Management, then activate.');
    }

  } catch (error: any) {
    console.error('❌ Sync failed:', error.message);
    throw error;
  }
}

// Run the sync
syncWorkspaces()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
