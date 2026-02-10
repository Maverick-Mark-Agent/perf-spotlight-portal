import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://gjqbbgrfhijescaouqkx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0";

const MAVERICK_BASE_URL = 'https://send.maverickmarketingllc.com/api';
const LONGRUN_BASE_URL = 'https://send.longrun.agency/api';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface TestResult {
  workspace: string;
  instance: string;
  workspaceId: string | null;
  hasApiKey: boolean;
  apiKeyPreview: string;
  testResult: 'SUCCESS' | 'AUTH_FAILED' | 'NO_API_KEY' | 'ERROR';
  statusCode: number | null;
  accountCount: number;
  errorMessage: string | null;
  responseTime: number;
}

async function testApiKey(
  apiKey: string,
  baseUrl: string,
  workspaceName: string
): Promise<{ success: boolean; statusCode: number; accountCount: number; error: string | null; responseTime: number }> {
  const startTime = Date.now();

  try {
    console.log(`  🔑 Testing API key for ${workspaceName}...`);

    const response = await fetch(`${baseUrl}/sender-emails?per_page=10`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error');
      return {
        success: false,
        statusCode: response.status,
        accountCount: 0,
        error: `HTTP ${response.status}: ${errorText}`,
        responseTime
      };
    }

    const data = await response.json();
    const accountCount = data.data?.length || 0;

    return {
      success: true,
      statusCode: response.status,
      accountCount,
      error: null,
      responseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      success: false,
      statusCode: null,
      accountCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    };
  }
}

async function testAllWorkspaces() {
  console.log('🔍 Testing API Keys for All Workspaces\n');
  console.log('=' .repeat(80));

  // Fetch all active workspaces
  const { data: workspaces, error: workspacesError } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_instance, bison_workspace_id, bison_api_key, is_active')
    .eq('is_active', true)
    .order('workspace_name');

  if (workspacesError || !workspaces) {
    console.error('❌ Error fetching workspaces:', workspacesError);
    return;
  }

  console.log(`\n📊 Testing ${workspaces.length} active workspaces...\n`);

  const results: TestResult[] = [];
  let successCount = 0;
  let authFailedCount = 0;
  let noKeyCount = 0;
  let errorCount = 0;

  for (const workspace of workspaces) {
    const baseUrl = workspace.bison_instance === 'Long Run' ? LONGRUN_BASE_URL : MAVERICK_BASE_URL;

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📍 ${workspace.workspace_name} (${workspace.bison_instance})`);
    console.log(`   Workspace ID: ${workspace.bison_workspace_id || 'MISSING'}`);

    let result: TestResult;

    if (!workspace.bison_api_key) {
      console.log(`   ⚠️  NO API KEY - Will use global key + workspace switching`);
      result = {
        workspace: workspace.workspace_name,
        instance: workspace.bison_instance,
        workspaceId: workspace.bison_workspace_id,
        hasApiKey: false,
        apiKeyPreview: 'N/A',
        testResult: 'NO_API_KEY',
        statusCode: null,
        accountCount: 0,
        errorMessage: 'No workspace-specific API key configured',
        responseTime: 0
      };
      noKeyCount++;
    } else {
      const apiKeyPreview = workspace.bison_api_key.substring(0, 15) + '...';
      console.log(`   🔑 API Key: ${apiKeyPreview}`);

      const testResult = await testApiKey(workspace.bison_api_key, baseUrl, workspace.workspace_name);

      if (testResult.success) {
        console.log(`   ✅ SUCCESS - Found ${testResult.accountCount} accounts (${testResult.responseTime}ms)`);
        result = {
          workspace: workspace.workspace_name,
          instance: workspace.bison_instance,
          workspaceId: workspace.bison_workspace_id,
          hasApiKey: true,
          apiKeyPreview,
          testResult: 'SUCCESS',
          statusCode: testResult.statusCode,
          accountCount: testResult.accountCount,
          errorMessage: null,
          responseTime: testResult.responseTime
        };
        successCount++;
      } else if (testResult.statusCode === 401 || testResult.statusCode === 403) {
        console.log(`   ❌ AUTH FAILED - ${testResult.error}`);
        result = {
          workspace: workspace.workspace_name,
          instance: workspace.bison_instance,
          workspaceId: workspace.bison_workspace_id,
          hasApiKey: true,
          apiKeyPreview,
          testResult: 'AUTH_FAILED',
          statusCode: testResult.statusCode,
          accountCount: 0,
          errorMessage: testResult.error,
          responseTime: testResult.responseTime
        };
        authFailedCount++;
      } else {
        console.log(`   ❌ ERROR - ${testResult.error}`);
        result = {
          workspace: workspace.workspace_name,
          instance: workspace.bison_instance,
          workspaceId: workspace.bison_workspace_id,
          hasApiKey: true,
          apiKeyPreview,
          testResult: 'ERROR',
          statusCode: testResult.statusCode,
          accountCount: 0,
          errorMessage: testResult.error,
          responseTime: testResult.responseTime
        };
        errorCount++;
      }
    }

    results.push(result);

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Print Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nTotal Workspaces: ${workspaces.length}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Auth Failed: ${authFailedCount}`);
  console.log(`⚠️  No API Key: ${noKeyCount}`);
  console.log(`❌ Other Errors: ${errorCount}`);

  // Print Failed Workspaces
  if (authFailedCount > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log('❌ WORKSPACES WITH AUTHENTICATION FAILURES:');
    console.log('='.repeat(80));

    const failedWorkspaces = results.filter(r => r.testResult === 'AUTH_FAILED');
    failedWorkspaces.forEach(r => {
      console.log(`\n📍 ${r.workspace} (${r.instance})`);
      console.log(`   Workspace ID: ${r.workspaceId}`);
      console.log(`   API Key: ${r.apiKeyPreview}`);
      console.log(`   Status: ${r.statusCode}`);
      console.log(`   Error: ${r.errorMessage}`);
    });

    console.log(`\n💡 ACTION REQUIRED:`);
    console.log(`   These ${authFailedCount} workspaces have INVALID API keys.`);
    console.log(`   Options:`);
    console.log(`   1. Regenerate API keys in Email Bison dashboard`);
    console.log(`   2. Update client_registry with new keys`);
    console.log(`   3. Remove workspace-specific keys to use global key + workspace switching`);
  }

  // Print Workspaces Without Keys
  if (noKeyCount > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log('⚠️  WORKSPACES WITHOUT API KEYS (Will use global key):');
    console.log('='.repeat(80));

    const noKeyWorkspaces = results.filter(r => r.testResult === 'NO_API_KEY');
    noKeyWorkspaces.forEach(r => {
      console.log(`   - ${r.workspace} (${r.instance}) - Workspace ID: ${r.workspaceId || 'MISSING'}`);
    });
  }

  // Print Other Errors
  if (errorCount > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log('❌ WORKSPACES WITH OTHER ERRORS:');
    console.log('='.repeat(80));

    const errorWorkspaces = results.filter(r => r.testResult === 'ERROR');
    errorWorkspaces.forEach(r => {
      console.log(`\n📍 ${r.workspace} (${r.instance})`);
      console.log(`   Error: ${r.errorMessage}`);
    });
  }

  // Root Cause Analysis
  console.log(`\n${'='.repeat(80)}`);
  console.log('🎯 ROOT CAUSE ANALYSIS');
  console.log('='.repeat(80));

  if (authFailedCount > 0) {
    console.log(`\n✅ CONFIRMED: ${authFailedCount} workspaces have INVALID API keys`);
    console.log(`   This explains why ~${authFailedCount * 150} accounts are missing!`);
    console.log(`   (Assuming avg 150 accounts per workspace)`);
  } else if (successCount === workspaces.length - noKeyCount) {
    console.log(`\n✅ ALL API KEYS ARE VALID`);
    console.log(`   Root cause is NOT invalid API keys.`);
    console.log(`   Need to investigate polling job logic.`);
  }

  // Save results to file
  const resultsJson = JSON.stringify(results, null, 2);
  const fs = await import('fs');
  fs.writeFileSync('/tmp/api-key-test-results.json', resultsJson);
  console.log(`\n💾 Detailed results saved to: /tmp/api-key-test-results.json`);
}

testAllWorkspaces().catch(console.error);
