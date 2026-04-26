// Reconciliation cron — backstop for sent replies that didn't get verified
// via the manual_email_sent webhook.
//
// Bison's webhook delivery is non-deterministic for replies sent via
// POST /api/replies/{id}/reply: sometimes manual_email_sent fires within
// seconds, sometimes it never fires at all. This function catches the
// "never fires" case by actively polling Bison's conversation-thread API
// for any sent_replies row that is status='sent' but verified_at IS NULL
// and is older than 30 seconds (giving the webhook a chance first).
//
// For each unverified row:
//   1. Look up the lead reply's bison_reply_numeric_id from lead_replies
//   2. Fetch GET /api/replies/{lead_reply_id}/conversation-thread
//   3. Search data.newer_messages for an outbound message
//      ("Outgoing Email") with date_received >= sent_at
//   4. If found, stamp verified_at + bison_outbound_reply_id + uuid on
//      sent_replies
//
// Triggered by pg_cron every 2 minutes. Idempotent — already-verified
// rows are excluded by the WHERE clause.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAVERICK_BISON_API_KEY = Deno.env.get('MAVERICK_BISON_API_KEY');
const LONG_RUN_BISON_API_KEY = Deno.env.get('LONG_RUN_BISON_API_KEY');

const MAVERICK_BASE = 'https://send.maverickmarketingllc.com/api';
const LONGRUN_BASE = 'https://send.longrun.agency/api';

// Don't try to reconcile rows newer than this — they may still be in the
// natural webhook delivery window and we don't want to race the webhook.
const MIN_AGE_SECONDS = 30;
// Don't try to reconcile rows older than this — leave very old rows alone
// (they likely won't be findable anyway, and historical pre-deploy rows
// were already legacy-stamped).
const MAX_AGE_HOURS = 6;
// Per-cron-run cap so a backlog doesn't blow up Bison's rate limit.
const MAX_ROWS_PER_RUN = 50;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startedAt = Date.now();

  // Fetch unverified sent rows. We need lead_replies.bison_reply_numeric_id
  // to call /api/replies/{id}/conversation-thread on Bison.
  const { data: candidates, error: candidatesError } = await supabase
    .from('sent_replies')
    .select(`
      id,
      reply_uuid,
      workspace_name,
      lead_email,
      sent_at,
      lead_reply:lead_replies!sent_replies_reply_uuid_fkey (
        bison_reply_numeric_id
      )
    `)
    .eq('status', 'sent')
    .is('verified_at', null)
    .gte('sent_at', new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString())
    .lte('sent_at', new Date(Date.now() - MIN_AGE_SECONDS * 1000).toISOString())
    .order('sent_at', { ascending: true })
    .limit(MAX_ROWS_PER_RUN);

  if (candidatesError) {
    console.error('Failed to fetch candidates:', candidatesError);
    return new Response(JSON.stringify({ success: false, error: candidatesError.message }), { status: 500, headers: corsHeaders });
  }

  if (!candidates || candidates.length === 0) {
    return new Response(JSON.stringify({ success: true, message: 'no unverified rows to reconcile', candidates: 0 }), { status: 200, headers: corsHeaders });
  }

  // Pull workspace configs in one shot (fewer queries than per-row lookup).
  const workspaceNames = Array.from(new Set(candidates.map((c: any) => c.workspace_name)));
  const { data: workspaces } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_api_key, bison_instance')
    .in('workspace_name', workspaceNames);

  const wsByName: Record<string, any> = {};
  for (const w of workspaces || []) wsByName[w.workspace_name] = w;

  let verified = 0;
  let stillMissing = 0;
  let errors = 0;
  const details: any[] = [];

  for (const row of candidates as any[]) {
    const ws = wsByName[row.workspace_name];
    const leadReply: any = Array.isArray(row.lead_reply) ? row.lead_reply[0] : row.lead_reply;
    const leadReplyNumericId = leadReply?.bison_reply_numeric_id;

    if (!ws || !leadReplyNumericId) {
      stillMissing++;
      details.push({ id: row.id, status: 'skipped', reason: 'missing workspace or lead reply numeric id' });
      continue;
    }

    const isLongRun = ws.bison_instance === 'Long Run';
    const baseUrl = isLongRun ? LONGRUN_BASE : MAVERICK_BASE;
    const apiKey = ws.bison_api_key || (isLongRun ? LONG_RUN_BISON_API_KEY : MAVERICK_BISON_API_KEY);
    if (!apiKey) {
      stillMissing++;
      details.push({ id: row.id, status: 'skipped', reason: 'no api key' });
      continue;
    }

    try {
      const resp = await fetch(`${baseUrl}/replies/${leadReplyNumericId}/conversation-thread`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
      });
      if (!resp.ok) {
        errors++;
        details.push({ id: row.id, status: 'error', reason: `Bison ${resp.status}` });
        continue;
      }

      const body = await resp.json();
      const newer: any[] = body?.data?.newer_messages || [];

      // Find an outbound message that was created at or after our sent_at.
      // Bison creates the outbound reply within ~1s of our API call, so a
      // small safety window lets us match correctly even with clock drift.
      const sentAtMs = new Date(row.sent_at).getTime() - 30_000;
      const outbound = newer.find((m: any) => {
        const isOutgoing = m?.type === 'Outgoing Email' || m?.folder === 'Sent';
        if (!isOutgoing) return false;
        const candidateDate = m?.date_received || m?.created_at;
        if (!candidateDate) return false;
        return new Date(candidateDate).getTime() >= sentAtMs;
      });

      if (!outbound) {
        stillMissing++;
        details.push({ id: row.id, status: 'unmatched', reason: 'no outgoing message in thread' });
        continue;
      }

      // Stamp verified_at + outbound IDs.
      const verifiedAt = outbound.date_received || outbound.created_at || new Date().toISOString();
      const updates: any = { verified_at: verifiedAt };
      if (outbound.id != null) updates.bison_outbound_reply_id = outbound.id;
      if (outbound.uuid) updates.bison_outbound_reply_uuid = outbound.uuid;

      const { error: updErr } = await supabase
        .from('sent_replies')
        .update(updates)
        .eq('id', row.id);

      if (updErr) {
        errors++;
        details.push({ id: row.id, status: 'error', reason: updErr.message });
      } else {
        verified++;
        details.push({ id: row.id, status: 'verified', outbound_reply_id: outbound.id });
      }
    } catch (e: any) {
      errors++;
      details.push({ id: row.id, status: 'error', reason: e?.message || 'unknown' });
    }
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`✅ Reconcile finished in ${elapsedMs}ms — verified=${verified}, still_missing=${stillMissing}, errors=${errors}, candidates=${candidates.length}`);

  return new Response(JSON.stringify({
    success: true,
    candidates: candidates.length,
    verified,
    still_missing: stillMissing,
    errors,
    elapsed_ms: elapsedMs,
    details,
  }), { status: 200, headers: corsHeaders });
});
