// COO Volume Diagnostic — runs the 3-cause root-cause analysis on every
// active client below 90% of their daily sending target, and DMs the result
// to Hassan in Slack.
//
// Three causes:
//   1. low_contacts        — campaign sendable pool depleted
//   2. infra_at_max         — theoretical max < target (need more accounts)
//   3. infra_undercapped    — configured limits < theoretical max (raise limits)
//   4. campaign_caps        — campaign max_emails_per_day < target
//   5. no_senders           — 0 sender accounts connected
//
// Per-account-type max (by Slack tag, not OAuth type):
//   tag contains "Google"       → 15/day
//   tag contains "Microsoft" or "Outlook" → 3/day
//
// Excludes not-yet-launched clients: Kirk Hodgson, Chris Glover Agency.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SLACK_BOT_TOKEN = Deno.env.get('COO_SLACK_BOT_TOKEN')!;
const HASSAN_DM_CHANNEL = Deno.env.get('COO_SLACK_HASSAN_DM_CHANNEL')!;
const HUSSAIN_DM_CHANNEL = Deno.env.get('COO_SLACK_DM_CHANNEL')!;
const MAVERICK_BISON_API_KEY = Deno.env.get('MAVERICK_BISON_API_KEY') || Deno.env.get('EMAIL_BISON_API_KEY')!;
const MAVERICK_BASE_URL = 'https://send.maverickmarketingllc.com/api';
const LONGRUN_BISON_API_KEY = Deno.env.get('LONG_RUN_BISON_API_KEY') || '';
const LONGRUN_BASE_URL = 'https://send.longrun.agency/api';

const NOT_LAUNCHED = new Set(['Kirk Hodgson', 'Chris Glover Agency']);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

interface Cause {
  cause: string;
  detail: string;
}

interface ClientResult {
  name: string;
  workspace_name: string;
  target: number;
  today: number;
  pct: number;
  bison_workspace_id: number | null;
  bison_instance: string | null;
  causes: Cause[];
  connected_senders: number;
  configured_daily_total: number;
  theoretical_max_daily: number;
  campaigns_audited: any[];
  sendable_total: number;
  sender_type_breakdown: Record<string, number>;
  error?: string;
}

async function bisonFetch(base: string, key: string, path: string, retries = 2): Promise<any | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(`${base}/${path}`, {
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      });
      if (!r.ok) {
        if (i < retries) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        return null;
      }
      return await r.json();
    } catch (_e) {
      if (i < retries) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      return null;
    }
  }
  return null;
}

async function bisonSwitch(base: string, key: string, workspaceId: number): Promise<boolean> {
  try {
    const r = await fetch(`${base}/workspaces/v1.1/switch-workspace`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ team_id: workspaceId }),
    });
    return r.ok;
  } catch (_e) {
    return false;
  }
}

async function bisonFetchAll(base: string, key: string, pathBase: string): Promise<any[]> {
  // Bison forces 15 items/page on sender-emails regardless of per_page param,
  // so big workspaces (900+ senders) hit 60+ pages. Page 1 reveals last_page;
  // then fetch pages 2..N concurrently with a thread pool to keep total time
  // per workspace under ~10s instead of ~60s.
  const sep = pathBase.includes('?') ? '&' : '?';
  const first = await bisonFetch(base, key, `${pathBase}${sep}per_page=100&page=1`);
  if (!first) return [];
  const rows: any[] = [...(first.data || [])];
  const last = first.meta?.last_page || 1;
  if (last <= 1) return rows;

  const pagesToFetch: number[] = [];
  for (let p = 2; p <= last; p++) pagesToFetch.push(p);

  const CONCURRENCY = 8;
  const results: Map<number, any[]> = new Map();
  let cursor = 0;
  async function worker() {
    while (cursor < pagesToFetch.length) {
      const idx = cursor++;
      const p = pagesToFetch[idx];
      const d = await bisonFetch(base, key, `${pathBase}${sep}per_page=100&page=${p}`);
      results.set(p, d?.data || []);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pagesToFetch.length) }, () => worker()));
  for (let p = 2; p <= last; p++) {
    rows.push(...(results.get(p) || []));
  }
  return rows;
}

function accountMaxByTags(tags: any[]): { max: number | null; label: string } {
  const names = (tags || []).map((t: any) => (t.name || '').toLowerCase().trim());
  for (const n of names) {
    if (n.includes('google')) return { max: 15, label: 'google' };
  }
  for (const n of names) {
    if (n.includes('microsoft') || n.includes('outlook')) return { max: 3, label: 'microsoft' };
  }
  return { max: null, label: 'unknown' };
}

async function diagnoseClient(c: any): Promise<ClientResult> {
  const result: ClientResult = {
    name: c.name,
    workspace_name: c.workspace_name,
    target: c.target,
    today: c.today,
    pct: c.pct,
    bison_workspace_id: c.bison_workspace_id,
    bison_instance: c.bison_instance,
    causes: [],
    connected_senders: 0,
    configured_daily_total: 0,
    theoretical_max_daily: 0,
    campaigns_audited: [],
    sendable_total: 0,
    sender_type_breakdown: { google: 0, microsoft: 0, unknown: 0 },
  };

  if (!c.bison_workspace_id) {
    result.error = 'no_workspace_id';
    return result;
  }
  const base = c.bison_instance === 'Long Run' ? LONGRUN_BASE_URL : MAVERICK_BASE_URL;
  const key = c.bison_instance === 'Long Run' ? LONGRUN_BISON_API_KEY : MAVERICK_BISON_API_KEY;
  if (!key) {
    result.error = 'no_api_key';
    return result;
  }

  const switched = await bisonSwitch(base, key, c.bison_workspace_id);
  if (!switched) {
    result.error = 'switch_failed';
    return result;
  }
  await new Promise(r => setTimeout(r, 500));

  // Fetch live scheduled volume for today directly from Bison at run-time,
  // overriding the stale midnight snapshot value that came in via c.today.
  const liveScheduled = await bisonFetch(base, key, 'campaigns/sending-schedules?day=today');
  if (liveScheduled?.data && Array.isArray(liveScheduled.data)) {
    const liveCount = liveScheduled.data.reduce((sum: number, cp: any) => sum + (cp.emails_being_sent || 0), 0);
    result.today = liveCount;
    result.pct = c.target > 0 ? (liveCount / c.target) * 100 : 0;
  }

  // 1. Active campaigns — take the 2 most recent
  const campaigns = await bisonFetchAll(base, key, 'campaigns?status=active');
  campaigns.sort((a: any, b: any) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  const recent = campaigns.slice(0, 2);

  let totalMaxEmails = 0;
  for (const cp of recent) {
    const me = cp.max_emails_per_day || 0;
    const mn = cp.max_new_leads_per_day || 0;
    result.campaigns_audited.push({
      name: cp.name,
      max_emails_per_day: me,
      max_new_leads_per_day: mn,
    });
    totalMaxEmails += me;
    // Sendable contacts = total_leads - total_leads_contacted
    const sendable = Math.max(0, (cp.total_leads || 0) - (cp.total_leads_contacted || 0));
    result.sendable_total += sendable;
  }

  // 2. Sender accounts — paginate fully. Some workspaces have 900+ senders
  // across 30+ pages, so do not put a tight cap here.
  const senders = await bisonFetchAll(base, key, 'sender-emails');
  const connected = senders.filter((s: any) => s.status === 'Connected' || s.status === 'connected');
  result.connected_senders = connected.length;
  let configured = 0;
  let theoretical = 0;
  for (const s of connected) {
    configured += s.daily_limit || 0;
    const { max, label } = accountMaxByTags(s.tags);
    result.sender_type_breakdown[label] = (result.sender_type_breakdown[label] || 0) + 1;
    if (max !== null) {
      theoretical += max;
    } else {
      // Unknown tag — use current daily_limit as conservative ceiling
      theoretical += s.daily_limit || 0;
    }
  }
  result.configured_daily_total = configured;
  result.theoretical_max_daily = theoretical;

  // 3. Diagnose
  if (connected.length === 0) {
    result.causes.push({ cause: 'no_senders', detail: 'No senders connected' });
  } else {
    if (recent.length > 0 && totalMaxEmails < c.target) {
      result.causes.push({
        cause: 'campaign_caps_too_low',
        detail: `Sum of max_emails_per_day across ${recent.length} active campaigns = ${totalMaxEmails.toLocaleString()}, target = ${c.target.toLocaleString()}`,
      });
    }
    if (configured < c.target) {
      if (theoretical >= c.target) {
        result.causes.push({
          cause: 'infra_undercapped',
          detail: `Configured = ${configured.toLocaleString()} < target ${c.target.toLocaleString()}, but theoretical max = ${theoretical.toLocaleString()}`,
        });
      } else {
        result.causes.push({
          cause: 'infra_at_max',
          detail: `Theoretical max = ${theoretical.toLocaleString()} < target ${c.target.toLocaleString()}`,
        });
      }
    }
    if (recent.length > 0 && result.sendable_total < c.target) {
      result.causes.push({
        cause: 'low_contacts',
        detail: `Only ${result.sendable_total.toLocaleString()} uncontacted leads remain across ${recent.length} active campaigns`,
      });
    }
  }

  return result;
}

// Classify into one of 4 categories with the exact phrasing Hussain specified:
//   • need_contacts   → "Need more contacts"
//   • need_infra      → "Need more infrastructure. Max sending capacity is X/day"
//   • raise_limits    → "Need to increase sending limits. Possible sending is X/day"
//   • raise_caps      → "Need to increase emails per day in campaign settings"
// Plus error/edge cases that fall through to 'unknown'.
function classifyResult(r: ClientResult): { category: string; detail: string } {
  if (r.error === 'no_workspace_id') return { category: 'unknown', detail: 'Missing bison_workspace_id in registry' };
  if (r.error) return { category: 'unknown', detail: `Could not check (${r.error})` };
  // Order of priority matters: contacts beats infra, infra beats caps.
  // Reason: if there are no contacts to send to, no amount of infra/caps fixes it.
  const causeTypes = r.causes.map(c => c.cause);
  if (causeTypes.includes('low_contacts')) {
    return { category: 'need_contacts', detail: 'Need more contacts' };
  }
  if (causeTypes.includes('infra_at_max')) {
    return { category: 'need_infra', detail: `Need more infrastructure. Max sending capacity is ${r.theoretical_max_daily.toLocaleString()}/day` };
  }
  if (causeTypes.includes('infra_undercapped')) {
    return { category: 'raise_limits', detail: `Need to increase sending limits. Possible sending is ${r.theoretical_max_daily.toLocaleString()}/day` };
  }
  if (causeTypes.includes('campaign_caps_too_low')) {
    return { category: 'raise_caps', detail: 'Need to increase emails per day in campaign settings' };
  }
  return { category: 'unknown', detail: 'No clear bottleneck — investigate manually' };
}

function buildSlackBlocks(results: ClientResult[], _totalActive: number, briefDate: string, triggeredBy?: string): any[] {
  const groups: Record<string, ClientResult[]> = {};
  for (const r of results) {
    const { category } = classifyResult(r);
    if (!groups[category]) groups[category] = [];
    groups[category].push(r);
  }
  for (const cat in groups) {
    groups[cat].sort((a, b) => a.pct - b.pct);
  }

  const GROUP_DEFS = [
    { key: 'need_contacts', emoji: ':busts_in_silhouette:', title: 'Need more contacts' },
    { key: 'need_infra',    emoji: ':warning:',             title: 'Need more infrastructure' },
    { key: 'raise_limits',  emoji: ':wrench:',              title: 'Need to increase sending limits' },
    { key: 'raise_caps',    emoji: ':gear:',                title: 'Need to increase emails per day in campaign settings' },
    { key: 'unknown',       emoji: ':grey_question:',       title: 'Investigate manually' },
  ];

  const blocks: any[] = [];
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `🚨 Volume Diagnostic — ${briefDate}` },
  });
  const triggerCredit = triggeredBy ? ` · triggered by <@${triggeredBy}>` : '';
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: `_${results.length} active clients with sending below 90% of daily target${triggerCredit}_` },
  });

  for (const def of GROUP_DEFS) {
    const items = groups[def.key];
    if (!items || items.length === 0) continue;
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `${def.emoji} *${def.title}*` },
    });
    // Pack items into a section, chunking at 2800 chars
    const lines: string[] = [];
    for (const r of items) {
      const { detail } = classifyResult(r);
      const pct = r.pct.toFixed(0);
      lines.push(`• *${r.name}* — \`${r.today.toLocaleString()}/${r.target.toLocaleString()}\` (${pct}%) — ${detail}`);
    }
    let cur: string[] = [];
    let curLen = 0;
    for (const l of lines) {
      if (curLen + l.length + 1 > 2800) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: cur.join('\n') } });
        cur = [];
        curLen = 0;
      }
      cur.push(l);
      curLen += l.length + 1;
    }
    if (cur.length) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: cur.join('\n') } });
  }

  // Cap at 50 blocks per Slack limit
  if (blocks.length > 50) {
    blocks.length = 49;
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '_…truncated to fit Slack 50-block limit._' } });
  }

  return blocks;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const skipSlack = url.searchParams.get('skip_slack') === '1';
  const triggeredBy = url.searchParams.get('triggered_by') || '';
  const postToChannel = url.searchParams.get('post_to_channel') || '';
  const onlyHassan = url.searchParams.get('only_hassan') === '1';
  const onlyHussain = url.searchParams.get('only_hussain') === '1';

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const today = new Date().toISOString().slice(0, 10);
  const briefDate = today;

  try {
    // 1. Pull today's metrics joined to active client_registry
    const { data: rows, error } = await supabase
      .from('client_metrics')
      .select(`
        emails_scheduled_today,
        client_registry!inner(
          workspace_name,
          display_name,
          daily_sending_target,
          bison_workspace_id,
          bison_instance,
          is_active
        )
      `)
      .eq('metric_type', 'mtd')
      .eq('metric_date', today)
      .eq('client_registry.is_active', true)
      .limit(200);

    if (error) throw error;

    const shortfall: any[] = [];
    for (const r of rows || []) {
      const reg: any = (r as any).client_registry;
      const target = reg.daily_sending_target || 0;
      const todayCount = (r as any).emails_scheduled_today || 0;
      if (!target) continue;
      const pct = (todayCount / target) * 100;
      const name = reg.display_name || reg.workspace_name;
      if (NOT_LAUNCHED.has(name) || NOT_LAUNCHED.has(reg.workspace_name)) continue;
      if (pct >= 90) continue;
      shortfall.push({
        name,
        workspace_name: reg.workspace_name,
        bison_workspace_id: reg.bison_workspace_id,
        bison_instance: reg.bison_instance,
        target,
        today: todayCount,
        pct,
      });
    }

    console.log(`📊 ${shortfall.length} clients below 90% of target`);

    // 2. Diagnose each — sequentially to avoid Bison API rate limits + workspace context contention
    const results: ClientResult[] = [];
    for (let i = 0; i < shortfall.length; i++) {
      const c = shortfall[i];
      console.log(`  [${i + 1}/${shortfall.length}] ${c.name}`);
      try {
        const r = await diagnoseClient(c);
        results.push(r);
      } catch (e: any) {
        results.push({
          ...c,
          causes: [],
          connected_senders: 0,
          configured_daily_total: 0,
          theoretical_max_daily: 0,
          campaigns_audited: [],
          sendable_total: 0,
          sender_type_breakdown: { google: 0, microsoft: 0, unknown: 0 },
          error: e?.message || 'unknown',
        });
      }
      await new Promise(r => setTimeout(r, 600));
    }

    // 3. Build Slack message
    const blocks = buildSlackBlocks(results, (rows || []).length, briefDate, triggeredBy);

    // 4. Send to Slack.
    // Routing rules:
    //   post_to_channel  → post to the channel where /volume was run (used by slash command)
    //   only_hassan=1    → Hassan DM only (manual trigger)
    //   only_hussain=1   → Hussain DM only (testing)
    //   default          → Hassan DM + Hussain DM
    let channelTs: string | null = null;
    let hassanTs: string | null = null;
    let hussainTs: string | null = null;
    async function postTo(channel: string): Promise<string | null> {
      const r = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          channel,
          blocks,
          text: `Volume Diagnostic — ${briefDate}`,
        }),
      });
      const j = await r.json();
      if (!j.ok) {
        console.error(`Post error to ${channel}: ${j.error}`);
        return null;
      }
      return j.ts;
    }
    if (!skipSlack) {
      if (postToChannel) {
        channelTs = await postTo(postToChannel);
      } else {
        const sendHassan = !onlyHussain;
        const sendHussain = !onlyHassan;
        if (sendHassan) hassanTs = await postTo(HASSAN_DM_CHANNEL);
        if (sendHussain) hussainTs = await postTo(HUSSAIN_DM_CHANNEL);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      brief_date: briefDate,
      shortfall_count: shortfall.length,
      results: results.map(r => ({
        name: r.name,
        pct: r.pct,
        category: classifyResult(r).category,
        detail: classifyResult(r).detail,
      })),
      channel_ts: channelTs,
      hassan_ts: hassanTs,
      hussain_ts: hussainTs,
    }, null, 2), { headers: corsHeaders });
  } catch (e: any) {
    console.error('coo-volume-diagnostic error:', e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'unknown' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
