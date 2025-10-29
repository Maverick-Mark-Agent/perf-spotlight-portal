/**
 * Sync All Workspaces
 *
 * Loops through all active workspaces and syncs each one sequentially
 * This is a workaround for the broken Edge Function poll-sender-emails
 *
 * Usage:
 *   npx tsx scripts/sync-all-workspaces.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MAVERICK_BASE_URL = 'https://send.maverickmarketingllc.com/api';
const LONGRUN_BASE_URL = 'https://send.longrun.agency/api';

interface SyncResult {
  workspace_name: string;
  success: boolean;
  accounts_synced: number;
  duration_ms: number;
  error?: string;
}

async function syncWorkspace(workspace: any): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    workspace_name: workspace.workspace_name,
    success: false,
    accounts_synced: 0,
    duration_ms: 0,
  };

  try {
    if (!workspace.bison_api_key) {
      result.error = 'No API key configured';
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    const baseUrl = workspace.bison_instance === 'Long Run' ? LONGRUN_BASE_URL : MAVERICK_BASE_URL;
    const apiKey = workspace.bison_api_key;

    // Fetch all accounts from Email Bison
    let allAccounts: any[] = [];
    let nextUrl = `${baseUrl}/sender-emails?per_page=1000`;
    let pageCount = 0;

    while (nextUrl) {
      pageCount++;

      const response = await fetch(nextUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        result.error = `API Error ${response.status}: ${response.statusText}`;
        result.duration_ms = Date.now() - startTime;
        return result;
      }

      const data = await response.json();
      const accounts = data.data || [];

      if (accounts.length === 0) break;

      allAccounts.push(...accounts);

      // Check for next page
      nextUrl = data.links?.next || null;

      if (!nextUrl && data.meta?.current_page < data.meta?.last_page) {
        nextUrl = `${baseUrl}/sender-emails?per_page=1000&page=${data.meta.current_page + 1}`;
      }
    }

    if (allAccounts.length === 0) {
      result.success = true;
      result.accounts_synced = 0;
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    // Transform accounts to database format
    const accountRecords = allAccounts.map(account => {
      const provider = account.tags?.find((t: any) =>
        ['Google', 'Outlook', 'Gmail', 'Microsoft'].some(p => t.name?.includes(p))
      )?.name || null;

      const reseller = account.tags?.find((t: any) =>
        ['Mailr', 'CheapInboxes', 'Zapmail', 'ScaledMail'].some(r => t.name?.includes(r))
      )?.name || null;

      const domain = account.email?.split('@')[1] || null;
      const replyRate = account.emails_sent_count > 0
        ? Math.round((account.unique_replied_count / account.emails_sent_count) * 100 * 100) / 100
        : 0;

      return {
        bison_account_id: account.id,
        email_address: account.email,
        workspace_name: workspace.workspace_name,
        workspace_id: workspace.bison_workspace_id,
        bison_instance: workspace.bison_instance === 'Long Run' ? 'longrun' : 'maverick',
        status: account.status || 'Not connected',
        account_type: account.type,
        emails_sent_count: account.emails_sent_count || 0,
        total_replied_count: account.total_replied_count || 0,
        unique_replied_count: account.unique_replied_count || 0,
        bounced_count: account.bounced_count || 0,
        unsubscribed_count: account.unsubscribed_count || 0,
        interested_leads_count: account.interested_leads_count || 0,
        total_opened_count: account.total_opened_count || 0,
        unique_opened_count: account.unique_opened_count || 0,
        total_leads_contacted_count: account.total_leads_contacted_count || 0,
        daily_limit: account.daily_limit || 0,
        warmup_enabled: account.warmup_enabled || false,
        reply_rate_percentage: replyRate,
        email_provider: provider,
        reseller: reseller,
        domain: domain,
        price: 0,
        price_source: 'calculated',
        pricing_needs_review: false,
        last_synced_at: new Date().toISOString(),
      };
    });

    // Upsert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < accountRecords.length; i += batchSize) {
      const batch = accountRecords.slice(i, i + batchSize);

      const { error: upsertError } = await supabase
        .from('email_accounts_raw')
        .upsert(batch, {
          onConflict: 'bison_account_id,bison_instance',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        result.error = `Upsert error: ${upsertError.message}`;
        result.duration_ms = Date.now() - startTime;
        return result;
      }
    }

    result.success = true;
    result.accounts_synced = allAccounts.length;
    result.duration_ms = Date.now() - startTime;
    return result;

  } catch (error: any) {
    result.error = error.message;
    result.duration_ms = Date.now() - startTime;
    return result;
  }
}

async function main() {
  console.log('🔄 Syncing all active workspaces...\n');

  const overallStartTime = Date.now();

  // Fetch all active workspaces
  const { data: workspaces, error } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key')
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

  console.log(`Found ${workspaces.length} active workspaces to sync\n`);
  console.log('='.repeat(100));

  const results: SyncResult[] = [];
  let totalAccountsSynced = 0;

  for (let i = 0; i < workspaces.length; i++) {
    const workspace = workspaces[i];
    const progress = `[${i + 1}/${workspaces.length}]`;

    process.stdout.write(`${progress} ${workspace.workspace_name.padEnd(30)} ... `);

    const result = await syncWorkspace(workspace);
    results.push(result);

    if (result.success) {
      totalAccountsSynced += result.accounts_synced;
      console.log(`✅ ${result.accounts_synced} accounts (${(result.duration_ms / 1000).toFixed(1)}s)`);
    } else {
      console.log(`❌ ${result.error}`);
    }

    // Small delay between workspaces to avoid rate limiting
    if (i < workspaces.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('='.repeat(100));

  // Refresh materialized view
  console.log('\n🔄 Refreshing materialized view...');
  const { error: viewError } = await supabase.rpc('refresh_email_accounts_view');

  if (viewError) {
    console.error('❌ Failed to refresh view:', viewError);
  } else {
    console.log('✅ Materialized view refreshed!');
  }

  // Summary
  const overallDuration = Date.now() - overallStartTime;
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n📊 Summary:');
  console.log(`   Total workspaces: ${workspaces.length}`);
  console.log(`   Successful: ${successful}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total accounts synced: ${totalAccountsSynced}`);
  console.log(`   Total duration: ${(overallDuration / 1000).toFixed(1)}s`);

  if (failed > 0) {
    console.log('\n❌ Failed workspaces:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.workspace_name}: ${r.error}`);
    });
  } else {
    console.log('\n✅ All workspaces synced successfully!');
  }
}

main().catch(console.error);
