import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

// Super admin API key for Maverick instance
const MAVERICK_API_KEY = '82|rZqVRlP6Oyi9AoMLp4uGSjdc3fZsDbOAjqZQcI6hfc1675e2';
// You'll need to provide the Long Run API key as well
const LONG_RUN_API_KEY = '82|rZqVRlP6Oyi9AoMLp4uGSjdc3fZsDbOAjqZQcI6hfc1675e2'; // Update if different

const EMAIL_TO_INVITE = 'hucainmujtaba@gmail.com';
const ROLE = 'admin';

interface Workspace {
  workspace_name: string;
  bison_workspace_id: number;
  bison_instance: string;
}

async function inviteUserToWorkspace(
  workspace: Workspace,
  email: string,
  role: string
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = workspace.bison_instance === 'Maverick'
    ? 'https://send.maverickmarketingllc.com/api'
    : 'https://send.longrun.agency/api';

  const apiKey = workspace.bison_instance === 'Maverick'
    ? MAVERICK_API_KEY
    : LONG_RUN_API_KEY;

  try {
    // Step 1: Switch to the workspace context
    console.log(`\n[${workspace.workspace_name}] Switching to workspace ${workspace.bison_workspace_id}...`);
    const switchResponse = await fetch(`${baseUrl}/workspaces/v1.1/switch-workspace`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ team_id: workspace.bison_workspace_id }),
    });

    if (!switchResponse.ok) {
      const errorText = await switchResponse.text();
      console.error(`[${workspace.workspace_name}] Failed to switch workspace: ${switchResponse.status} ${errorText}`);
      return { success: false, error: `Failed to switch workspace: ${switchResponse.status}` };
    }

    console.log(`[${workspace.workspace_name}] Successfully switched to workspace`);

    // Step 2: Send invitation
    console.log(`[${workspace.workspace_name}] Sending invitation to ${email} with role ${role}...`);
    const inviteResponse = await fetch(`${baseUrl}/workspaces/v1.1/invite-members`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ email, role }),
    });

    if (!inviteResponse.ok) {
      const errorText = await inviteResponse.text();
      console.error(`[${workspace.workspace_name}] Failed to send invitation: ${inviteResponse.status} ${errorText}`);
      return { success: false, error: `Failed to send invitation: ${inviteResponse.status} - ${errorText}` };
    }

    const inviteData = await inviteResponse.json();
    console.log(`[${workspace.workspace_name}] ✅ Successfully sent invitation!`);
    console.log(`[${workspace.workspace_name}] Invitation ID: ${inviteData.data?.id}, UUID: ${inviteData.data?.uuid}`);

    return { success: true };
  } catch (error) {
    console.error(`[${workspace.workspace_name}] Error:`, error);
    return { success: false, error: String(error) };
  }
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('='.repeat(80));
  console.log('INVITING USER TO ALL WORKSPACES');
  console.log('='.repeat(80));
  console.log(`Email: ${EMAIL_TO_INVITE}`);
  console.log(`Role: ${ROLE}`);
  console.log('='.repeat(80));

  // Fetch all active workspaces
  const { data: workspaces, error } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_instance')
    .eq('is_active', true)
    .order('workspace_name');

  if (error) {
    console.error('Failed to fetch workspaces:', error);
    return;
  }

  if (!workspaces || workspaces.length === 0) {
    console.log('No active workspaces found');
    return;
  }

  console.log(`\nFound ${workspaces.length} active workspaces\n`);

  const results = {
    total: workspaces.length,
    successful: 0,
    failed: 0,
    errors: [] as { workspace: string; error: string }[],
  };

  // Invite user to each workspace
  for (const workspace of workspaces as Workspace[]) {
    const result = await inviteUserToWorkspace(workspace, EMAIL_TO_INVITE, ROLE);

    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
      results.errors.push({
        workspace: workspace.workspace_name,
        error: result.error || 'Unknown error',
      });
    }

    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total workspaces: ${results.total}`);
  console.log(`Successful invitations: ${results.successful}`);
  console.log(`Failed invitations: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('\nFailed Workspaces:');
    results.errors.forEach(({ workspace, error }) => {
      console.log(`  ❌ ${workspace}: ${error}`);
    });
  }

  console.log('='.repeat(80));
}

main();
