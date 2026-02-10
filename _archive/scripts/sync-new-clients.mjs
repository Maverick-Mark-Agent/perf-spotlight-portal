#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q';
const EMAIL_BISON_API_KEY = '77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function syncNewClients() {
  console.log('🔄 Syncing new Email Bison workspaces to client_registry...\n');

  // Fetch all Email Bison workspaces
  const bisonResponse = await fetch('https://send.maverickmarketingllc.com/api/workspaces/v1.1', {
    headers: {
      'Authorization': `Bearer ${EMAIL_BISON_API_KEY}`,
      'Accept': 'application/json',
    },
  });

  if (!bisonResponse.ok) {
    throw new Error(`Email Bison API error: ${bisonResponse.status}`);
  }

  const bisonData = await bisonResponse.json();
  const bisonWorkspaces = bisonData.data || [];

  console.log(`📊 Found ${bisonWorkspaces.length} workspaces in Email Bison`);

  // Fetch existing clients from registry
  const { data: existingClients, error: fetchError } = await supabase
    .from('client_registry')
    .select('workspace_name, workspace_id');

  if (fetchError) {
    throw new Error(`Error fetching registry: ${fetchError.message}`);
  }

  const existingWorkspaceNames = new Set(existingClients.map(c => c.workspace_name));
  const existingWorkspaceIds = new Set(existingClients.map(c => c.workspace_id));

  console.log(`📊 Found ${existingClients.length} clients in registry\n`);

  // Find new workspaces
  const newWorkspaces = bisonWorkspaces.filter(
    w => !existingWorkspaceNames.has(w.name) && !existingWorkspaceIds.has(w.id)
  );

  if (newWorkspaces.length === 0) {
    console.log('✅ No new workspaces to add. All Email Bison workspaces are already in the registry.');
    return;
  }

  console.log(`🆕 Found ${newWorkspaces.length} new workspaces to add:\n`);

  // Add new workspaces to registry
  let added = 0;
  for (const workspace of newWorkspaces) {
    console.log(`   Adding: ${workspace.name} (ID: ${workspace.id})`);

    const { error: insertError } = await supabase
      .from('client_registry')
      .insert({
        workspace_id: workspace.id,
        workspace_name: workspace.name,
        display_name: workspace.name, // Default to workspace name
        monthly_sending_target: 0, // Default to 0 - needs manual update
        is_active: true,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error(`   ❌ Error adding ${workspace.name}:`, insertError.message);
    } else {
      console.log(`   ✅ Added: ${workspace.name}`);
      added++;
    }
  }

  console.log(`\n📈 Summary:`);
  console.log(`   ✅ Added: ${added} new clients`);
  console.log(`   📊 Total in registry: ${existingClients.length + added}`);
  console.log(`\n⚠️  Note: New clients have monthly_sending_target = 0`);
  console.log(`   Update their targets in client_registry to include them in reports.`);
}

syncNewClients().catch(console.error);
