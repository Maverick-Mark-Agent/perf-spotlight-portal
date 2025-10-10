/**
 * Sync Email Accounts Edge Function
 *
 * Fetches email accounts from Email Bison API and syncs to email_accounts_raw table
 * Called per workspace for incremental updates
 *
 * Usage:
 *   POST /functions/v1/sync-email-accounts
 *   Body: { "workspace_name": "John Roberts" } // Optional - syncs all if omitted
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncResult {
  workspace_name: string;
  accounts_synced: number;
  status: 'success' | 'error';
  error?: string;
  duration_ms: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();

    // Get request body
    const body = await req.json().catch(() => ({}));
    const targetWorkspace = body.workspace_name;

    console.log(`Starting email account sync${targetWorkspace ? ` for ${targetWorkspace}` : ' for all workspaces'}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get API keys and instances from environment
    const maverickApiKey = Deno.env.get('MAVERICK_BISON_API_KEY');
    const longRunApiKey = Deno.env.get('LONG_RUN_BISON_API_KEY');

    if (!maverickApiKey || !longRunApiKey) {
      throw new Error('Missing Email Bison API keys in environment');
    }

    // Fetch active workspaces from client_registry
    let query = supabase
      .from('client_registry')
      .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key')
      .eq('is_active', true);

    if (targetWorkspace) {
      query = query.eq('workspace_name', targetWorkspace);
    }

    const { data: workspaces, error: workspacesError } = await query;

    if (workspacesError) {
      throw new Error(`Failed to fetch workspaces: ${workspacesError.message}`);
    }

    if (!workspaces || workspaces.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: targetWorkspace
            ? `Workspace '${targetWorkspace}' not found or inactive`
            : 'No active workspaces found'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log(`Found ${workspaces.length} workspace(s) to sync`);

    const results: SyncResult[] = [];

    // Sync each workspace
    for (const workspace of workspaces) {
      const wsStartTime = Date.now();

      try {
        console.log(`Syncing workspace: ${workspace.workspace_name} (ID: ${workspace.bison_workspace_id}, Instance: ${workspace.bison_instance})`);

        // Normalize instance name (case-insensitive comparison)
        const instanceLower = (workspace.bison_instance || '').toLowerCase();
        const isLongRun = instanceLower === 'longrun' || instanceLower === 'long run';

        const baseUrl = isLongRun
          ? 'https://send.longrun.agency/api'
          : 'https://send.maverickmarketingllc.com/api';

        // Use workspace-specific API key (no super admin fallback - no workspace switch needed)
        const apiKey = workspace.bison_api_key || (isLongRun ? longRunApiKey : maverickApiKey);

        if (!workspace.bison_api_key) {
          console.log(`⚠️  WARNING: Using ${isLongRun ? 'Long Run' : 'Maverick'} super admin key for ${workspace.workspace_name} (no workspace key configured)`);
        } else {
          console.log(`✅ Using workspace-specific API key for ${workspace.workspace_name}`);
        }

        // NOTE: Workspace-specific API keys are ALREADY scoped to their workspace
        // No workspace switch needed (and workspace keys can't switch anyway - only super admin can)

        // Fetch sender emails with pagination
        let accountsSynced = 0;
        let nextUrl = `${baseUrl}/sender-emails?per_page=100`;

        while (nextUrl) {
          const response = await fetch(nextUrl, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          });

          if (!response.ok) {
            throw new Error(`Email Bison API error: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          const senderEmails = data.data || [];

          console.log(`Fetched ${senderEmails.length} accounts from ${workspace.workspace_name}`);

          // Calculate pricing for each account
          const accountsWithPricing = senderEmails.map((email: any) => {
            const domain = email.email.split('@')[1] || '';
            const reseller = extractReseller(email.tags);
            const provider = extractProvider(email.tags, reseller);
            const price = calculatePrice(provider, reseller);
            const replyRate = email.emails_sent_count > 0
              ? (email.unique_replied_count / email.emails_sent_count) * 100
              : 0;

            return {
              bison_account_id: email.id,
              email_address: email.email,
              workspace_name: workspace.workspace_name,
              workspace_id: workspace.bison_workspace_id,
              bison_instance: isLongRun ? 'longrun' : 'maverick', // Normalize to lowercase for DB constraint
              status: email.status,
              account_type: email.type,
              emails_sent_count: email.emails_sent_count || 0,
              total_replied_count: email.total_replied_count || 0,
              unique_replied_count: email.unique_replied_count || 0,
              bounced_count: email.bounced_count || 0,
              unsubscribed_count: email.unsubscribed_count || 0,
              interested_leads_count: email.interested_leads_count || 0,
              total_opened_count: email.total_opened_count || 0,
              unique_opened_count: email.unique_opened_count || 0,
              total_leads_contacted_count: email.total_leads_contacted_count || 0,
              daily_limit: email.daily_limit || 0,
              warmup_enabled: email.warmup_enabled || false,
              reply_rate_percentage: Math.round(replyRate * 100) / 100,
              email_provider: provider,
              reseller: reseller,
              domain: domain,
              price: price.amount,
              price_source: 'calculated',
              pricing_needs_review: price.needsReview,
              last_synced_at: new Date().toISOString(),
            };
          });

          // Upsert to email_accounts_raw
          const { error: upsertError } = await supabase
            .from('email_accounts_raw')
            .upsert(accountsWithPricing, {
              onConflict: 'bison_account_id,bison_instance',
              ignoreDuplicates: false,
            });

          if (upsertError) {
            console.error(`Upsert error for ${workspace.workspace_name}:`, upsertError);
            throw upsertError;
          }

          accountsSynced += senderEmails.length;

          // Check for next page
          nextUrl = data.links?.next || null;
        }

        results.push({
          workspace_name: workspace.workspace_name,
          accounts_synced: accountsSynced,
          status: 'success',
          duration_ms: Date.now() - wsStartTime,
        });

        console.log(`✅ Synced ${accountsSynced} accounts for ${workspace.workspace_name}`);

      } catch (error) {
        console.error(`❌ Error syncing ${workspace.workspace_name}:`, error);

        // Get detailed error message
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && typeof error === 'object') {
          errorMessage = JSON.stringify(error);
        }

        results.push({
          workspace_name: workspace.workspace_name,
          accounts_synced: 0,
          status: 'error',
          error: errorMessage,
          duration_ms: Date.now() - wsStartTime,
        });
      }
    }

    // Refresh materialized view after sync
    console.log('Refreshing email_accounts_view...');
    const { error: refreshError } = await supabase.rpc('refresh_email_accounts_view');

    if (refreshError) {
      console.error('Failed to refresh materialized view:', refreshError);
    } else {
      console.log('✅ Materialized view refreshed');
    }

    const totalDuration = Date.now() - startTime;
    const totalAccounts = results.reduce((sum, r) => sum + r.accounts_synced, 0);
    const successCount = results.filter(r => r.status === 'success').length;

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          workspaces_synced: successCount,
          workspaces_failed: results.length - successCount,
          total_accounts: totalAccounts,
          duration_ms: totalDuration,
        },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

function extractReseller(tags: any[]): string {
  const resellerTag = tags?.find((tag: any) =>
    tag.name?.toLowerCase().includes('reseller') ||
    ['cheapinboxes', 'zapmail', 'mailr', 'scaledmail'].some(r =>
      tag.name?.toLowerCase().includes(r.toLowerCase())
    )
  );
  return resellerTag?.name?.split(':')?.[1]?.trim() || resellerTag?.name || '';
}

function extractProvider(tags: any[], reseller: string): string {
  const providerTag = tags?.find((tag: any) =>
    tag.name?.toLowerCase().includes('provider') ||
    tag.name?.toLowerCase().includes('email provider')
  );

  if (providerTag) {
    return providerTag.name?.split(':')?.[1]?.trim() || providerTag.name;
  }

  // Fallback: use reseller as provider
  return reseller;
}

function calculatePrice(provider: string, reseller: string): { amount: number; needsReview: boolean } {
  const providerLower = provider.toLowerCase();
  const resellerLower = reseller.toLowerCase();

  // CheapInboxes: $3.00
  if (providerLower.includes('cheapinboxes') || resellerLower.includes('cheapinboxes')) {
    return { amount: 3.00, needsReview: false };
  }

  // Zapmail: $3.00
  if (providerLower.includes('zapmail') || resellerLower.includes('zapmail')) {
    return { amount: 3.00, needsReview: false };
  }

  // Mailr: $0.91 ($180 / 198 accounts)
  if (providerLower.includes('mailr') || resellerLower.includes('mailr')) {
    return { amount: 0.91, needsReview: false };
  }

  // ScaledMail: $50 per domain (need to calculate per-domain count separately)
  if (providerLower.includes('scaledmail') || resellerLower.includes('scaledmail')) {
    // Note: Actual per-domain calculation happens in backfill script
    return { amount: 0, needsReview: true };
  }

  // Unknown provider - needs manual review
  return { amount: 0, needsReview: true };
}
