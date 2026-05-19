/**
 * sync-daily-kpi-metrics Edge Function
 *
 * Purpose: Daily scheduled job to populate client_metrics + client_revenue_mtd tables
 * Runs: Daily at 12:01 AM via pg_cron
 *
 * Flow:
 * 1. Fetch all active clients from client_registry
 * 2. For each client, fetch Email Bison stats using workspace-specific API key
 * 3. Calculate MTD metrics and projections
 * 4. Upsert to client_metrics table with metric_type='mtd'
 * 5. Upsert to client_revenue_mtd table with revenue/billing data
 *
 * @created 2025-10-09
 * @updated 2025-10-12 - Added revenue table sync
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DateRanges {
  today: string;
  currentMonthStart: string;
  lastMonthStart: string;
  lastMonthEnd: string;
  last7DaysStart: string;
  last14DaysStart: string;
  last30DaysStart: string;
  daysInMonth: number;
  daysElapsed: number;
}

// Helper function to format date as YYYY-MM-DD.
// IMPORTANT: input Dates passed here must be anchored to noon UTC on the
// intended calendar day (see cstDate below), so the UTC-formatted output
// matches the CST calendar day. Do NOT call this with `new Date()` directly
// from server context — Deno's server clock is UTC, and after ~7pm CST that
// would silently drift to the next day.
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Extract CST calendar parts from any Date. The frontend computes "today"
// in CST (see src/lib/timezoneUtils.ts), so the sync function must too,
// or late-night manual syncs land on the wrong metric_date row and the
// dashboard reads stale data.
const cstDateParts = (d: Date): { year: number; month: number; day: number } => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { year: get('year'), month: get('month'), day: get('day') };
};

// Construct a Date anchored to noon UTC on the given CST calendar day.
// All date arithmetic in getDateRanges uses getUTC*/setUTCDate on these,
// so noon UTC keeps us safely inside the same calendar day no matter the
// time-zone offset of any future caller.
const cstDate = (year: number, month: number, day: number): Date =>
  new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

// Concurrency knobs — workspace-specific Bison API keys mean each client
// hits its own rate-limit bucket, so we parallelize freely.
const CLIENT_CONCURRENCY = 50;
const PER_CLIENT_TIMEOUT_MS = 50_000;
const MAX_API_RETRIES = 3;

// client_metrics percentage columns are DECIMAL(5,2) — max 999.99.
// WoW math `((current - prior) / prior) * 100` can spike past that when
// the prior-week value is small (e.g. 1 lead). Clamp before upsert so
// the row lands instead of throwing "numeric field overflow".
const clampPct = (n: number): number =>
  Math.max(-999.99, Math.min(999.99, Number.isFinite(n) ? n : 0));

// Fetch JSON from Bison with retry (exponential backoff on 5xx) and
// HTTP status check. Throws on 4xx and after max retries on 5xx/network.
// Modeled on poll-sender-emails/index.ts:21-61.
async function fetchBisonJson(
  url: string,
  apiKey: string,
  signal: AbortSignal,
  workspaceName: string,
  maxRetries = MAX_API_RETRIES,
): Promise<any> {
  const options: RequestInit = {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
    signal,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return await response.json();
      }

      // 4xx — don't retry, surface the error
      if (response.status >= 400 && response.status < 500) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `[${workspaceName}] Bison ${response.status} on ${url}: ${body.slice(0, 200)}`,
        );
      }

      // 5xx — retry with backoff
      if (attempt < maxRetries - 1) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.warn(
          `[${workspaceName}] Bison ${response.status}, retry ${attempt + 1}/${maxRetries} in ${backoffMs}ms`,
        );
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }

      const body = await response.text().catch(() => '');
      throw new Error(
        `[${workspaceName}] Bison ${response.status} after ${maxRetries} attempts: ${body.slice(0, 200)}`,
      );
    } catch (err: any) {
      // AbortError — surface immediately, don't retry
      if (err?.name === 'AbortError') throw err;
      lastError = err;
      if (attempt < maxRetries - 1) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.warn(
          `[${workspaceName}] Network error, retry ${attempt + 1}/${maxRetries} in ${backoffMs}ms: ${err.message}`,
        );
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  throw lastError || new Error(`[${workspaceName}] Max retries exceeded`);
}

// Process one client: fetch Bison stats and upsert client_metrics row.
// Extracted so we can run multiple clients concurrently.
async function processClient(
  client: any,
  dateRanges: DateRanges,
  supabase: any,
): Promise<any> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(
    () => abortController.abort(),
    PER_CLIENT_TIMEOUT_MS,
  );

  try {
    const baseUrl = client.bison_instance === 'longrun'
      ? 'https://send.longrun.agency/api'
      : 'https://send.maverickmarketingllc.com/api';

    const apiKey = client.bison_api_key;
    if (!apiKey) {
      console.warn(`[${client.workspace_name}] Missing API key, skipping...`);
      return {
        workspace_name: client.workspace_name,
        status: 'skipped',
        error: 'Missing workspace API key',
      };
    }

    const signal = abortController.signal;
    const ws = client.workspace_name;

    const [
      mtdStats,
      last7DaysStats,
      last14DaysStats,
      last30DaysStats,
      lastMonthStats,
      scheduledToday,
      scheduledTomorrow,
    ] = await Promise.all([
      fetchBisonJson(
        `${baseUrl}/workspaces/v1.1/stats?start_date=${dateRanges.currentMonthStart}&end_date=${dateRanges.today}`,
        apiKey, signal, ws,
      ),
      fetchBisonJson(
        `${baseUrl}/workspaces/v1.1/stats?start_date=${dateRanges.last7DaysStart}&end_date=${dateRanges.today}`,
        apiKey, signal, ws,
      ),
      fetchBisonJson(
        `${baseUrl}/workspaces/v1.1/stats?start_date=${dateRanges.last14DaysStart}&end_date=${dateRanges.today}`,
        apiKey, signal, ws,
      ),
      fetchBisonJson(
        `${baseUrl}/workspaces/v1.1/stats?start_date=${dateRanges.last30DaysStart}&end_date=${dateRanges.today}`,
        apiKey, signal, ws,
      ),
      fetchBisonJson(
        `${baseUrl}/workspaces/v1.1/stats?start_date=${dateRanges.lastMonthStart}&end_date=${dateRanges.lastMonthEnd}`,
        apiKey, signal, ws,
      ),
      fetchBisonJson(
        `${baseUrl}/campaigns/sending-schedules?day=today`,
        apiKey, signal, ws,
      ),
      fetchBisonJson(
        `${baseUrl}/campaigns/sending-schedules?day=tomorrow`,
        apiKey, signal, ws,
      ),
    ]);

    // Extract reply/lead metrics
    const positiveRepliesMTD = mtdStats.data?.interested || 0;
    const positiveRepliesLast7Days = last7DaysStats.data?.interested || 0;
    const positiveRepliesLast14Days = last14DaysStats.data?.interested || 0;
    const positiveRepliesLast30Days = last30DaysStats.data?.interested || 0;
    const positiveRepliesLastMonth = lastMonthStats.data?.interested || 0;
    const allRepliesMTD = mtdStats.data?.unique_replies_per_contact || 0;
    const bouncedMTD = mtdStats.data?.bounced || 0;

    // Extract email sending volume metrics
    const emailsSentMTD = mtdStats.data?.emails_sent || 0;
    const emailsSentLast7Days = last7DaysStats.data?.emails_sent || 0;
    const emailsSentLast14Days = last14DaysStats.data?.emails_sent || 0;
    const emailsSentLast30Days = last30DaysStats.data?.emails_sent || 0;

    let emailsScheduledToday = 0;
    try {
      if (scheduledToday?.data && Array.isArray(scheduledToday.data)) {
        emailsScheduledToday = scheduledToday.data.reduce(
          (total: number, campaign: any) =>
            total + (campaign?.emails_being_sent || 0),
          0,
        );
      }
    } catch (error) {
      console.warn(`[${ws}] Error parsing scheduled emails (today):`, error);
    }

    let emailsScheduledTomorrow = 0;
    try {
      if (scheduledTomorrow?.data && Array.isArray(scheduledTomorrow.data)) {
        emailsScheduledTomorrow = scheduledTomorrow.data.reduce(
          (total: number, campaign: any) =>
            total + (campaign?.emails_being_sent || 0),
          0,
        );
      }
    } catch (error) {
      console.warn(`[${ws}] Error parsing scheduled emails (tomorrow):`, error);
    }

    const emailsSentToday = 0; // TODO: Track daily sends in separate table for accurate count

    const dailyAverage = dateRanges.daysElapsed > 0
      ? positiveRepliesMTD / dateRanges.daysElapsed
      : 0;
    const projectedRepliesEOM = Math.round(dailyAverage * dateRanges.daysInMonth);

    const emailsDailyAvg = dateRanges.daysElapsed > 0
      ? emailsSentMTD / dateRanges.daysElapsed
      : 0;
    const projectedEmailsEOM = Math.round(emailsDailyAvg * dateRanges.daysInMonth);

    const monthlyKPI = client.monthly_kpi_target || 0;
    const mtdLeadsProgress = monthlyKPI > 0
      ? (positiveRepliesMTD / monthlyKPI) * 100
      : 0;
    const projectionRepliesProgress = monthlyKPI > 0
      ? (projectedRepliesEOM / monthlyKPI) * 100
      : 0;

    const positiveReplies7To14Days = positiveRepliesLast14Days - positiveRepliesLast7Days;
    const lastWeekVsWeekBefore = positiveReplies7To14Days > 0
      ? ((positiveRepliesLast7Days - positiveReplies7To14Days) / positiveReplies7To14Days) * 100
      : 0;

    console.log(`[${ws}] MTD: ${positiveRepliesMTD}, Projected EOM: ${projectedRepliesEOM}, Target: ${monthlyKPI}`);

    const { error: upsertError } = await supabase
      .from('client_metrics')
      .upsert({
        workspace_name: ws,
        metric_date: dateRanges.today,
        metric_type: 'mtd',

        emails_sent_mtd: emailsSentMTD,
        emails_sent_today: emailsSentToday,
        emails_sent_last_7_days: emailsSentLast7Days,
        emails_sent_last_14_days: emailsSentLast14Days,
        emails_sent_last_30_days: emailsSentLast30Days,
        emails_scheduled_today: emailsScheduledToday,
        emails_scheduled_tomorrow: emailsScheduledTomorrow,
        projection_emails_eom: projectedEmailsEOM,

        positive_replies_mtd: positiveRepliesMTD,
        positive_replies_last_7_days: positiveRepliesLast7Days,
        positive_replies_last_14_days: positiveRepliesLast14Days,
        positive_replies_last_30_days: positiveRepliesLast30Days,
        positive_replies_current_month: positiveRepliesMTD,
        positive_replies_last_month: positiveRepliesLastMonth,
        projection_positive_replies_eom: projectedRepliesEOM,

        all_replies_mtd: allRepliesMTD,
        bounced_mtd: bouncedMTD,

        mtd_leads_progress: clampPct(mtdLeadsProgress),
        projection_replies_progress: clampPct(projectionRepliesProgress),
        last_week_vs_week_before_progress: clampPct(lastWeekVsWeekBefore),

        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'workspace_name,metric_date,metric_type',
      });

    if (upsertError) {
      throw new Error(`Upsert failed: ${upsertError.message}`);
    }

    return {
      workspace_name: ws,
      status: 'success',
      positive_replies_mtd: positiveRepliesMTD,
      projection_eom: projectedRepliesEOM,
      target: monthlyKPI,
      progress: Math.round(mtdLeadsProgress),
    };
  } catch (error) {
    console.error(`[${client.workspace_name}] Error:`, error);
    return {
      workspace_name: client.workspace_name,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Get date ranges for metric calculations
// Accepts an optional target date so the function can backfill historical
// snapshots. When omitted, "today" is the current CST calendar day.
// All math is anchored on the CST calendar (matches the frontend's
// getCurrentCstInfo in src/lib/timezoneUtils.ts) so manual syncs late
// at night land on the same row the dashboard reads.
const getDateRanges = (targetDate?: Date): DateRanges => {
  const { year, month, day } = cstDateParts(targetDate ?? new Date());
  const today = cstDate(year, month, day);

  // Current month (MTD)
  const currentMonthStart = cstDate(year, month, 1);

  // Previous month
  const prevMonthYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const lastMonthStart = cstDate(prevMonthYear, prevMonth, 1);
  const lastMonthEnd = cstDate(year, month, 0); // day 0 = last day of prior month

  // Last N days — use UTC arithmetic on the noon-anchored Date.
  const last7DaysStart = new Date(today.getTime());
  last7DaysStart.setUTCDate(today.getUTCDate() - 7);

  const last14DaysStart = new Date(today.getTime());
  last14DaysStart.setUTCDate(today.getUTCDate() - 14);

  const last30DaysStart = new Date(today.getTime());
  last30DaysStart.setUTCDate(today.getUTCDate() - 30);

  // daysInMonth = day 0 of (month+1) is the last day of `month`.
  const daysInMonth = cstDate(year, month + 1, 0).getUTCDate();
  const daysElapsed = day;

  return {
    today: formatDate(today),
    currentMonthStart: formatDate(currentMonthStart),
    lastMonthStart: formatDate(lastMonthStart),
    lastMonthEnd: formatDate(lastMonthEnd),
    last7DaysStart: formatDate(last7DaysStart),
    last14DaysStart: formatDate(last14DaysStart),
    last30DaysStart: formatDate(last30DaysStart),
    daysInMonth,
    daysElapsed,
  };
};

// Parse and validate an optional ?date=YYYY-MM-DD query param.
// Returns undefined if not supplied; throws if format/range is invalid.
const parseTargetDate = (req: Request): Date | undefined => {
  const url = new URL(req.url);
  const raw = url.searchParams.get('date');
  if (!raw) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`Invalid date param "${raw}" — expected YYYY-MM-DD`);
  }
  // Construct at noon UTC to avoid local-vs-UTC day flips.
  const d = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date param "${raw}" — not a real date`);
  }
  const now = new Date();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
  if (d > now || d < ninetyDaysAgo) {
    throw new Error(`date param "${raw}" must be within the last 90 days and not in the future`);
  }
  return d;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== SYNC DAILY KPI METRICS ===');
    const startTime = Date.now();

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optional ?date=YYYY-MM-DD backfills a historical snapshot.
    // Without it, behavior is identical to before — snapshots "today".
    const targetDate = parseTargetDate(req);
    const dateRanges = getDateRanges(targetDate);

    if (targetDate) {
      console.log(`Backfill mode — snapshotting metric_date=${dateRanges.today}`);
    }
    console.log('Date ranges:', dateRanges);

    // Fetch all active clients with workspace-specific API keys + billing info
    const { data: clients, error: clientsError } = await supabase
      .from('client_registry')
      .select('workspace_name, display_name, bison_workspace_id, monthly_kpi_target, monthly_sending_target, bison_api_key, bison_instance, billing_type, price_per_lead, retainer_amount')
      .eq('is_active', true);

    if (clientsError) {
      throw new Error(`Failed to fetch clients: ${clientsError.message}`);
    }

    console.log(`Processing ${clients.length} active clients...`);

    // Process clients in parallel batches of CLIENT_CONCURRENCY.
    // Each workspace has its own Bison API key (independent rate-limit
    // bucket), so we don't need an inter-client delay.
    const results: any[] = [];
    for (let i = 0; i < clients.length; i += CLIENT_CONCURRENCY) {
      const batch = clients.slice(i, i + CLIENT_CONCURRENCY);
      console.log(
        `\n--- Batch ${Math.floor(i / CLIENT_CONCURRENCY) + 1}: ${batch.map((c: any) => c.workspace_name).join(', ')} ---`,
      );
      const settled = await Promise.allSettled(
        batch.map((c: any) => processClient(c, dateRanges, supabase)),
      );
      for (let j = 0; j < settled.length; j++) {
        const s = settled[j];
        if (s.status === 'fulfilled') {
          results.push(s.value);
        } else {
          // processClient catches its own errors, so this should be rare —
          // an unhandled rejection means the function itself threw before
          // its try/catch (e.g. AbortError leaking).
          results.push({
            workspace_name: batch[j].workspace_name,
            status: 'failed',
            error: s.reason instanceof Error ? s.reason.message : String(s.reason),
          });
        }
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const failCount = results.length - successCount;

    const durationMs = Date.now() - startTime;

    console.log(`\n=== SYNC COMPLETE ===`);
    console.log(`Duration: ${durationMs}ms`);
    console.log(`Success: ${successCount}/${clients.length}`);
    console.log(`Failed: ${failCount}/${clients.length}`);

    return new Response(JSON.stringify({
      success: true,
      total_clients: clients.length,
      successful: successCount,
      failed: failCount,
      duration_ms: durationMs,
      date: dateRanges.today,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
