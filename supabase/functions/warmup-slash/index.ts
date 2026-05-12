// /warmup Slack slash command handler.
//
// Slack calls this when anyone types `/warmup`.
// 1. Verifies the request signature (HMAC-SHA256)
// 2. ACKs Slack immediately with an ephemeral message
// 3. Fires enable-warmup in the background — it runs across all workspaces
//    and posts the results back to the channel when done.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SLACK_SIGNING_SECRET     = Deno.env.get('COO_SLACK_SIGNING_SECRET')!;

async function verifySlackSignature(req: Request, rawBody: string): Promise<boolean> {
  const ts  = req.headers.get('x-slack-request-timestamp');
  const sig = req.headers.get('x-slack-signature');
  if (!ts || !sig) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - parseInt(ts, 10)) > 300) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(SLACK_SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, enc.encode(`v0:${ts}:${rawBody}`));
  const computed = 'v0=' + Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  if (computed.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  const rawBody = await req.text();

  if (!await verifySlackSignature(req, rawBody)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const params       = new URLSearchParams(rawBody);
  const userName     = params.get('user_name') || 'someone';
  const responseUrl  = params.get('response_url') || '';

  console.log(`/warmup triggered by ${userName}`);

  // Fire enable-warmup in the background — passes response_url so it can
  // post results back to Slack when done (~1-2 min).
  fetch(`${SUPABASE_URL}/functions/v1/enable-warmup`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ response_url: responseUrl }),
  }).catch((e) => console.error(`enable-warmup fire failed: ${e?.message}`));

  // ACK Slack immediately
  return new Response(JSON.stringify({
    response_type: 'ephemeral',
    text: ':hourglass_flowing_sand: Re-enabling warmup across all workspaces — results will post here in ~1-2 minutes.',
  }), { headers: { 'Content-Type': 'application/json' } });
});
