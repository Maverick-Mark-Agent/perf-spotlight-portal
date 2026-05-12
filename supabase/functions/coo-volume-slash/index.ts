// /volume slash command handler.
//
// Slack calls this when anyone in Maverick types `/volume`. We:
//   1. Verify the request signature (HMAC-SHA256 with COO_SLACK_SIGNING_SECRET)
//   2. ACK Slack with an ephemeral "Running…" message within 3 seconds
//   3. Fire `coo-volume-diagnostic` in the background (does sync + diagnose
//      + DMs Hassan).
//   4. Return immediately so Slack doesn't time out.
//
// The diagnostic itself takes ~5 min and posts results directly to Hassan's
// DM via chat.postMessage when finished.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SLACK_SIGNING_SECRET = Deno.env.get('COO_SLACK_SIGNING_SECRET')!;

// Verify Slack request via HMAC-SHA256. Returns true if valid.
async function verifySlackSignature(req: Request, rawBody: string): Promise<boolean> {
  const ts = req.headers.get('x-slack-request-timestamp');
  const sig = req.headers.get('x-slack-signature');
  if (!ts || !sig) return false;
  // Reject requests older than 5 minutes (replay protection)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(ts, 10)) > 60 * 5) return false;

  const baseString = `v0:${ts}:${rawBody}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SLACK_SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, enc.encode(baseString));
  const computed = 'v0=' + Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  // Constant-time compare
  if (computed.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('POST only', { status: 405 });
  }

  const rawBody = await req.text();

  // Step 1: signature verification
  const valid = await verifySlackSignature(req, rawBody);
  if (!valid) {
    console.error('Invalid Slack signature');
    return new Response('Invalid signature', { status: 401 });
  }

  // Step 2: parse the form-urlencoded body Slack sends
  const params = new URLSearchParams(rawBody);
  const userId = params.get('user_id') || '';
  const userName = params.get('user_name') || 'someone';
  const command = params.get('command') || '';
  const channelId = params.get('channel_id') || '';

  console.log(`📥 ${command} triggered by ${userName} (${userId}) in channel ${channelId}`);

  // Step 3: kick off the diagnostic in the background. We do NOT await — fire
  // and forget. The diagnostic posts results to the channel where /volume was run.
  const diagnosticUrl = `${SUPABASE_URL}/functions/v1/coo-volume-diagnostic?post_to_channel=${encodeURIComponent(channelId)}&triggered_by=${encodeURIComponent(userId)}`;
  fetch(diagnosticUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  }).catch((e) => console.error(`Background fire-and-forget failed: ${e?.message}`));

  // Step 4: ACK Slack immediately. Ephemeral so only the triggering user sees it.
  return new Response(JSON.stringify({
    response_type: 'ephemeral',
    text: ':hourglass_flowing_sand: Running volume diagnostic — results will post here in ~5 minutes.',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
