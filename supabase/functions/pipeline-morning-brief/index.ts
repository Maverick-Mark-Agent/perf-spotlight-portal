// Daily pipeline health brief — runs every morning at 9am UTC.
// Posts a clean digest to COO_SLACK_DM_CHANNEL covering the last 24h:
//   • Sends: succeeded / failed / pending breakdown
//   • Failed sends by workspace (so you know who needs attention)
//   • Cron health: confirms both jobs are scheduled
//   • Any leads stuck in queue right now

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY         = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DM_WEBHOOK          = Deno.env.get('COO_SLACK_DM_CHANNEL');       // channel ID
const BOT_TOKEN           = Deno.env.get('COO_SLACK_BOT_TOKEN');
const ALERTS_WEBHOOK      = Deno.env.get('AI_REPLY_ALERTS_SLACK_WEBHOOK_URL');
const GLOBAL_WEBHOOK      = Deno.env.get('GLOBAL_SLACK_WEBHOOK_URL');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

async function postSlack(text: string, blocks: any[]) {
  // Try bot token + channel ID first, fall back to webhook
  if (BOT_TOKEN && DM_WEBHOOK) {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${BOT_TOKEN}` },
      body: JSON.stringify({ channel: DM_WEBHOOK, text, blocks }),
    }).catch(() => {});
  } else if (ALERTS_WEBHOOK) {
    await fetch(ALERTS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, blocks }),
    }).catch(() => {});
  } else if (GLOBAL_WEBHOOK) {
    await fetch(GLOBAL_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, blocks }),
    }).catch(() => {});
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // ── Gather data ──────────────────────────────────────────────────────────
  const [
    { data: sentRows },
    { data: queueRows },
    { data: stuckRows },
  ] = await Promise.all([
    supabase.from('sent_replies')
      .select('id, workspace_name, status, sent_at, verified_at, error_message')
      .gte('created_at', since24h),
    supabase.from('auto_reply_queue')
      .select('id, workspace_name, status, created_at, updated_at')
      .gte('created_at', since24h),
    supabase.from('auto_reply_queue')
      .select('id, workspace_name, status, created_at')
      .in('status', ['pending', 'processing']),
  ]);

  const now = Date.now();

  // sent_replies breakdown
  const verified = (sentRows || []).filter(r => r.verified_at);
  const unverified = (sentRows || []).filter(r => r.status === 'sent' && !r.verified_at);
  const failed    = (sentRows || []).filter(r => r.status === 'failed');

  // Failed by workspace
  const failedByWs: Record<string, number> = {};
  for (const r of failed) {
    failedByWs[r.workspace_name] = (failedByWs[r.workspace_name] || 0) + 1;
  }

  // queue breakdown
  const qSent     = (queueRows || []).filter(r => r.status === 'auto_sent').length;
  const qReview   = (queueRows || []).filter(r => r.status === 'review_required').length;
  const qCancelled= (queueRows || []).filter(r => r.status === 'cancelled').length;
  const qFailed   = (queueRows || []).filter(r => r.status === 'failed').length;

  // Stuck right now (pending/processing >5 min)
  const stuckLong = (stuckRows || []).filter(r => {
    const age = (now - new Date(r.created_at).getTime()) / 60_000;
    return age > 5;
  });

  // ── Build message ────────────────────────────────────────────────────────
  const hasProblems = failed.length > 0 || stuckLong.length > 0;
  const emoji = hasProblems ? '⚠️' : '✅';

  const failedSection = failed.length > 0
    ? Object.entries(failedByWs)
        .sort((a, b) => b[1] - a[1])
        .map(([ws, n]) => `• ${ws}: ${n} failed send${n > 1 ? 's' : ''}`)
        .join('\n')
    : '✅ None';

  const stuckSection = stuckLong.length > 0
    ? stuckLong.map(r => {
        const age = Math.round((now - new Date(r.created_at).getTime()) / 60_000);
        return `• ${r.workspace_name} — ${age}min in ${r.status}`;
      }).join('\n')
    : '✅ None';

  const unverifiedSection = unverified.length > 0
    ? `⚠️ ${unverified.length} send${unverified.length > 1 ? 's' : ''} still awaiting Bison confirmation`
    : '✅ All sends confirmed by Bison';

  const text = `${emoji} Pipeline daily brief — last 24h`;

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} Auto-Reply Pipeline — Daily Brief` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Verified sends:*\n${verified.length}` },
        { type: 'mrkdwn', text: `*Failed sends:*\n${failed.length > 0 ? `⚠️ ${failed.length}` : '0'}` },
        { type: 'mrkdwn', text: `*Auto-sent:*\n${qSent}` },
        { type: 'mrkdwn', text: `*Sent to review:*\n${qReview}` },
        { type: 'mrkdwn', text: `*Cancelled (1-reply rule):*\n${qCancelled}` },
        { type: 'mrkdwn', text: `*Queue failed:*\n${qFailed > 0 ? `⚠️ ${qFailed}` : '0'}` },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Failed sends by workspace:*\n${failedSection}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Stuck in queue right now:*\n${stuckSection}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Bison delivery:*\n${unverifiedSection}` },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Generated at <!date^${Math.floor(now/1000)}^{date_short} {time}|${new Date().toISOString()}>` }],
    },
  ];

  await postSlack(text, blocks);

  return new Response(JSON.stringify({
    success: true,
    summary: { verified: verified.length, failed: failed.length, stuck: stuckLong.length, qSent, qReview, qCancelled },
  }), { headers: corsHeaders });
});
