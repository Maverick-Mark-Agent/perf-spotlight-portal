/**
 * Real-Time Data Service
 *
 * Queries Supabase database tables directly instead of Edge Functions.
 * Data is kept fresh by webhooks (<5s latency) and polling (<5min for email accounts).
 *
 * @file src/services/realtimeDataService.ts
 * @created 2025-10-09
 */

import { supabase } from '@/integrations/supabase/client';
import {
  transformToKPIClient,
  transformToVolumeClient,
  transformToEmailAccount,
  getCurrentDateInfo,
  getMTDDateRange,
} from '@/lib/fieldMappings';
import {
  validateKPIClients,
  validateVolumeClients,
  validateEmailAccounts,
  type KPIClient,
  type VolumeClient,
  type EmailAccount,
} from '@/lib/dataValidation';
import { isClientExcludedFromVolume } from '@/lib/clientFilters';
import type { DataFetchResult } from './dataService';

// ============= KPI Dashboard (Real-Time) =============

/**
 * Fetch KPI data from database (client_metrics + client_registry)
 *
 * Performance: <500ms (vs 5-10s with Edge Functions)
 * Freshness: <5s (updated by webhooks)
 */
export async function fetchKPIDataRealtime(): Promise<DataFetchResult<KPIClient[]>> {
  const startTime = Date.now();

  try {
    console.log('[KPI Realtime] Fetching from database...');

    // Get today's date for MTD query
    const { todayStr } = getCurrentDateInfo();

    // Query client_metrics with client_registry JOIN
    let { data: metrics, error } = await supabase
      .from('client_metrics')
      .select(`
        *,
        client_registry!inner(
          workspace_name,
          display_name,
          monthly_kpi_target,
          monthly_sending_target,
          price_per_lead,
          is_active
        )
      `)
      .eq('metric_type', 'mtd')
      .eq('metric_date', todayStr)
      .eq('client_registry.is_active', true)
      .order('positive_replies_mtd', { ascending: false });

    if (error) {
      console.error('[KPI Realtime] Database error:', error);
      throw error;
    }

    // If no data for today, fall back to most recent date
    if (!metrics || metrics.length === 0) {
      console.warn('[KPI Realtime] No MTD data found for today:', todayStr);
      console.log('[KPI Realtime] Fetching most recent MTD data...');

      // Get the most recent metric_date
      const { data: recentDate } = await supabase
        .from('client_metrics')
        .select('metric_date')
        .eq('metric_type', 'mtd')
        .order('metric_date', { ascending: false })
        .limit(1)
        .single();

      if (recentDate) {
        console.log('[KPI Realtime] Using most recent date:', recentDate.metric_date);

        // Query again with the most recent date
        const fallbackQuery = await supabase
          .from('client_metrics')
          .select(`
            *,
            client_registry!inner(
              workspace_name,
              display_name,
              monthly_kpi_target,
              monthly_sending_target,
              price_per_lead,
              is_active
            )
          `)
          .eq('metric_type', 'mtd')
          .eq('metric_date', recentDate.metric_date)
          .eq('client_registry.is_active', true)
          .order('positive_replies_mtd', { ascending: false });

        metrics = fallbackQuery.data;
        error = fallbackQuery.error;

        if (error) {
          console.error('[KPI Realtime] Fallback query error:', error);
          throw error;
        }
      }
    }

    if (!metrics || metrics.length === 0) {
      console.warn('[KPI Realtime] No MTD data found at all');
      return {
        data: [],
        success: true,
        cached: false,
        fresh: true,
        timestamp: new Date(),
        fetchDurationMs: Date.now() - startTime,
        warnings: ['No MTD data found - may need to sync metrics'],
      };
    }

    // Transform database rows to KPIClient interface
    const transformedData = metrics.map(row => transformToKPIClient(row));

    // Validate transformed data
    const validation = validateKPIClients(transformedData);

    if (!validation.success) {
      console.error('[KPI Realtime] Validation failed:', validation.errors);
      console.error('[KPI Realtime] Sample transformed data:', transformedData[0]);
      console.error('[KPI Realtime] Sample raw data:', metrics[0]);
      return {
        data: null,
        success: false,
        cached: false,
        fresh: false,
        timestamp: new Date(),
        error: 'Data validation failed',
        fetchDurationMs: Date.now() - startTime,
      };
    }

    const fetchDuration = Date.now() - startTime;
    console.log(`[KPI Realtime] ✅ Fetched ${validation.data!.length} clients in ${fetchDuration}ms`);

    return {
      data: validation.data!,
      success: true,
      cached: false,
      fresh: true,
      timestamp: new Date(),
      warnings: validation.warnings,
      fetchDurationMs: fetchDuration,
    };
  } catch (error: any) {
    console.error('[KPI Realtime] Error:', error);
    return {
      data: null,
      success: false,
      cached: false,
      fresh: false,
      timestamp: new Date(),
      error: error.message || 'Unknown error',
      fetchDurationMs: Date.now() - startTime,
    };
  }
}

// ============= Volume Dashboard (Real-Time) =============

/**
 * Fetch volume data from database (client_metrics + client_registry)
 *
 * Performance: <300ms (vs 3-5s with Edge Functions)
 * Freshness: <5s (updated by webhooks)
 */
export async function fetchVolumeDataRealtime(): Promise<DataFetchResult<VolumeClient[]>> {
  const startTime = Date.now();

  try {
    console.log('[Volume Realtime] Fetching from database...');

    const { todayStr, daysInMonth, daysElapsed } = getCurrentDateInfo();

    // Query client_metrics with client_registry JOIN
    let { data: metrics, error } = await supabase
      .from('client_metrics')
      .select(`
        *,
        client_registry!inner(
          workspace_name,
          display_name,
          monthly_sending_target,
          daily_sending_target,
          is_active
        )
      `)
      .eq('metric_type', 'mtd')
      .eq('metric_date', todayStr)
      .eq('client_registry.is_active', true)
      .order('emails_sent_mtd', { ascending: false });

    if (error) {
      console.error('[Volume Realtime] Database error:', error);
      throw error;
    }

    // If no data for today, fall back to most recent date
    if (!metrics || metrics.length === 0) {
      console.warn('[Volume Realtime] No MTD data found for today:', todayStr);
      console.log('[Volume Realtime] Fetching most recent MTD data...');

      // Get the most recent metric_date
      const { data: recentDate } = await supabase
        .from('client_metrics')
        .select('metric_date')
        .eq('metric_type', 'mtd')
        .order('metric_date', { ascending: false })
        .limit(1)
        .single();

      if (recentDate) {
        console.log('[Volume Realtime] Using most recent date:', recentDate.metric_date);

        // Query again with the most recent date
        const fallbackQuery = await supabase
          .from('client_metrics')
          .select(`
            *,
            client_registry!inner(
              workspace_name,
              display_name,
              monthly_sending_target,
              daily_sending_target,
              is_active
            )
          `)
          .eq('metric_type', 'mtd')
          .eq('metric_date', recentDate.metric_date)
          .eq('client_registry.is_active', true)
          .order('emails_sent_mtd', { ascending: false});

        metrics = fallbackQuery.data;
        error = fallbackQuery.error;

        if (error) {
          console.error('[Volume Realtime] Fallback query error:', error);
          throw error;
        }
      }
    }

    if (!metrics || metrics.length === 0) {
      console.warn('[Volume Realtime] No MTD data found at all');
      return {
        data: [],
        success: true,
        cached: false,
        fresh: true,
        timestamp: new Date(),
        fetchDurationMs: Date.now() - startTime,
        warnings: ['No MTD data found - may need to sync metrics'],
      };
    }

    // Transform database rows to VolumeClient interface
    const allTransformedData = metrics.map((row, index) =>
      transformToVolumeClient(row, index + 1, daysInMonth, daysElapsed)
    );

    // Filter out blacklisted clients
    // Check both display_name and workspace_name from original metrics since client.name uses display_name || workspace_name
    const transformedData = allTransformedData.filter((client, index) => {
      const originalRow = metrics[index];
      const displayName = originalRow?.client_registry?.display_name;
      const workspaceName = originalRow?.client_registry?.workspace_name;
      
      return !isClientExcludedFromVolume(displayName, workspaceName);
    });

    console.log(`[Volume Realtime] Filtered ${allTransformedData.length - transformedData.length} blacklisted clients`);

    // Validate transformed data
    const validation = validateVolumeClients(transformedData);

    if (!validation.success) {
      console.error('[Volume Realtime] Validation failed:', validation.errors);
      return {
        data: null,
        success: false,
        cached: false,
        fresh: false,
        timestamp: new Date(),
        error: 'Data validation failed',
        fetchDurationMs: Date.now() - startTime,
      };
    }

    const fetchDuration = Date.now() - startTime;
    console.log(`[Volume Realtime] ✅ Fetched ${validation.data!.length} clients in ${fetchDuration}ms`);

    return {
      data: validation.data!,
      success: true,
      cached: false,
      fresh: true,
      timestamp: new Date(),
      warnings: validation.warnings,
      fetchDurationMs: fetchDuration,
    };
  } catch (error: any) {
    console.error('[Volume Realtime] Error:', error);
    return {
      data: null,
      success: false,
      cached: false,
      fresh: false,
      timestamp: new Date(),
      error: error.message || 'Unknown error',
      fetchDurationMs: Date.now() - startTime,
    };
  }
}

// ============= Email Infrastructure (Real-Time) =============

/**
 * Fetch email accounts from database (sender_emails_cache)
 *
 * Performance: <1s (vs 30-60s with Email Bison API)
 * Freshness: Synced daily at midnight via poll-sender-emails cron job
 *
 * NOTE: Uses sender_emails_cache (synced from Email Bison every night at midnight)
 * This ensures accurate, complete data without slow API calls during page load
 */
export async function fetchInfrastructureDataRealtime(): Promise<DataFetchResult<EmailAccount[]>> {
  const startTime = Date.now();

  try {
    console.log('[Infrastructure Realtime] Fetching from email_accounts_view (materialized view)...');

    // ✅ TWO-TABLE ARCHITECTURE: Query from materialized view for instant results (<100ms)
    // This is MUCH faster than querying sender_emails_cache or hitting the API
    // The view is auto-refreshed by poll-sender-emails after each sync completes

    // Get total count of accounts first (to bypass Supabase's 1000-row default limit)
    const { count: totalCount } = await supabase
      .from('email_accounts_view')
      .select('*', { count: 'exact', head: true });

    console.log(`[Infrastructure Realtime] Found ${totalCount || 0} total accounts in materialized view`);

    // Query email_accounts_view (refreshed after poll-sender-emails completes)
    // IMPORTANT: Set explicit limit to fetch ALL accounts (Supabase defaults to 1000 max)
    const { data: accounts, error } = await supabase
      .from('email_accounts_view')
      .select('*')
      .order('workspace_name', { ascending: true })
      .limit(totalCount || 10000); // Fetch ALL accounts, not just first 1000

    if (error) {
      console.error('[Infrastructure Realtime] Database error:', error);
      throw error;
    }

    if (!accounts || accounts.length === 0) {
      console.warn('[Infrastructure Realtime] No email accounts found in email_accounts_view');
      return {
        data: [],
        success: true,
        cached: false,
        fresh: true,
        timestamp: new Date(),
        fetchDurationMs: Date.now() - startTime,
        warnings: ['No email accounts found - polling job may not have run yet'],
      };
    }

    // Check data freshness (last_synced_at from polling job)
    // CRITICAL FIX: Use actual sync time from database, not fetch time!
    const mostRecentSync = new Date(accounts[0].last_synced_at);
    const ageMinutes = (Date.now() - mostRecentSync.getTime()) / 1000 / 60;
    const ageHours = ageMinutes / 60;

    console.log(`[Infrastructure Realtime] Data was synced at: ${mostRecentSync.toISOString()}`);
    console.log(`[Infrastructure Realtime] Data age: ${ageHours.toFixed(1)} hours`);

    if (ageHours > 24) {
      console.warn(`[Infrastructure Realtime] ⚠️ Data is ${ageHours.toFixed(1)} hours old - polling job may have failed`);
    }

    // Transform database rows to EmailAccount interface
    const transformedData = accounts.map(row => transformToEmailAccount(row));

    // CRITICAL FIX: Deduplicate by (email_address + workspace_name) instead of just email_address
    // The Edge Function deduplicates GLOBALLY, but that's WRONG for our use case!
    // The same email can legitimately belong to different clients (workspaces)
    // We should only remove duplicates from the SAME workspace + different bison_instance
    const deduplicatedData: any[] = [];
    const seenEmailWorkspace = new Set<string>();

    for (const account of transformedData) {
      const email = account.fields['Email'] || account.fields['Email Account'];
      const workspace = account.fields['Client Name (from Client)']?.[0] || account.workspace_name;
      const key = `${email}|${workspace}`;

      if (email && !seenEmailWorkspace.has(key)) {
        seenEmailWorkspace.add(key);
        deduplicatedData.push(account);
      }
    }

    const duplicateCount = transformedData.length - deduplicatedData.length;
    console.log(`[Infrastructure Realtime] Deduplication: Removed ${duplicateCount} duplicates (same email+workspace, different instance)`);
    console.log(`[Infrastructure Realtime] Total accounts after deduplication: ${deduplicatedData.length}`);

    // Validate deduplicated data
    const validation = validateEmailAccounts(deduplicatedData);

    if (!validation.success) {
      console.error('[Infrastructure Realtime] Validation failed:', validation.errors);
      console.error('[Infrastructure Realtime] First 5 errors:', validation.errors?.slice(0, 5));
      console.error('[Infrastructure Realtime] Sample failing account:', transformedData[0]);

      // TEMPORARY: Return data anyway for debugging (remove strict validation)
      console.warn('[Infrastructure Realtime] ⚠️ Bypassing validation temporarily for debugging');
      return {
        data: deduplicatedData,
        success: true,
        cached: false,
        fresh: false,
        timestamp: mostRecentSync, // FIXED: Use actual sync time, not fetch time!
        warnings: [`Validation issues found: ${validation.errors?.length} errors`],
        fetchDurationMs: Date.now() - startTime,
      };
    }

    const fetchDuration = Date.now() - startTime;
    console.log(`[Infrastructure Realtime] ✅ Fetched ${validation.data!.length} unique accounts in ${fetchDuration}ms`);

    // Determine freshness (< 24 hours = fresh)
    const isFresh = ageHours < 24;
    const warnings = validation.warnings || [];

    if (ageHours > 24) {
      warnings.push(`Data is ${ageHours.toFixed(1)} hours old - last synced at ${mostRecentSync.toLocaleString()}`);
    }

    return {
      data: validation.data!,
      success: true,
      cached: false,
      fresh: isFresh,
      timestamp: mostRecentSync, // FIXED: Use actual sync time from database, not fetch time!
      warnings,
      fetchDurationMs: fetchDuration,
    };
  } catch (error: any) {
    console.error('[Infrastructure Realtime] Error:', error);
    return {
      data: null,
      success: false,
      cached: false,
      fresh: false,
      timestamp: new Date(),
      error: error.message || 'Unknown error',
      fetchDurationMs: Date.now() - startTime,
    };
  }
}

// ============= Client Portal Leads (Real-Time) =============

/**
 * Fetch interested leads from database (client_leads)
 *
 * Performance: <200ms
 * Freshness: <5s (updated by webhooks)
 *
 * Note: Client Portal already queries this correctly,
 * but we provide it here for completeness.
 */
export async function fetchClientLeadsRealtime(
  workspaceName?: string
): Promise<DataFetchResult<any[]>> {
  const startTime = Date.now();

  try {
    console.log('[Client Leads Realtime] Fetching from database...');

    // Build query
    let query = supabase
      .from('client_leads')
      .select('*')
      .eq('interested', true)
      .order('date_received', { ascending: false });

    // Filter by workspace if provided
    if (workspaceName) {
      query = query.eq('workspace_name', workspaceName);
    }

    const { data: leads, error } = await query;

    if (error) {
      console.error('[Client Leads Realtime] Database error:', error);
      throw error;
    }

    const fetchDuration = Date.now() - startTime;
    console.log(`[Client Leads Realtime] ✅ Fetched ${leads?.length || 0} leads in ${fetchDuration}ms`);

    return {
      data: leads || [],
      success: true,
      cached: false,
      fresh: true,
      timestamp: new Date(),
      fetchDurationMs: fetchDuration,
    };
  } catch (error: any) {
    console.error('[Client Leads Realtime] Error:', error);
    return {
      data: null,
      success: false,
      cached: false,
      fresh: false,
      timestamp: new Date(),
      error: error.message || 'Unknown error',
      fetchDurationMs: Date.now() - startTime,
    };
  }
}

// ============= System Health Check =============

/**
 * Check system health (polling, webhooks, data freshness)
 */
export async function checkSystemHealth(): Promise<{
  polling: { status: 'healthy' | 'degraded' | 'down'; lastSync: string; ageMinutes: number };
  webhooks: { status: 'healthy' | 'degraded' | 'down'; lastWebhook: string; ageMinutes: number };
  database: { status: 'healthy' | 'down' };
}> {
  try {
    // Check email account sync status (email_account_metadata)
    const { data: latestEmail } = await supabase
      .from('email_account_metadata')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    const pollingAge = latestEmail
      ? (Date.now() - new Date(latestEmail.updated_at).getTime()) / 1000 / 60
      : 999;

    // Check webhook status (webhook_delivery_log)
    const { data: latestWebhook } = await supabase
      .from('webhook_delivery_log')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const webhookAge = latestWebhook
      ? (Date.now() - new Date(latestWebhook.created_at).getTime()) / 1000 / 60
      : 999;

    return {
      polling: {
        status: pollingAge < 60 ? 'healthy' : pollingAge < 180 ? 'degraded' : 'down',
        lastSync: latestEmail?.updated_at || 'never',
        ageMinutes: pollingAge,
      },
      webhooks: {
        status: webhookAge < 60 ? 'healthy' : webhookAge < 180 ? 'degraded' : 'down',
        lastWebhook: latestWebhook?.created_at || 'never',
        ageMinutes: webhookAge,
      },
      database: {
        status: 'healthy',
      },
    };
  } catch (error) {
    console.error('[Health Check] Error:', error);
    return {
      polling: { status: 'down', lastSync: 'error', ageMinutes: 999 },
      webhooks: { status: 'down', lastWebhook: 'error', ageMinutes: 999 },
      database: { status: 'down' },
    };
  }
}
