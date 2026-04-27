// Sync per-workspace IANA timezone from Bison campaign schedules.
//
// For each workspace in client_registry that has a bison_api_key:
//   1. List the workspace's campaigns (GET /api/campaigns?per_page=100)
//   2. Pick the first active campaign (or the most-recently-updated one)
//   3. Fetch its schedule (GET /api/campaigns/{id}/schedule)
//   4. Write the schedule's `timezone` field to client_registry.timezone
//
// Designed to be safe to run repeatedly: only updates if the value
// actually changed. Triggered by:
//   - One-shot manual call after deploy (backfill).
//   - Nightly pg_cron (catches workspace adds + tz changes).
//   - On-demand "Refresh from Bison" button in the Settings UI.
//
// Optional body:  { workspace_name: "leblanc_agency" }   to sync just one.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAVERICK_BISON_API_KEY = Deno.env.get('MAVERICK_BISON_API_KEY');
const LONG_RUN_BISON_API_KEY = Deno.env.get('LONG_RUN_BISON_API_KEY');

const MAVERICK_BASE = 'https://send.maverickmarketingllc.com/api';
const LONGRUN_BASE = 'https://send.longrun.agency/api';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

interface SyncDetail {
  workspace_name: string;
  status: 'updated' | 'unchanged' | 'no_campaigns' | 'no_schedule' | 'no_timezone' | 'no_api_key' | 'error';
  old_timezone?: string | null;
  new_timezone?: string | null;
  campaign_id?: number;
  reason?: string;
}

async function syncWorkspace(supabase: any, workspace: any): Promise<SyncDetail> {
  const wsName: string = workspace.workspace_name;
  const isLongRun = workspace.bison_instance === 'Long Run';
  const baseUrl = isLongRun ? LONGRUN_BASE : MAVERICK_BASE;
  const apiKey = workspace.bison_api_key || (isLongRun ? LONG_RUN_BISON_API_KEY : MAVERICK_BISON_API_KEY);

  if (!apiKey) {
    return { workspace_name: wsName, status: 'no_api_key' };
  }

  // Step 1: list campaigns. Bison ignores per_page; we only need the first page.
  let campaignId: number | null = null;
  try {
    const listResp = await fetch(`${baseUrl}/campaigns?per_page=100`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
    });
    if (!listResp.ok) {
      return { workspace_name: wsName, status: 'error', reason: `campaigns list ${listResp.status}` };
    }
    const listData = await listResp.json();
    const campaigns: any[] = listData?.data || [];
    if (campaigns.length === 0) {
      return { workspace_name: wsName, status: 'no_campaigns' };
    }
    // Prefer campaigns with status indicating they're sending; fall back to the
    // most-recently-updated one. We just need any one campaign with a schedule.
    const sortByUpdated = (a: any, b: any) => {
      const ad = new Date(a.updated_at || a.created_at || 0).getTime();
      const bd = new Date(b.updated_at || b.created_at || 0).getTime();
      return bd - ad;
    };
    const active = campaigns
      .filter((c) => ['running', 'active', 'sending'].includes(String(c.status || '').toLowerCase()))
      .sort(sortByUpdated);
    const chosen = active[0] || campaigns.slice().sort(sortByUpdated)[0];
    campaignId = chosen?.id ?? null;
  } catch (e: any) {
    return { workspace_name: wsName, status: 'error', reason: `campaigns fetch: ${e?.message || 'unknown'}` };
  }

  if (!campaignId) {
    return { workspace_name: wsName, status: 'no_campaigns' };
  }

  // Step 2: fetch schedule for chosen campaign.
  let timezone: string | null = null;
  try {
    const schedResp = await fetch(`${baseUrl}/campaigns/${campaignId}/schedule`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
    });
    if (!schedResp.ok) {
      return {
        workspace_name: wsName,
        status: 'no_schedule',
        campaign_id: campaignId,
        reason: `schedule fetch ${schedResp.status}`,
      };
    }
    const schedData = await schedResp.json();
    // Bison wraps in {data: {...}} per the API reference; tolerate both shapes.
    const schedule = schedData?.data ?? schedData;
    timezone = schedule?.timezone || null;
  } catch (e: any) {
    return {
      workspace_name: wsName,
      status: 'error',
      campaign_id: campaignId,
      reason: `schedule fetch: ${e?.message || 'unknown'}`,
    };
  }

  if (!timezone) {
    return { workspace_name: wsName, status: 'no_timezone', campaign_id: campaignId };
  }

  // Step 3: write to client_registry only if it actually changed.
  const oldTz = workspace.timezone;
  if (oldTz === timezone) {
    return {
      workspace_name: wsName,
      status: 'unchanged',
      old_timezone: oldTz,
      new_timezone: timezone,
      campaign_id: campaignId,
    };
  }

  const { error: updErr } = await supabase
    .from('client_registry')
    .update({ timezone })
    .eq('workspace_name', wsName);

  if (updErr) {
    return {
      workspace_name: wsName,
      status: 'error',
      reason: `client_registry update: ${updErr.message}`,
      campaign_id: campaignId,
    };
  }

  return {
    workspace_name: wsName,
    status: 'updated',
    old_timezone: oldTz,
    new_timezone: timezone,
    campaign_id: campaignId,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startedAt = Date.now();

  let onlyWorkspace: string | null = null;
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (body?.workspace_name) onlyWorkspace = String(body.workspace_name);
    } catch (_) { /* no body is fine */ }
  }

  // Pull workspaces. We always need bison_api_key + bison_instance + current
  // timezone (so we can detect no-op updates).
  let query = supabase
    .from('client_registry')
    .select('workspace_name, bison_api_key, bison_instance, timezone');
  if (onlyWorkspace) query = query.eq('workspace_name', onlyWorkspace);

  const { data: workspaces, error: wsErr } = await query;
  if (wsErr) {
    return new Response(JSON.stringify({ success: false, error: wsErr.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const details: SyncDetail[] = [];
  const tally = { updated: 0, unchanged: 0, no_campaigns: 0, no_schedule: 0, no_timezone: 0, no_api_key: 0, error: 0 };

  for (const ws of workspaces || []) {
    const detail = await syncWorkspace(supabase, ws);
    details.push(detail);
    tally[detail.status]++;
  }

  console.log(`✅ sync-bison-schedules: ${JSON.stringify(tally)} elapsed=${Date.now() - startedAt}ms`);

  return new Response(JSON.stringify({
    success: true,
    workspaces_processed: workspaces?.length ?? 0,
    tally,
    details,
    elapsed_ms: Date.now() - startedAt,
  }), { status: 200, headers: corsHeaders });
});
