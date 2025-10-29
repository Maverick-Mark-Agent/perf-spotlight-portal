/**
 * Test All Workspace API Keys
 *
 * Tests each workspace's API key against Email Bison to identify invalid/expired keys
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Email Bison base URLs
const MAVERICK_BASE_URL = 'https://send.maverickmarketingllc.com/api';
const LONGRUN_BASE_URL = 'https://send.longrun.agency/api';

interface WorkspaceTestResult {
  workspace_name: string;
  workspace_id: number;
  bison_instance: string;
  has_api_key: boolean;
  api_key_status: string;
  test_result: 'success' | 'failed' | 'error' | 'skipped';
  error_message?: string;
  accounts_count?: number;
  response_time_ms?: number;
}

async function testWorkspaceApiKey(workspace: any): Promise<WorkspaceTestResult> {
  const result: WorkspaceTestResult = {
    workspace_name: workspace.workspace_name,
    workspace_id: workspace.bison_workspace_id,
    bison_instance: workspace.bison_instance,
    has_api_key: !!workspace.bison_api_key,
    api_key_status: workspace.bison_api_key_status || 'unknown',
    test_result: 'skipped',
  };

  if (!workspace.bison_api_key) {
    result.error_message = 'No API key configured';
    return result;
  }

  try {
    const baseUrl = workspace.bison_instance === 'Long Run' ? LONGRUN_BASE_URL : MAVERICK_BASE_URL;
    const startTime = Date.now();

    // Test API key by fetching sender emails for this workspace
    const response = await fetch(`${baseUrl}/sender-emails`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${workspace.bison_api_key}`,
        'Accept': 'application/json',
      },
    });

    const responseTime = Date.now() - startTime;
    result.response_time_ms = responseTime;

    if (response.ok) {
      const data = await response.json();
      result.test_result = 'success';
      result.accounts_count = data?.data?.length || 0;
    } else if (response.status === 401) {
      result.test_result = 'failed';
      result.error_message = 'API key is invalid or expired (401 Unauthorized)';
    } else if (response.status === 403) {
      result.test_result = 'failed';
      result.error_message = 'API key lacks permissions (403 Forbidden)';
    } else if (response.status === 429) {
      result.test_result = 'error';
      result.error_message = 'Rate limited (429 Too Many Requests)';
    } else {
      result.test_result = 'error';
      result.error_message = `HTTP ${response.status}: ${response.statusText}`;
    }
  } catch (error: any) {
    result.test_result = 'error';
    result.error_message = `Network error: ${error.message}`;
  }

  return result;
}

async function main() {
  console.log('🔑 Testing all workspace API keys...\n');

  // Fetch all active workspaces
  const { data: workspaces, error } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key, bison_api_key_status')
    .eq('is_active', true)
    .order('workspace_name');

  if (error) {
    console.error('❌ Error fetching workspaces:', error);
    return;
  }

  if (!workspaces || workspaces.length === 0) {
    console.log('No active workspaces found');
    return;
  }

  console.log(`Found ${workspaces.length} active workspaces to test\n`);
  console.log('='.repeat(110));
  console.log(`${'Workspace'.padEnd(30)} ${'ID'.padStart(6)} ${'Instance'.padEnd(12)} ${'Key'.padEnd(10)} ${'Result'.padEnd(40)}`);
  console.log('='.repeat(110));

  const results: WorkspaceTestResult[] = [];

  for (const workspace of workspaces) {
    const result = await testWorkspaceApiKey(workspace);
    results.push(result);

    const statusIcon = result.test_result === 'success' ? '✅' :
                      result.test_result === 'failed' ? '❌' :
                      result.test_result === 'error' ? '⚠️' : '⏭️';

    const resultText = result.test_result === 'success'
      ? `${result.accounts_count} accounts (${result.response_time_ms}ms)`
      : result.error_message || result.test_result;

    console.log(
      `${workspace.workspace_name.substring(0, 30).padEnd(30)} ` +
      `${workspace.bison_workspace_id.toString().padStart(6)} ` +
      `${workspace.bison_instance.padEnd(12)} ` +
      `${(result.has_api_key ? 'Yes' : 'No').padEnd(10)} ` +
      `${statusIcon} ${resultText.substring(0, 50)}`
    );

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('='.repeat(110));

  // Summary
  const successful = results.filter(r => r.test_result === 'success').length;
  const failed = results.filter(r => r.test_result === 'failed').length;
  const errors = results.filter(r => r.test_result === 'error').length;
  const skipped = results.filter(r => r.test_result === 'skipped').length;

  console.log('\n📊 Summary:');
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ❌ Failed (invalid key): ${failed}`);
  console.log(`   ⚠️  Errors (network/other): ${errors}`);
  console.log(`   ⏭️  Skipped (no API key): ${skipped}`);

  // List problem workspaces
  const problemWorkspaces = results.filter(r => r.test_result === 'failed' || r.test_result === 'error');
  if (problemWorkspaces.length > 0) {
    console.log('\n⚠️  Workspaces with API key issues:');
    problemWorkspaces.forEach(ws => {
      console.log(`   - ${ws.workspace_name}: ${ws.error_message}`);
    });

    console.log('\n💡 Recommendation:');
    console.log('   1. For invalid keys: Generate new API keys in Email Bison');
    console.log('   2. For network errors: Check Email Bison service status');
    console.log('   3. Update client_registry with valid API keys');
  } else {
    console.log('\n✅ All workspace API keys are valid!');
  }

  // Check Jason Binyon specifically
  const jasonBinyon = results.find(r => r.workspace_name === 'Jason Binyon');
  if (jasonBinyon) {
    console.log('\n🔍 Jason Binyon Status:');
    console.log(`   Test result: ${jasonBinyon.test_result}`);
    if (jasonBinyon.test_result === 'success') {
      console.log(`   ✅ API key is VALID - ${jasonBinyon.accounts_count} accounts accessible`);
      console.log(`   📝 If sync is still failing, the issue is elsewhere (not API key)`);
    } else {
      console.log(`   ❌ API key issue: ${jasonBinyon.error_message}`);
      console.log(`   📝 This explains why Jason Binyon hasn't synced in 18 days!`);
    }
  }
}

main().catch(console.error);
