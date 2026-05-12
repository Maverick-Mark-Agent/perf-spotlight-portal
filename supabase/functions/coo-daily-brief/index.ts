// COO Daily Brief — runs at 8am Central Time (~6pm Pakistan).
//
// Pulls the last 24h of Slack messages from configured channels, sends them
// through Claude with the COO Brain context, gets a structured brief back,
// posts it as a DM to Hussain, and stores everything in coo_* tables.
//
// SAFE TO RUN MANUALLY anytime (idempotent on the brief side — each call
// produces a new brief; we use `brief_date` for the lookup key).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { COO_BRAIN_CONTEXT } from '../_shared/coo_brain_context.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SLACK_BOT_TOKEN = Deno.env.get('COO_SLACK_BOT_TOKEN')!;
const SLACK_DM_CHANNEL = Deno.env.get('COO_SLACK_DM_CHANNEL')!;
const TARGET_CHANNELS = (Deno.env.get('COO_TARGET_CHANNELS') || '').split(',').filter(Boolean);
const TARGET_CHANNEL_NAMES = (Deno.env.get('COO_TARGET_CHANNEL_NAMES') || '').split(',').filter(Boolean);
const SLACK_TEAM_DOMAIN = 'maverickmarketingllc'; // for permalink construction

// Brief generator uses Sonnet 4.6 — quality matters here, and brief volume is low (1/day)
const MODEL = Deno.env.get('COO_BRIEF_MODEL') || 'claude-sonnet-4-6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// Slack API helpers
async function slackGet(path: string): Promise<any> {
  const r = await fetch(`https://slack.com/api/${path}`, {
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
  });
  return r.json();
}

async function slackPost(path: string, body: any): Promise<any> {
  const r = await fetch(`https://slack.com/api/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });
  return r.json();
}

// Fetch the last `hoursBack` of messages from a channel, including replies in threads.
async function fetchChannelMessages(channelId: string, channelName: string, sinceTs: number) {
  const messages: any[] = [];
  let cursor = '';
  for (let i = 0; i < 5; i++) {
    // safety cap: 5 pages * 200 = 1000 msgs/channel
    const params = new URLSearchParams({
      channel: channelId,
      limit: '200',
      oldest: sinceTs.toFixed(6),
    });
    if (cursor) params.set('cursor', cursor);
    const r = await slackGet(`conversations.history?${params}`);
    if (!r.ok) {
      console.warn(`history error on ${channelName}: ${r.error}`);
      break;
    }
    for (const m of r.messages || []) {
      m.channel_id = channelId;
      m.channel_name = channelName;
      messages.push(m);
      // Pull thread replies if any
      if (m.thread_ts && m.reply_count && m.reply_count > 0) {
        const tr = await slackGet(`conversations.replies?channel=${channelId}&ts=${m.thread_ts}&limit=200`);
        if (tr.ok) {
          for (const reply of tr.messages || []) {
            if (reply.ts !== m.ts) {
              reply.channel_id = channelId;
              reply.channel_name = channelName;
              reply.is_thread_reply = true;
              messages.push(reply);
            }
          }
        }
      }
    }
    cursor = r.response_metadata?.next_cursor || '';
    if (!cursor) break;
  }
  return messages;
}

// Resolve user IDs in a batch so the transcript shows "Tommy:" instead of "U06R32KSG14:"
async function buildUserMap(userIds: Set<string>): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  // batch lookups via users.info (one at a time — Slack has no bulk lookup)
  for (const uid of userIds) {
    try {
      const r = await slackGet(`users.info?user=${uid}`);
      if (r.ok) {
        const u = r.user;
        map[uid] = u.real_name || u.profile?.display_name || u.name || uid;
      }
    } catch (e) {
      // ignore
    }
  }
  return map;
}

function buildTranscript(messages: any[], userMap: Record<string, string>): string {
  // Sort chronologically
  messages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
  const lines: string[] = [];
  for (const m of messages) {
    const text = (m.text || '').slice(0, 2000);
    if (!text.trim()) continue;
    const author = m.user ? userMap[m.user] || m.user : m.bot_profile?.name || 'bot';
    const date = new Date(parseFloat(m.ts) * 1000).toISOString().slice(11, 16);
    const channel = m.channel_name;
    const threadMarker = m.is_thread_reply ? '↳ ' : '';
    lines.push(`[${date} #${channel}] ${threadMarker}${author}: ${text}`);
  }
  return lines.join('\n');
}

async function callClaude(transcript: string): Promise<{ brief: any; usage: any }> {
  const userMessage = `Here is the last 24 hours of Slack activity across the channels I monitor:\n\n<transcript>\n${transcript}\n</transcript>\n\nGenerate the daily brief in the JSON format specified.`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system: [
        {
          type: 'text',
          text: COO_BRAIN_CONTEXT,
          cache_control: { type: 'ephemeral' }, // long-lived; cache it
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Anthropic error ${r.status}: ${err.slice(0, 500)}`);
  }
  const data = await r.json();
  const text = data.content?.[0]?.text || '';
  // Strip code fences if Claude wrapped JSON in ```
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  let brief;
  try {
    brief = JSON.parse(cleaned);
  } catch (e: any) {
    throw new Error(`Could not parse Claude JSON: ${e.message}. Raw: ${text.slice(0, 800)}`);
  }
  return { brief, usage: data.usage };
}

// Build a Slack permalink for a message
function permalink(channelId: string, ts: string): string {
  const tsNoDot = ts.replace('.', '');
  return `https://${SLACK_TEAM_DOMAIN}.slack.com/archives/${channelId}/p${tsNoDot}`;
}

function ownerEmoji(owner: string | null | undefined): string {
  if (!owner) return ':grey_question:';
  const o = owner.toLowerCase();
  if (o === 'me' || o === 'hussain') return ':bust_in_silhouette:';
  if (o === 'tommy') return ':crown:';
  if (o === 'sarah') return ':woman-tipping-hand:';
  if (o === 'hassan') return ':man-technologist:';
  if (o === 'davis') return ':man-technologist:';
  return ':busts_in_silhouette:';
}

function renderSlackBlocks(brief: any, channelMap: Record<string, string>, briefDate: string): any[] {
  const blocks: any[] = [];

  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `:brain: COO Brief — ${briefDate}` },
  });

  if (brief.summary) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `_${brief.summary}_` },
    });
  }
  blocks.push({ type: 'divider' });

  const sections: { key: string; title: string; emoji: string }[] = [
    { key: 'blockers',         title: 'Blockers',          emoji: ':rotating_light:' },
    { key: 'decisions_needed', title: 'Decisions needed',  emoji: ':thinking_face:' },
    { key: 'client_queries',   title: 'Client queries',    emoji: ':speech_balloon:' },
    { key: 'infra_alerts',     title: 'Infrastructure',    emoji: ':wrench:' },
    { key: 'my_followups',     title: 'My follow-ups',     emoji: ':bust_in_silhouette:' },
    { key: 'delegations',      title: 'Delegations',       emoji: ':busts_in_silhouette:' },
    { key: 'ideas_to_revisit', title: 'Ideas to revisit',  emoji: ':bulb:' },
  ];

  let totalItems = 0;
  for (const sec of sections) {
    const items = brief[sec.key] || [];
    if (!Array.isArray(items) || items.length === 0) continue;
    totalItems += items.length;

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `${sec.emoji} *${sec.title}* (${items.length})` },
    });

    // Pack items into a single section per group (Slack 50-block limit)
    const lines: string[] = [];
    for (const item of items) {
      const link = item.source_channel && item.source_ts
        ? `<${permalink(channelMap[item.source_channel] || item.source_channel, item.source_ts)}|↗>`
        : '';
      const ownerStr = item.owner ? ` ${ownerEmoji(item.owner)} _${item.owner}_` : '';
      const clientStr = item.client ? ` *${item.client}*` : '';
      const title = item.title || '(no title)';
      const detail = item.detail ? ` — ${item.detail}` : '';
      lines.push(`• ${title}${clientStr}${ownerStr}${detail} ${link}`);
    }
    // chunk to fit Slack's 3000-char text limit
    const chunks: string[] = [];
    let cur: string[] = [];
    let curLen = 0;
    for (const l of lines) {
      if (curLen + l.length + 1 > 2800) {
        chunks.push(cur.join('\n'));
        cur = [];
        curLen = 0;
      }
      cur.push(l);
      curLen += l.length + 1;
    }
    if (cur.length) chunks.push(cur.join('\n'));
    for (const ch of chunks) {
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text: ch } });
    }
  }

  // Wins section — plain text strings
  if (brief.wins && Array.isArray(brief.wins) && brief.wins.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `:tada: *Wins*\n${brief.wins.map((w: string) => `• ${w}`).join('\n')}` },
    });
  }

  if (totalItems === 0 && (!brief.wins || brief.wins.length === 0)) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '_Quiet day — nothing to surface._' },
    });
  }

  return blocks;
}

// Internal helper to call another Supabase Edge Function with the service-role key.
async function callSiblingFunction(name: string, queryString = ''): Promise<{ ok: boolean; data: any }> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}${queryString}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    const text = await r.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
    return { ok: r.ok, data };
  } catch (e: any) {
    return { ok: false, data: { error: e?.message || 'fetch_error' } };
  }
}

// Skip on weekends (Central Time). Saturday/Sunday is non-business at Maverick.
function isWeekendCentral(): boolean {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
  });
  const day = fmt.format(new Date());
  return day === 'Sat' || day === 'Sun';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Allow caller to override window via ?hours= for testing
  const url = new URL(req.url);
  const hoursBack = parseInt(url.searchParams.get('hours') || '24', 10);
  const skipSync = url.searchParams.get('skip_sync') === '1';
  const skipVolume = url.searchParams.get('skip_volume') === '1';
  const force = url.searchParams.get('force') === '1';
  const sinceMs = Date.now() - hoursBack * 60 * 60 * 1000;
  const sinceTs = sinceMs / 1000;

  // Weekend skip — silent return so cron firings don't error.
  if (!force && isWeekendCentral()) {
    return new Response(JSON.stringify({ ok: true, skipped: 'weekend' }), { headers: corsHeaders });
  }

  const briefDate = new Date().toISOString().slice(0, 10);
  console.log(`📋 Generating COO brief for ${briefDate}, last ${hoursBack}h`);

  // ── Pre-step 1: Sync today's KPI/volume metrics so the volume diagnostic
  //                 has fresh data. Skippable via ?skip_sync=1 for tests.
  if (!skipSync) {
    console.log('  ⏳ Syncing daily KPI metrics from Bison...');
    const syncStart = Date.now();
    const sync = await callSiblingFunction('sync-daily-kpi-metrics');
    console.log(`  ✅ Sync ${sync.ok ? 'OK' : 'FAILED'} in ${Date.now() - syncStart}ms`);
    if (!sync.ok) {
      console.warn('  ⚠ Sync failed but continuing — diagnostic will use stale data:', JSON.stringify(sync.data).slice(0, 300));
    }
  }

  // ── Pre-step 2: Run volume diagnostic + DM Hassan (and Hussain).
  if (!skipVolume) {
    console.log('  ⏳ Running volume diagnostic...');
    const volStart = Date.now();
    const vol = await callSiblingFunction('coo-volume-diagnostic');
    console.log(`  ✅ Volume diagnostic ${vol.ok ? 'OK' : 'FAILED'} in ${Date.now() - volStart}ms — shortfall=${vol.data?.shortfall_count ?? '?'}`);
  }

  try {
    // 1. Pull all messages from target channels in parallel
    const channelMap: Record<string, string> = {};
    for (let i = 0; i < TARGET_CHANNELS.length; i++) {
      channelMap[TARGET_CHANNEL_NAMES[i]] = TARGET_CHANNELS[i];
    }
    const allMessages: any[] = [];
    for (let i = 0; i < TARGET_CHANNELS.length; i++) {
      const msgs = await fetchChannelMessages(TARGET_CHANNELS[i], TARGET_CHANNEL_NAMES[i], sinceTs);
      console.log(`  #${TARGET_CHANNEL_NAMES[i]}: ${msgs.length} messages`);
      allMessages.push(...msgs);
    }

    // 2. Pull manual notes Hussain has DM'd to TopG since the last brief
    const { data: pendingNotes } = await supabase
      .from('coo_manual_notes')
      .select('id, note, slack_message_ts, created_at')
      .is('surfaced_at', null)
      .order('created_at', { ascending: true });
    if (pendingNotes && pendingNotes.length > 0) {
      console.log(`  + ${pendingNotes.length} unsurfaced manual notes`);
      // Inject as fake messages in a virtual channel
      for (const n of pendingNotes) {
        allMessages.push({
          ts: n.slack_message_ts || (new Date(n.created_at).getTime() / 1000).toFixed(6),
          user: 'U097J97AVU7', // Hussain
          text: `[manual note from Hussain via DM] ${n.note}`,
          channel_id: 'manual',
          channel_name: 'manual-notes',
        });
      }
    }

    if (allMessages.length === 0) {
      const emptyResp = { ok: true, message: 'no activity in window', briefDate };
      // Still post a "quiet day" DM so cron is observable
      await slackPost('chat.postMessage', {
        channel: SLACK_DM_CHANNEL,
        text: `:brain: COO Brief — ${briefDate}: _Quiet day, nothing to surface._`,
      });
      return new Response(JSON.stringify(emptyResp), { headers: corsHeaders });
    }

    // 3. Resolve user IDs
    const userIds = new Set<string>();
    for (const m of allMessages) {
      if (m.user) userIds.add(m.user);
    }
    const userMap = await buildUserMap(userIds);

    // 4. Build transcript
    const transcript = buildTranscript(allMessages, userMap);
    console.log(`  Transcript: ${transcript.length} chars`);

    // 5. Call Claude
    const { brief, usage } = await callClaude(transcript);
    console.log(`  ✅ Brief generated (${usage.input_tokens} in / ${usage.output_tokens} out)`);

    // 6. Post to Slack
    const blocks = renderSlackBlocks(brief, channelMap, briefDate);
    const dmResp = await slackPost('chat.postMessage', {
      channel: SLACK_DM_CHANNEL,
      blocks,
      text: `COO Brief — ${briefDate}`,
    });
    if (!dmResp.ok) {
      console.error(`Slack post error: ${dmResp.error}`);
    }
    const slackTs = dmResp.ts || null;

    // 7. Persist to DB
    const { data: briefRow, error: briefErr } = await supabase
      .from('coo_brief_history')
      .insert({
        brief_date: briefDate,
        brief_json: brief,
        source_transcript: transcript.slice(0, 100000), // cap to avoid bloat
        source_channels: TARGET_CHANNEL_NAMES,
        window_start: new Date(sinceMs).toISOString(),
        window_end: new Date().toISOString(),
        model: MODEL,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        slack_dm_ts: slackTs,
      })
      .select('id')
      .single();
    if (briefErr) console.error('briefErr:', briefErr.message);

    // 8. Persist tasks (one row per actionable item)
    const briefId = briefRow?.id;
    if (briefId) {
      const taskRows: any[] = [];
      const sectionsToTasks = [
        { key: 'client_queries', cat: 'client_query' },
        { key: 'blockers', cat: 'blocker' },
        { key: 'decisions_needed', cat: 'decision_needed' },
        { key: 'ideas_to_revisit', cat: 'idea' },
        { key: 'my_followups', cat: 'my_followup' },
        { key: 'delegations', cat: 'delegation' },
        { key: 'infra_alerts', cat: 'infra_alert' },
      ];
      for (const s of sectionsToTasks) {
        const items = brief[s.key] || [];
        for (const it of items) {
          taskRows.push({
            category: s.cat,
            title: it.title || '(untitled)',
            description: it.detail || null,
            owner: it.owner || null,
            workspace_name: it.client || null,
            source_channel_name: it.source_channel || null,
            source_channel_id: channelMap[it.source_channel] || null,
            source_message_ts: it.source_ts || null,
            source_message_url: it.source_ts && channelMap[it.source_channel]
              ? permalink(channelMap[it.source_channel], it.source_ts)
              : null,
            brief_id: briefId,
          });
        }
      }
      if (taskRows.length > 0) {
        const { error: taskErr } = await supabase.from('coo_tasks').insert(taskRows);
        if (taskErr) console.error('taskErr:', taskErr.message);
      }
    }

    // 9. Mark manual notes as surfaced
    if (pendingNotes && pendingNotes.length > 0 && briefId) {
      const ids = pendingNotes.map((n: any) => n.id);
      await supabase
        .from('coo_manual_notes')
        .update({ surfaced_at: new Date().toISOString(), surfaced_in_brief_id: briefId })
        .in('id', ids);
    }

    return new Response(JSON.stringify({
      ok: true,
      briefDate,
      messages_processed: allMessages.length,
      brief_summary: brief.summary,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      slack_dm_ts: slackTs,
    }, null, 2), { headers: corsHeaders });
  } catch (e: any) {
    console.error('coo-daily-brief error:', e);
    // Best-effort: notify Hussain that the brief failed
    try {
      await slackPost('chat.postMessage', {
        channel: SLACK_DM_CHANNEL,
        text: `:warning: COO Brief failed for ${briefDate}: \`${(e?.message || 'unknown').slice(0, 500)}\``,
      });
    } catch {}
    // Persist the error
    await supabase.from('coo_brief_history').insert({
      brief_date: briefDate,
      brief_json: {},
      source_channels: TARGET_CHANNEL_NAMES,
      window_start: new Date(sinceMs).toISOString(),
      window_end: new Date().toISOString(),
      error_message: e?.message || 'unknown',
    });
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'unknown' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
