// Find the correct workspace ID for Workspark by searching for lesley.redman@empowerworkspark.com

const LONG_RUN_API_KEY = '82|rZqVRlP6Oyi9AoMLp4uGSjdc3fZsDbOAjqZQcI6hfc1675e2';
const LONGRUN_BASE_URL = 'https://send.longrun.agency/api';

async function findWorksparkWorkspace() {
  console.log('=== Finding Correct Workspark Workspace ===\n');

  try {
    // First, get all workspaces
    console.log('1. Fetching all available workspaces...');
    const workspacesResponse = await fetch(`${LONGRUN_BASE_URL}/workspaces`, {
      headers: {
        'Authorization': `Bearer ${LONG_RUN_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    if (!workspacesResponse.ok) {
      const errorText = await workspacesResponse.text();
      console.error(`Failed to fetch workspaces: ${workspacesResponse.status} - ${errorText}`);
      return;
    }

    const workspacesData = await workspacesResponse.json();
    const workspaces = workspacesData.data || [];

    console.log(`Found ${workspaces.length} workspaces\n`);
    console.log('Available workspaces:');
    workspaces.forEach((ws: any) => {
      console.log(`  - ${ws.name} (ID: ${ws.id})`);
    });

    console.log('\n2. Searching each workspace for empowerworkspark.com emails...\n');

    // Check each workspace for empowerworkspark.com emails
    for (const workspace of workspaces) {
      console.log(`Checking workspace: ${workspace.name} (ID: ${workspace.id})...`);

      // Switch to this workspace
      const switchResponse = await fetch(`${LONGRUN_BASE_URL}/workspaces/v1.1/switch-workspace`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LONG_RUN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ team_id: workspace.id })
      });

      if (!switchResponse.ok) {
        console.log(`  ⚠️  Could not switch to workspace ${workspace.id}`);
        continue;
      }

      // Fetch sender emails
      const emailsResponse = await fetch(`${LONGRUN_BASE_URL}/sender-emails?per_page=100`, {
        headers: {
          'Authorization': `Bearer ${LONG_RUN_API_KEY}`,
          'Accept': 'application/json'
        }
      });

      if (!emailsResponse.ok) {
        console.log(`  ⚠️  Could not fetch emails from workspace ${workspace.id}`);
        continue;
      }

      const emailsData = await emailsResponse.json();
      const accounts = emailsData.data || [];

      // Check for empowerworkspark.com or lesley.redman
      const empowerEmails = accounts.filter((acc: any) =>
        acc.email?.includes('empowerworkspark.com') || acc.email?.includes('lesley.redman')
      );

      if (empowerEmails.length > 0) {
        console.log(`\n  ✅ FOUND WORKSPARK WORKSPACE!`);
        console.log(`  Workspace Name: ${workspace.name}`);
        console.log(`  Workspace ID: ${workspace.id}`);
        console.log(`  Total accounts in workspace: ${emailsData.total || accounts.length}`);
        console.log(`  Empowerworkspark emails found: ${empowerEmails.length}`);
        console.log('\n  Sample emails:');
        empowerEmails.slice(0, 5).forEach((acc: any) => {
          console.log(`    - ${acc.email} (${acc.name || 'no name'})`);
        });

        console.log(`\n=== ACTION REQUIRED ===`);
        console.log(`Update client_registry with correct workspace ID:`);
        console.log(`  Current: 14`);
        console.log(`  Correct: ${workspace.id}`);
        console.log(`\nSQL Command:`);
        console.log(`  UPDATE client_registry`);
        console.log(`  SET bison_workspace_id = ${workspace.id}`);
        console.log(`  WHERE workspace_name = 'Workspark';`);

        return workspace.id;
      } else {
        console.log(`  No empowerworkspark emails (${accounts.length} total accounts)`);
      }
    }

    console.log('\n❌ Could not find empowerworkspark.com emails in any workspace!');

  } catch (error) {
    console.error('Error:', error);
  }
}

findWorksparkWorkspace().catch(console.error);
