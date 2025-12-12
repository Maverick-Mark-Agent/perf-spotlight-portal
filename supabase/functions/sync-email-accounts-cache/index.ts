/**
 * Background Sync Function for Email Accounts Cache
 *
 * This function runs every 30 minutes via cron job to:
 * 1. Fetch all email accounts from Email Bison API (via hybrid-email-accounts-v2)
 * 2. Update email_accounts_cache table with latest data
 * 3. Refresh materialized view for dashboard queries
 * 4. Log sync operation for monitoring
 *
 * This architecture prevents dashboard from showing inconsistent data
 * by only updating the materialized view after successful full sync.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SyncResult {
  success: boolean;
  totalAccounts: number;
  totalInstances: number;
  totalWorkspaces: number;
  failedWorkspaces: string[];
  error?: string;
  summary?: any;
}

serve(async (req) => {
  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 EMAIL ACCOUNTS CACHE SYNC STARTED`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  let syncLogId: string | null = null;

  try {
    // Create sync log entry
    const { data: logData, error: logError } = await supabase
      .from('email_sync_logs')
      .insert({
        started_at: new Date().toISOString(),
        status: 'running',
        triggered_by: req.headers.get('x-triggered-by') || 'cron',
      })
      .select()
      .single();

    if (logError) {
      console.error('❌ Failed to create sync log:', logError);
    } else {
      syncLogId = logData?.id;
      console.log(`📝 Sync log created: ${syncLogId}`);
    }

    // Step 1: Call hybrid-email-accounts-v2 to fetch all accounts
    console.log(`\n📡 Fetching email accounts from Email Bison API...`);

    const hybridResponse = await fetch(
      `${supabaseUrl}/functions/v1/hybrid-email-accounts-v2`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!hybridResponse.ok) {
      const errorText = await hybridResponse.text();
      throw new Error(`hybrid-email-accounts-v2 failed: ${hybridResponse.status} - ${errorText}`);
    }

    const emailAccountsData = await hybridResponse.json();
    const accounts = emailAccountsData.records || emailAccountsData.data || [];
    console.log(`✅ Received ${accounts.length} accounts from API`);

    if (accounts.length === 0) {
      throw new Error('No email accounts returned from API');
    }

    // Step 2: Prepare cache records
    console.log(`\n💾 Preparing cache records...`);
    const cacheRecords = accounts.map((record: any) => {
      const account = record.fields || record; // Handle both {fields: {...}} and direct format
      return {
        email_address: account['Email Account'] || account.email,
        bison_id: account.id || record.id,
        workspace_id: account['Workspace ID'] || account.workspace_id,
        workspace_name: account.Workspace || account.workspace_name,
        bison_instance: account['Bison Instance'] || account.bison_instance,
        account_data: account, // Store complete account data as JSONB
        last_synced_at: new Date().toISOString(),
        sync_status: 'success',
        sync_error: null,
      };
    });

    console.log(`Prepared ${cacheRecords.length} cache records`);

    // Step 3: Upsert to cache table (update existing, insert new)
    console.log(`\n🔄 Upserting to email_accounts_cache...`);

    // Batch upserts in chunks of 500 to avoid request size limits
    const BATCH_SIZE = 500;
    let totalUpserted = 0;
    let failedUpserts = 0;

    for (let i = 0; i < cacheRecords.length; i += BATCH_SIZE) {
      const batch = cacheRecords.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(cacheRecords.length / BATCH_SIZE);

      console.log(`  Batch ${batchNumber}/${totalBatches}: Upserting ${batch.length} records...`);

      const { error: upsertError } = await supabase
        .from('email_accounts_cache')
        .upsert(batch, {
          onConflict: 'email_address', // Unique constraint
          ignoreDuplicates: false, // Update existing records
        });

      if (upsertError) {
        console.error(`  ❌ Batch ${batchNumber} failed:`, upsertError);
        failedUpserts += batch.length;
      } else {
        console.log(`  ✅ Batch ${batchNumber} completed`);
        totalUpserted += batch.length;
      }
    }

    console.log(`\n✅ Upserted ${totalUpserted} records to cache (${failedUpserts} failed)`);

    // Step 4: Delete accounts that no longer exist in Email Bison
    console.log(`\n🗑️  Cleaning up deleted accounts...`);
    const currentEmails = cacheRecords.map((r: any) => r.email_address);

    const { data: deletedData, error: deleteError } = await supabase
      .from('email_accounts_cache')
      .delete()
      .not('email_address', 'in', `(${currentEmails.map((e: string) => `'${e}'`).join(',')})`)
      .select();

    if (deleteError) {
      console.error('⚠️  Failed to delete old accounts:', deleteError);
    } else {
      console.log(`✅ Deleted ${deletedData?.length || 0} accounts no longer in Email Bison`);
    }

    // Step 5: Refresh materialized view for dashboard
    console.log(`\n🔄 Refreshing materialized view...`);

    const { error: refreshError } = await supabase.rpc('refresh_email_accounts_live');

    if (refreshError) {
      console.error('⚠️  Failed to refresh materialized view:', refreshError);
      // Non-fatal - cache is still updated
    } else {
      console.log(`✅ Materialized view refreshed`);
    }

    // Step 6: Calculate summary statistics
    const { data: instanceStats } = await supabase
      .from('email_accounts_cache')
      .select('bison_instance')
      .eq('sync_status', 'success');

    const instanceCounts = (instanceStats || []).reduce((acc: any, row: any) => {
      acc[row.bison_instance] = (acc[row.bison_instance] || 0) + 1;
      return acc;
    }, {});

    const { data: workspaceStats } = await supabase
      .from('email_accounts_cache')
      .select('workspace_name');

    const workspaceCounts = (workspaceStats || []).reduce((acc: any, row: any) => {
      acc[row.workspace_name] = (acc[row.workspace_name] || 0) + 1;
      return acc;
    }, {});

    const summary = {
      instance_counts: instanceCounts,
      workspace_counts: workspaceCounts,
      total_workspaces: Object.keys(workspaceCounts).length,
      top_workspaces: Object.entries(workspaceCounts)
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
    };

    // Step 7: Update sync log with success
    const duration = Math.round((Date.now() - startTime) / 1000);

    if (syncLogId) {
      await supabase
        .from('email_sync_logs')
        .update({
          completed_at: new Date().toISOString(),
          duration_seconds: duration,
          status: failedUpserts > 0 ? 'partial' : 'success',
          total_accounts_fetched: totalUpserted,
          total_instances_processed: Object.keys(instanceCounts).length,
          total_workspaces_processed: Object.keys(workspaceCounts).length,
          workspaces_failed: [],
          summary: summary,
        })
        .eq('id', syncLogId);
    }

    // Log success summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ EMAIL ACCOUNTS CACHE SYNC COMPLETED`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Duration: ${duration}s`);
    console.log(`Total Accounts: ${totalUpserted}`);
    console.log(`Failed Upserts: ${failedUpserts}`);
    console.log(`Instances:`);
    Object.entries(instanceCounts).forEach(([instance, count]) => {
      console.log(`  - ${instance}: ${count}`);
    });
    console.log(`Workspaces: ${Object.keys(workspaceCounts).length}`);
    console.log(`${'='.repeat(60)}\n`);

    return new Response(
      JSON.stringify({
        success: true,
        sync_log_id: syncLogId,
        duration_seconds: duration,
        total_accounts: totalUpserted,
        failed_upserts: failedUpserts,
        summary: summary,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`\n${'='.repeat(60)}`);
    console.error(`❌ EMAIL ACCOUNTS CACHE SYNC FAILED`);
    console.error(`${'='.repeat(60)}`);
    console.error(`Duration: ${duration}s`);
    console.error(`Error: ${errorMessage}`);
    console.error(`${'='.repeat(60)}\n`);

    // Update sync log with failure
    if (syncLogId) {
      await supabase
        .from('email_sync_logs')
        .update({
          completed_at: new Date().toISOString(),
          duration_seconds: duration,
          status: 'failed',
          error_message: errorMessage,
          error_details: {
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString(),
          },
        })
        .eq('id', syncLogId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        sync_log_id: syncLogId,
        duration_seconds: duration,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
