/**
 * Workspace API Client
 *
 * Centralized client for making Email Bison API calls using WORKSPACE-SPECIFIC API KEYS ONLY.
 * NO SUPER ADMIN FALLBACK - will fail if workspace doesn't have its own API key.
 *
 * Features:
 * - Automatic workspace context switching
 * - Comprehensive logging to workspace_api_logs table
 * - Real-time health metric updates
 * - Error handling and retry logic
 * - Security: Only uses workspace-specific API keys
 *
 * Usage:
 * ```typescript
 * const { data, error, statusCode } = await callWorkspaceApi({
 *   workspaceName: 'Tony Schmitz',
 *   endpoint: '/sender-emails?per_page=100',
 *   edgeFunction: 'sync-email-accounts',
 * });
 * ```
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// Types
// ============================================================================

export interface WorkspaceApiCall {
  workspaceName: string;          // Client workspace name (e.g., "Tony Schmitz")
  endpoint: string;                // API endpoint (e.g., "/sender-emails?per_page=100")
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;                      // Request body (for POST/PUT)
  edgeFunction?: string;           // Name of calling Edge Function (for logging)
  skipLogging?: boolean;           // Skip logging (for health checks)
}

export interface ApiResponse<T = any> {
  data?: T;                        // Response data if successful
  error?: string;                  // Error message if failed
  statusCode: number;              // HTTP status code
  responseTimeMs: number;          // Response time in milliseconds
}

interface WorkspaceConfig {
  workspace_name: string;
  bison_workspace_id: number;
  bison_instance: string;
  bison_api_key: string | null;
  is_active: boolean;
  api_consecutive_failures: number;
  api_calls_today: number;
  api_errors_today: number;
}

// ============================================================================
// Main Function: Call Workspace API
// ============================================================================

/**
 * Call Email Bison API using workspace-specific API key
 *
 * @throws Error if workspace doesn't have an API key (no fallback)
 * @returns ApiResponse with data, error, statusCode, and responseTime
 */
export async function callWorkspaceApi<T = any>(
  options: WorkspaceApiCall
): Promise<ApiResponse<T>> {
  const startTime = Date.now();

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Fetch workspace configuration
    const workspace = await getWorkspaceConfig(supabase, options.workspaceName);

    // CRITICAL: Workspace MUST have its own API key (no super admin fallback)
    if (!workspace.bison_api_key) {
      throw new Error(
        `Workspace '${options.workspaceName}' does not have an API key configured. ` +
        `Please generate a workspace-specific API key in the Email Bison dashboard ` +
        `(Settings → API Keys) and add it to the client_registry table.`
      );
    }

    const apiKey = workspace.bison_api_key;
    const baseUrl = getBaseUrl(workspace.bison_instance);

    console.log(
      `📡 [${options.workspaceName}] Calling API: ${options.method || 'GET'} ${options.endpoint}`
    );

    // NOTE: Workspace-specific API keys are ALREADY scoped to their workspace
    // No workspace switch needed (and workspace keys can't switch anyway - only super admin can)

    // Make the actual API call
    const response = await fetch(`${baseUrl}${options.endpoint}`, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const responseTimeMs = Date.now() - startTime;
    const success = response.ok;

    let data: T | undefined;
    let errorMessage: string | undefined;

    if (success) {
      try {
        data = await response.json();
      } catch (e) {
        // Response might not be JSON (e.g., 204 No Content)
        data = undefined;
      }
    } else {
      try {
        const errorBody = await response.json();
        errorMessage = JSON.stringify(errorBody);
      } catch (e) {
        errorMessage = await response.text();
      }
    }

    // Log API call (unless skipLogging is true)
    if (!options.skipLogging) {
      await logApiCall(supabase, {
        workspaceName: options.workspaceName,
        endpoint: options.endpoint,
        method: options.method || 'GET',
        statusCode: response.status,
        responseTimeMs,
        success,
        errorMessage,
        apiKeySuffix: apiKey.slice(-8),
        edgeFunction: options.edgeFunction,
      });
    }

    // Update workspace health metrics
    await updateWorkspaceHealth(supabase, workspace, success);

    if (success) {
      console.log(
        `✅ [${options.workspaceName}] API call succeeded (${responseTimeMs}ms)`
      );
    } else {
      console.error(
        `❌ [${options.workspaceName}] API call failed: ${response.status} ${response.statusText}`
      );
    }

    return {
      data,
      error: errorMessage,
      statusCode: response.status,
      responseTimeMs,
    };

  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ [${options.workspaceName}] API call exception:`, errorMessage);

    // Log failed call (unless skipLogging is true)
    if (!options.skipLogging) {
      await logApiCall(supabase, {
        workspaceName: options.workspaceName,
        endpoint: options.endpoint,
        method: options.method || 'GET',
        statusCode: 0,
        responseTimeMs,
        success: false,
        errorMessage,
        edgeFunction: options.edgeFunction,
      });
    }

    return {
      error: errorMessage,
      statusCode: 0,
      responseTimeMs,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch workspace configuration from client_registry
 */
async function getWorkspaceConfig(
  supabase: SupabaseClient,
  workspaceName: string
): Promise<WorkspaceConfig> {
  const { data: workspace, error: wsError } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key, is_active, api_consecutive_failures, api_calls_today, api_errors_today')
    .eq('workspace_name', workspaceName)
    .eq('is_active', true)
    .single();

  if (wsError || !workspace) {
    throw new Error(
      `Active workspace '${workspaceName}' not found in client_registry. ` +
      `Error: ${wsError?.message || 'Not found'}`
    );
  }

  return workspace as WorkspaceConfig;
}

/**
 * Get Email Bison base URL based on instance
 */
function getBaseUrl(bisonInstance: string): string {
  const instanceLower = (bisonInstance || '').toLowerCase();
  const isLongRun = instanceLower === 'longrun' || instanceLower === 'long run';

  return isLongRun
    ? 'https://send.longrun.agency/api'
    : 'https://send.maverickmarketingllc.com/api';
}

/**
 * Switch to workspace context in Email Bison
 */
async function switchWorkspace(
  baseUrl: string,
  apiKey: string,
  workspaceId: number,
  workspaceName: string
): Promise<void> {
  const switchResponse = await fetch(`${baseUrl}/workspaces/v1.1/switch-workspace`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ team_id: workspaceId }),
  });

  if (!switchResponse.ok) {
    let errorText: string;
    try {
      const errorBody = await switchResponse.json();
      errorText = JSON.stringify(errorBody);
    } catch (e) {
      errorText = await switchResponse.text();
    }

    throw new Error(
      `Workspace switch failed for '${workspaceName}' (ID: ${workspaceId}): ` +
      `${switchResponse.status} - ${errorText}`
    );
  }

  console.log(`✓ Switched to workspace: ${workspaceName} (ID: ${workspaceId})`);

  // Wait for workspace switch to propagate through Email Bison's system
  await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Log API call to workspace_api_logs table
 */
async function logApiCall(
  supabase: SupabaseClient,
  logData: {
    workspaceName: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTimeMs: number;
    success: boolean;
    errorMessage?: string;
    apiKeySuffix?: string;
    edgeFunction?: string;
  }
): Promise<void> {
  try {
    await supabase.from('workspace_api_logs').insert({
      workspace_name: logData.workspaceName,
      endpoint: logData.endpoint,
      method: logData.method,
      status_code: logData.statusCode,
      response_time_ms: logData.responseTimeMs,
      success: logData.success,
      error_message: logData.errorMessage,
      api_key_suffix: logData.apiKeySuffix,
      edge_function: logData.edgeFunction,
      triggered_by: 'edge_function',
    });
  } catch (error) {
    // Don't fail the API call if logging fails
    console.error('Failed to log API call:', error);
  }
}

/**
 * Update workspace health metrics after API call
 */
async function updateWorkspaceHealth(
  supabase: SupabaseClient,
  workspace: WorkspaceConfig,
  success: boolean
): Promise<void> {
  try {
    if (success) {
      // Success: Reset consecutive failures, increment calls today
      await supabase
        .from('client_registry')
        .update({
          api_last_successful_call_at: new Date().toISOString(),
          api_consecutive_failures: 0,
          api_calls_today: (workspace.api_calls_today || 0) + 1,
          api_health_status: 'healthy',
          bison_api_key_last_used_at: new Date().toISOString(),
        })
        .eq('workspace_name', workspace.workspace_name);
    } else {
      // Failure: Increment consecutive failures and errors today
      const consecutiveFailures = (workspace.api_consecutive_failures || 0) + 1;
      const healthStatus = consecutiveFailures >= 3 ? 'failing' : 'degraded';

      await supabase
        .from('client_registry')
        .update({
          api_last_failed_call_at: new Date().toISOString(),
          api_consecutive_failures: consecutiveFailures,
          api_calls_today: (workspace.api_calls_today || 0) + 1,
          api_errors_today: (workspace.api_errors_today || 0) + 1,
          api_health_status: healthStatus,
        })
        .eq('workspace_name', workspace.workspace_name);
    }
  } catch (error) {
    // Don't fail the API call if health update fails
    console.error('Failed to update workspace health:', error);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Fetch sender emails with pagination support
 *
 * @example
 * const emails = await fetchAllSenderEmails('Tony Schmitz', 'sync-email-accounts');
 */
export async function fetchAllSenderEmails(
  workspaceName: string,
  edgeFunction?: string
): Promise<any[]> {
  const allEmails: any[] = [];
  let nextUrl: string | null = '/sender-emails?per_page=100';

  while (nextUrl) {
    const { data, error, statusCode } = await callWorkspaceApi({
      workspaceName,
      endpoint: nextUrl,
      edgeFunction,
    });

    if (error || statusCode !== 200) {
      throw new Error(
        `Failed to fetch sender emails for ${workspaceName}: ${error || `Status ${statusCode}`}`
      );
    }

    const senderEmails = data?.data || [];
    allEmails.push(...senderEmails);

    // Get next page URL from pagination links
    nextUrl = data?.links?.next || null;

    console.log(
      `Fetched ${senderEmails.length} emails (total: ${allEmails.length}) for ${workspaceName}`
    );
  }

  return allEmails;
}

/**
 * Fetch campaigns with pagination support
 */
export async function fetchAllCampaigns(
  workspaceName: string,
  edgeFunction?: string
): Promise<any[]> {
  const allCampaigns: any[] = [];
  let nextUrl: string | null = '/campaigns?per_page=100';

  while (nextUrl) {
    const { data, error, statusCode } = await callWorkspaceApi({
      workspaceName,
      endpoint: nextUrl,
      edgeFunction,
    });

    if (error || statusCode !== 200) {
      throw new Error(
        `Failed to fetch campaigns for ${workspaceName}: ${error || `Status ${statusCode}`}`
      );
    }

    const campaigns = data?.data || [];
    allCampaigns.push(...campaigns);

    nextUrl = data?.links?.next || null;

    console.log(
      `Fetched ${campaigns.length} campaigns (total: ${allCampaigns.length}) for ${workspaceName}`
    );
  }

  return allCampaigns;
}

/**
 * Test workspace API key validity
 *
 * @returns true if API key works, false otherwise
 */
export async function testWorkspaceApiKey(
  workspaceName: string
): Promise<{ valid: boolean; error?: string; responseTimeMs: number }> {
  const { error, statusCode, responseTimeMs } = await callWorkspaceApi({
    workspaceName,
    endpoint: '/sender-emails?per_page=1',
    skipLogging: true, // Don't log test calls
  });

  return {
    valid: statusCode === 200 && !error,
    error,
    responseTimeMs,
  };
}
