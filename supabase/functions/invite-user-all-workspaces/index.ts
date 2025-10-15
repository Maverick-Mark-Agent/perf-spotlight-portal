import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Workspace {
  workspace_name: string;
  bison_workspace_id: number;
  bison_instance: string;
}

async function inviteUserToWorkspace(
  workspace: Workspace,
  email: string,
  role: string,
  maverickApiKey: string,
  longRunApiKey: string
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = workspace.bison_instance === 'Maverick'
    ? 'https://send.maverickmarketingllc.com/api'
    : 'https://send.longrun.agency/api';

  const apiKey = workspace.bison_instance === 'Maverick'
    ? maverickApiKey
    : longRunApiKey;

  try {
    // Step 1: Switch to the workspace context
    console.log(`[${workspace.workspace_name}] Switching to workspace ${workspace.bison_workspace_id}...`);
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
      return { success: false, error: `Failed to switch workspace: ${switchResponse.status} - ${errorText}` };
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, role } = await req.json();

    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: 'Email and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('='.repeat(80));
    console.log('INVITING USER TO ALL WORKSPACES');
    console.log('='.repeat(80));
    console.log(`Email: ${email}`);
    console.log(`Role: ${role}`);
    console.log('='.repeat(80));

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const maverickApiKey = Deno.env.get('EMAIL_BISON_API_KEY')!;
    const longRunApiKey = Deno.env.get('LONG_RUN_BISON_API_KEY')!;

    if (!maverickApiKey || !longRunApiKey) {
      throw new Error('Super admin API keys not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all active workspaces
    const { data: workspaces, error } = await supabase
      .from('client_registry')
      .select('workspace_name, bison_workspace_id, bison_instance')
      .eq('is_active', true)
      .order('workspace_name');

    if (error) {
      throw new Error(`Failed to fetch workspaces: ${error.message}`);
    }

    if (!workspaces || workspaces.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active workspaces found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      const result = await inviteUserToWorkspace(
        workspace,
        email,
        role,
        maverickApiKey,
        longRunApiKey
      );

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

    return new Response(
      JSON.stringify(results),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
