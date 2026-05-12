// enable-warmup edge function
//
// Re-enables warmup for all sender accounts across all Bison workspaces
// (Maverick + Long Run) where warmup is currently disabled.
//
// Called by warmup-slash after Slack ACK. Posts results back to Slack
// via response_url when triggered from Slack, or returns JSON directly.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAVERICK_BASE            = 'https://send.maverickmarketingllc.com';
const LONGRUN_BASE             = 'https://send.longrun.agency';

async function bisonGet(baseUrl: string, apiKey: string, path: string, params?: Record<string, string>) {
  let url = `${baseUrl}${path}`;
  if (params) url += '?' + new URLSearchParams(params).toString();
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
  if (!r.ok) return null;
  return r.json();
}

async function bisonPatch(baseUrl: string, apiKey: string, path: string, body: unknown) {
  const r = await fetch(`${baseUrl}${path}`, {
    method: 'PATCH',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) return null;
  return r.json();
}

async function getDisabledSenderIds(baseUrl: string, apiKey: string): Promise<number[]> {
  const today = new Date().toISOString().slice(0, 10);
  const ids: number[] = [];
  let page = 1;
  while (true) {
    const resp = await bisonGet(baseUrl, apiKey, '/api/warmup/sender-emails', {
      warmup_status: 'disabled',
      start_date:    today,
      end_date:      today,
      page:          String(page),
    });
    if (!resp) break;
    const batch: any[] = resp.data ?? [];
    if (batch.length === 0) break;
    ids.push(...batch.map((s: any) => s.id));
    const lastPage = resp.meta?.last_page ?? 1;
    if (page >= lastPage) break;
    page++;
  }
  return ids;
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const { response_url } = await req.json().catch(() => ({}));

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Load all workspaces with a bison_api_key
  const { data: workspaces, error } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_api_key, bison_instance')
    .not('bison_api_key', 'is', null);

  if (error || !workspaces?.length) {
    const msg = `Failed to load workspaces: ${error?.message}`;
    if (response_url) await postToSlack(response_url, `:x: ${msg}`);
    return new Response(JSON.stringify({ success: false, error: msg }), { headers: corsHeaders });
  }

  let totalEnabled = 0;
  let totalHealthy = 0;
  let totalFailed  = 0;
  const details: string[] = [];

  for (const ws of workspaces) {
    const name    = ws.workspace_name;
    const apiKey  = ws.bison_api_key!;
    const baseUrl = ws.bison_instance === 'Long Run' ? LONGRUN_BASE : MAVERICK_BASE;

    const disabledIds = await getDisabledSenderIds(baseUrl, apiKey);

    if (disabledIds.length === 0) {
      totalHealthy++;
      continue;
    }

    const result = await bisonPatch(baseUrl, apiKey, '/api/warmup/sender-emails/enable', {
      sender_email_ids: disabledIds,
    });

    if (result?.data?.success) {
      totalEnabled += disabledIds.length;
      details.push(`✅ *${name}*: re-enabled ${disabledIds.length} account(s)`);
    } else {
      totalFailed++;
      details.push(`❌ *${name}*: failed to re-enable ${disabledIds.length} account(s)`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  const summary = [
    `:white_check_mark: *Warmup re-enable complete*`,
    `• *${totalEnabled}* account(s) re-enabled across ${workspaces.length} workspaces`,
    `• *${totalHealthy}* workspace(s) already healthy`,
    totalFailed ? `• *${totalFailed}* workspace(s) failed` : null,
    details.length ? `\n${details.join('\n')}` : null,
  ].filter(Boolean).join('\n');

  if (response_url) await postToSlack(response_url, summary);

  return new Response(JSON.stringify({ success: true, total_enabled: totalEnabled, summary }), {
    headers: corsHeaders,
  });
});

async function postToSlack(responseUrl: string, text: string) {
  await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response_type: 'in_channel', text }),
  }).catch((e) => console.error('Slack post failed:', e?.message));
}
