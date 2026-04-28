// Reconciliation cron — backstop for sent replies that didn't get verified
// via the manual_email_sent webhook.
//
// PASS 1 — Dashboard sends not yet verified:
//   For sent_replies rows with status='sent' and verified_at IS NULL, check
//   Bison's conversation thread for an outbound message and stamp verified_at.
//
// PASS 2 — Direct Bison replies (no sent_replies row at all):
//   For interested lead_replies from the last 7 days with no sent_replies row,
//   check the Bison thread for any outbound message. If found, create a
//   verified sent_replies row so the card flips to REPLIED on the dashboard.
//   This catches every case where the agent replied directly in Bison UI
//   without going through the dashboard.
//
// PASS 3 — Failed rows where Bison actually replied:
//   For sent_replies rows with status='failed', check if Bison has an
//   outbound message in the conversation thread after the lead's reply_date.
//   If found, update the row to status='sent' + verified_at so the card
//   flips from FAILED to REPLIED. Covers cases where a dashboard send failed
//   but the agent then replied directly in Bison.
//
// Triggered by pg_cron every 2 minutes. Idempotent.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAVERICK_BISON_API_KEY = Deno.env.get('MAVERICK_BISON_API_KEY');
const LONG_RUN_BISON_API_KEY = Deno.env.get('LONG_RUN_BISON_API_KEY');

const MAVERICK_BASE = 'https://send.maverickmarketingllc.com/api';
const LONGRUN_BASE = 'https://send.longrun.agency/api';

const MIN_AGE_SECONDS = 30;
const MAX_AGE_HOURS = 24 * 7;
const MAX_ROWS_PER_RUN = 30;     // pass 1 cap
const MAX_DIRECT_PER_RUN = 20;  // pass 2 cap — Bison API calls are expensive
const MAX_FAILED_PER_RUN = 15;  // pass 3 cap

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

async function fetchConversationThread(baseUrl: string, apiKey: string, bisonReplyId: number) {
  const resp = await fetch(`${baseUrl}/replies/${bisonReplyId}/conversation-thread`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
  });
  if (!resp.ok) return null;
  const body = await resp.json();
  return body?.data;
}

function findOutboundMessage(thread: any, afterMs: number) {
  const newer: any[] = thread?.newer_messages || [];
  // Also check all_messages in case newer_messages is empty
  const all: any[] = thread?.all_messages || [];
  const messages = newer.length > 0 ? newer : all;
  return messages.find((m: any) => {
    const isOutgoing = m?.type === 'Outgoing Email' || m?.folder === 'Sent';
    if (!isOutgoing) return false;
    const candidateDate = m?.date_received || m?.created_at;
    if (!candidateDate) return false;
    return new Date(candidateDate).getTime() >= afterMs;
  }) ?? null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startedAt = Date.now();
  const cutoffOld = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();
  const cutoffRecent = new Date(Date.now() - MIN_AGE_SECONDS * 1000).toISOString();

  // ── PASS 1: dashboard sends not yet verified ──────────────────────────────
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
    .gte('sent_at', cutoffOld)
    .lte('sent_at', cutoffRecent)
    .order('sent_at', { ascending: true })
    .limit(MAX_ROWS_PER_RUN);

  if (candidatesError) {
    console.error('Pass 1 fetch failed:', candidatesError);
    return new Response(JSON.stringify({ success: false, error: candidatesError.message }), { status: 500, headers: corsHeaders });
  }

  // ── PASS 2: interested leads with no sent_replies row at all ─────────────
  // Find recently-interested leads that have no sent_replies entry yet.
  // We use a NOT IN subquery pattern via two separate queries and JS diff.
  const { data: recentLeads } = await supabase
    .from('lead_replies')
    .select('id, workspace_name, lead_email, first_name, last_name, bison_reply_numeric_id, reply_date')
    .eq('is_interested', true)
    .gte('reply_date', cutoffOld)
    .lte('reply_date', cutoffRecent)
    .not('bison_reply_numeric_id', 'is', null)
    .order('reply_date', { ascending: false })
    .limit(200) as any;

  const { data: existingSentUuids } = await supabase
    .from('sent_replies')
    .select('reply_uuid')
    .gte('created_at', cutoffOld) as any;

  const sentUuidSet = new Set<string>((existingSentUuids || []).map((r: any) => r.reply_uuid));

  // Leads with NO sent_replies row at all — these may have been replied to directly in Bison
  const unrepliedLeads = ((recentLeads || []) as any[])
    .filter((l: any) => !sentUuidSet.has(l.id))
    .slice(0, MAX_DIRECT_PER_RUN);

  // Pull all workspace configs needed across both passes
  const allWorkspaceNames = Array.from(new Set([
    ...(candidates || []).map((c: any) => c.workspace_name),
    ...unrepliedLeads.map((l: any) => l.workspace_name),
  ]));

  const { data: workspaces } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_api_key, bison_instance')
    .in('workspace_name', allWorkspaceNames);

  const wsByName: Record<string, any> = {};
  for (const w of workspaces || []) wsByName[w.workspace_name] = w;

  let p1Verified = 0, p1Missing = 0, p1Errors = 0;
  let p2Created = 0, p2Missing = 0, p2Errors = 0;
  const details: any[] = [];

  // ── Pass 1 loop ───────────────────────────────────────────────────────────
  for (const row of (candidates || []) as any[]) {
    const ws = wsByName[row.workspace_name];
    const leadReply: any = Array.isArray(row.lead_reply) ? row.lead_reply[0] : row.lead_reply;
    const bisonReplyId = leadReply?.bison_reply_numeric_id;

    if (!ws || !bisonReplyId) {
      p1Missing++;
      details.push({ pass: 1, id: row.id, status: 'skipped', reason: 'missing workspace or bison_reply_numeric_id' });
      continue;
    }

    const isLongRun = ws.bison_instance === 'Long Run';
    const baseUrl = isLongRun ? LONGRUN_BASE : MAVERICK_BASE;
    const apiKey = ws.bison_api_key || (isLongRun ? LONG_RUN_BISON_API_KEY : MAVERICK_BISON_API_KEY);
    if (!apiKey) {
      p1Missing++;
      details.push({ pass: 1, id: row.id, status: 'skipped', reason: 'no api key' });
      continue;
    }

    try {
      const thread = await fetchConversationThread(baseUrl, apiKey, bisonReplyId);
      if (!thread) {
        p1Errors++;
        details.push({ pass: 1, id: row.id, status: 'error', reason: 'Bison API error' });
        continue;
      }

      const sentAtMs = new Date(row.sent_at).getTime() - 30_000;
      const outbound = findOutboundMessage(thread, sentAtMs);

      if (!outbound) {
        p1Missing++;
        details.push({ pass: 1, id: row.id, status: 'unmatched', reason: 'no outgoing message in thread' });
        continue;
      }

      const verifiedAt = outbound.date_received || outbound.created_at || new Date().toISOString();
      const updates: any = { verified_at: verifiedAt };
      if (outbound.id != null) updates.bison_outbound_reply_id = outbound.id;
      if (outbound.uuid) updates.bison_outbound_reply_uuid = outbound.uuid;

      const { error: updErr } = await supabase.from('sent_replies').update(updates).eq('id', row.id);
      if (updErr) {
        p1Errors++;
        details.push({ pass: 1, id: row.id, status: 'error', reason: updErr.message });
      } else {
        p1Verified++;
        details.push({ pass: 1, id: row.id, status: 'verified', outbound_reply_id: outbound.id });
      }
    } catch (e: any) {
      p1Errors++;
      details.push({ pass: 1, id: row.id, status: 'error', reason: e?.message || 'unknown' });
    }
  }

  // ── Pass 2 loop — direct Bison replies ────────────────────────────────────
  for (const lead of unrepliedLeads) {
    const ws = wsByName[lead.workspace_name];
    if (!ws || !lead.bison_reply_numeric_id) {
      p2Missing++;
      details.push({ pass: 2, reply_uuid: lead.id, status: 'skipped', reason: 'missing workspace or bison_reply_numeric_id' });
      continue;
    }

    const isLongRun = ws.bison_instance === 'Long Run';
    const baseUrl = isLongRun ? LONGRUN_BASE : MAVERICK_BASE;
    const apiKey = ws.bison_api_key || (isLongRun ? LONG_RUN_BISON_API_KEY : MAVERICK_BISON_API_KEY);
    if (!apiKey) {
      p2Missing++;
      details.push({ pass: 2, reply_uuid: lead.id, status: 'skipped', reason: 'no api key' });
      continue;
    }

    try {
      const thread = await fetchConversationThread(baseUrl, apiKey, lead.bison_reply_numeric_id);
      if (!thread) {
        p2Errors++;
        details.push({ pass: 2, reply_uuid: lead.id, status: 'error', reason: 'Bison API error' });
        continue;
      }

      // For direct Bison replies we check for ANY outbound after the lead's reply_date
      const replyDateMs = new Date(lead.reply_date).getTime();
      const outbound = findOutboundMessage(thread, replyDateMs);

      if (!outbound) {
        p2Missing++;
        details.push({ pass: 2, reply_uuid: lead.id, status: 'no_outbound', lead_email: lead.lead_email });
        continue;
      }

      // Found an outbound reply — create a verified sent_replies row
      const verifiedAt = outbound.date_received || outbound.created_at || new Date().toISOString();
      const insertPayload: any = {
        reply_uuid: lead.id,
        workspace_name: lead.workspace_name,
        lead_name: [lead.first_name, lead.last_name].filter(Boolean).join(' ') || null,
        lead_email: lead.lead_email,
        generated_reply_text: '(sent directly via Bison)',
        status: 'sent',
        sent_at: verifiedAt,
        verified_at: verifiedAt,
        sent_by: 'bison_direct',
        retry_count: 0,
      };
      if (outbound.id != null) insertPayload.bison_outbound_reply_id = outbound.id;
      if (outbound.uuid) insertPayload.bison_outbound_reply_uuid = outbound.uuid;

      const { error: insertErr } = await supabase
        .from('sent_replies')
        .insert(insertPayload);

      if (insertErr) {
        // Conflict = row was created between our check and insert — that's fine
        if (insertErr.code === '23505') {
          details.push({ pass: 2, reply_uuid: lead.id, status: 'already_exists' });
        } else {
          p2Errors++;
          details.push({ pass: 2, reply_uuid: lead.id, status: 'error', reason: insertErr.message });
        }
      } else {
        p2Created++;
        details.push({ pass: 2, reply_uuid: lead.id, status: 'created', lead_email: lead.lead_email, workspace: lead.workspace_name });
      }
    } catch (e: any) {
      p2Errors++;
      details.push({ pass: 2, reply_uuid: lead.id, status: 'error', reason: e?.message || 'unknown' });
    }
  }

  // ── PASS 3: failed rows where Bison actually replied ─────────────────────
  // Find sent_replies rows with status='failed' where the conversation thread
  // has an outbound message after the lead's reply_date. Update to verified.
  const { data: failedRows } = await supabase
    .from('sent_replies')
    .select(`
      id,
      reply_uuid,
      workspace_name,
      lead_email,
      lead_reply:lead_replies!sent_replies_reply_uuid_fkey (
        bison_reply_numeric_id,
        reply_date
      )
    `)
    .eq('status', 'failed')
    .is('verified_at', null)
    .gte('sent_at', cutoffOld)
    .order('sent_at', { ascending: false })
    .limit(MAX_FAILED_PER_RUN) as any;

  // Load any workspace configs not already in wsByName (Pass 3 may have new ones)
  const p3WorkspaceNames = ((failedRows as any[]) || [])
    .map((r: any) => r.workspace_name)
    .filter((n: string) => n && !wsByName[n]);
  if (p3WorkspaceNames.length > 0) {
    const { data: extraWs } = await supabase
      .from('client_registry')
      .select('workspace_name, bison_api_key, bison_instance')
      .in('workspace_name', p3WorkspaceNames);
    for (const w of extraWs || []) wsByName[w.workspace_name] = w;
  }

  const failedToCheck = ((failedRows as any[]) || []).filter((r: any) => {
    const lr: any = Array.isArray(r.lead_reply) ? r.lead_reply[0] : r.lead_reply;
    return lr?.bison_reply_numeric_id && wsByName[r.workspace_name];
  });

  let p3Fixed = 0, p3Missing = 0, p3Errors = 0;

  for (const row of failedToCheck) {
    const ws = wsByName[row.workspace_name];
    const leadReply: any = Array.isArray(row.lead_reply) ? row.lead_reply[0] : row.lead_reply;
    const bisonReplyId = leadReply?.bison_reply_numeric_id;
    const replyDate = leadReply?.reply_date;

    const isLongRun = ws.bison_instance === 'Long Run';
    const baseUrl = isLongRun ? LONGRUN_BASE : MAVERICK_BASE;
    const apiKey = ws.bison_api_key || (isLongRun ? LONG_RUN_BISON_API_KEY : MAVERICK_BISON_API_KEY);
    if (!apiKey) {
      p3Missing++;
      details.push({ pass: 3, id: row.id, status: 'skipped', reason: 'no api key' });
      continue;
    }

    try {
      const thread = await fetchConversationThread(baseUrl, apiKey, bisonReplyId);
      if (!thread) {
        p3Errors++;
        details.push({ pass: 3, id: row.id, status: 'error', reason: 'Bison API error' });
        continue;
      }

      const replyDateMs = replyDate ? new Date(replyDate).getTime() : 0;
      const outbound = findOutboundMessage(thread, replyDateMs);

      if (!outbound) {
        p3Missing++;
        details.push({ pass: 3, id: row.id, status: 'no_outbound', lead_email: row.lead_email });
        continue;
      }

      const verifiedAt = outbound.date_received || outbound.created_at || new Date().toISOString();
      const updates: any = {
        status: 'sent',
        verified_at: verifiedAt,
        error_message: null,
        sent_by: 'bison_direct',
        generated_reply_text: '(sent directly via Bison)',
      };
      if (outbound.id != null) updates.bison_outbound_reply_id = outbound.id;
      if (outbound.uuid) updates.bison_outbound_reply_uuid = outbound.uuid;

      const { error: updErr } = await supabase.from('sent_replies').update(updates).eq('id', row.id);
      if (updErr) {
        p3Errors++;
        details.push({ pass: 3, id: row.id, status: 'error', reason: updErr.message });
      } else {
        p3Fixed++;
        details.push({ pass: 3, id: row.id, status: 'fixed', lead_email: row.lead_email, workspace: row.workspace_name });
      }
    } catch (e: any) {
      p3Errors++;
      details.push({ pass: 3, id: row.id, status: 'error', reason: e?.message || 'unknown' });
    }
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`✅ Reconcile done in ${elapsedMs}ms — p1: verified=${p1Verified} missing=${p1Missing} errors=${p1Errors} | p2: created=${p2Created} missing=${p2Missing} errors=${p2Errors} | p3: fixed=${p3Fixed} missing=${p3Missing} errors=${p3Errors}`);

  return new Response(JSON.stringify({
    success: true,
    elapsed_ms: elapsedMs,
    pass1: { candidates: candidates?.length ?? 0, verified: p1Verified, missing: p1Missing, errors: p1Errors },
    pass2: { candidates: unrepliedLeads.length, created: p2Created, missing: p2Missing, errors: p2Errors },
    pass3: { candidates: failedToCheck.length, fixed: p3Fixed, missing: p3Missing, errors: p3Errors },
    details,
  }), { status: 200, headers: corsHeaders });
});
