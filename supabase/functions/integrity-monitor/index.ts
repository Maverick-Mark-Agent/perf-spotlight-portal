// integrity-monitor: runs every 15 minutes via pg_cron.
//
// Checks 4 invariants the auto-reply pipeline must always satisfy and writes
// results to system_health_checks. The dashboard reads the latest row per
// check and renders a red banner if any check has severity='critical' or
// severity='warning'.
//
// Invariants:
//   1. PHANTOM_VERIFICATIONS — sent_replies rows with verified_at set but no
//      bison_outbound_reply_id and sent_by != 'bison_direct'. These are
//      lying rows that say "we replied" when we have no proof. The bug we
//      fixed today. If this ever resurfaces, the banner alerts immediately.
//
//   2. STUCK_LEADS — interested leads >30 min old, no sent_replies row, no
//      auto_reply_queue row. The Pass 4 failsafe should catch these within
//      2 minutes; if any exist after 30 min, the failsafe is broken.
//
//   3. SILENT_FAILURES — auto_reply_queue rows with status='failed' that
//      have no corresponding sent_replies row showing the error. The
//      dashboard relies on sent_replies for the failed state, so silent
//      failures hide from users.
//
//   4. WRONGFUL_CANCELLATIONS — auto_reply_queue rows cancelled with the
//      "active_conversation_thread" reason whose matched sent_replies row
//      has no bison_outbound_reply_id and sent_by != 'bison_direct'.
//      Tripwire for the bug we just fixed.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

interface CheckResult {
  check_name:   string;
  severity:     'ok' | 'warning' | 'critical';
  issue_count:  number;
  description:  string;
  affected_ids: any;
  details:      any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startedAt = Date.now();
  const since24h  = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since30m  = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const results: CheckResult[] = [];

  // ── CHECK 1: PHANTOM_VERIFICATIONS ────────────────────────────────────────
  {
    const { data, error } = await supabase
      .from('sent_replies')
      .select('id, reply_uuid, workspace_name, lead_email, verified_at, sent_by')
      .not('verified_at', 'is', null)
      .is('bison_outbound_reply_id', null)
      .neq('sent_by', 'bison_direct')
      .gte('created_at', since24h)
      .limit(100);

    const count = data?.length ?? 0;
    results.push({
      check_name:   'phantom_verifications',
      severity:     error ? 'critical' : count === 0 ? 'ok' : 'critical',
      issue_count:  count,
      description:  count === 0
        ? 'All verified sent_replies have proof of delivery'
        : `${count} sent_replies rows are marked verified but have no bison_outbound_reply_id — possible false "Replied" status on dashboard`,
      affected_ids: data?.slice(0, 25).map((r: any) => r.id) ?? [],
      details:      error ? { error: error.message } : { sample: data?.slice(0, 5) },
    });
  }

  // ── CHECK 2: STUCK_LEADS ──────────────────────────────────────────────────
  {
    const { data: leads } = await supabase
      .from('lead_replies')
      .select('id, workspace_name, lead_email, reply_date')
      .eq('is_interested', true)
      .lte('reply_date', since30m)  // older than 30 min
      .gte('reply_date', since24h)  // newer than 24h
      .limit(500);

    let stuck: any[] = [];
    if (leads?.length) {
      const ids = leads.map((l: any) => l.id);
      const [{ data: sr }, { data: q }] = await Promise.all([
        supabase.from('sent_replies').select('reply_uuid').in('reply_uuid', ids),
        supabase.from('auto_reply_queue').select('reply_uuid').in('reply_uuid', ids),
      ]);
      const srSet = new Set((sr || []).map((r: any) => r.reply_uuid));
      const qSet  = new Set((q  || []).map((r: any) => r.reply_uuid));
      stuck = leads.filter((l: any) => !srSet.has(l.id) && !qSet.has(l.id));
    }

    results.push({
      check_name:   'stuck_leads',
      severity:     stuck.length === 0 ? 'ok' : 'critical',
      issue_count:  stuck.length,
      description:  stuck.length === 0
        ? 'Every interested lead has been processed or queued'
        : `${stuck.length} interested leads have no sent_reply and no queue entry after 30+ minutes — Pass 4 failsafe is broken`,
      affected_ids: stuck.slice(0, 25).map((l: any) => l.id),
      details:      { sample: stuck.slice(0, 5) },
    });
  }

  // ── CHECK 3: SILENT_FAILURES ──────────────────────────────────────────────
  {
    const { data: failedQueue } = await supabase
      .from('auto_reply_queue')
      .select('reply_uuid, workspace_name, error_message')
      .eq('status', 'failed')
      .gte('created_at', since24h)
      .limit(500);

    let silent: any[] = [];
    if (failedQueue?.length) {
      const ids = failedQueue.map((q: any) => q.reply_uuid);
      const { data: sr } = await supabase
        .from('sent_replies')
        .select('reply_uuid, status')
        .in('reply_uuid', ids);
      const srMap = new Map<string, string>();
      (sr || []).forEach((r: any) => srMap.set(r.reply_uuid, r.status));
      silent = failedQueue.filter((q: any) => {
        const s = srMap.get(q.reply_uuid);
        // Need a 'failed' sent_replies row so the dashboard shows the error.
        return s !== 'failed';
      });
    }

    results.push({
      check_name:   'silent_failures',
      severity:     silent.length === 0 ? 'ok' : 'warning',
      issue_count:  silent.length,
      description:  silent.length === 0
        ? 'All send failures are surfacing as errors on the dashboard'
        : `${silent.length} queue failures have no failed sent_reply row — errors are not appearing on the dashboard`,
      affected_ids: silent.slice(0, 25).map((q: any) => q.reply_uuid),
      details:      { sample: silent.slice(0, 5) },
    });
  }

  // ── CHECK 4: WRONGFUL_CANCELLATIONS ──────────────────────────────────────
  {
    const { data: cancelled } = await supabase
      .from('auto_reply_queue')
      .select('reply_uuid, workspace_name, error_message')
      .eq('status', 'cancelled')
      .like('error_message', '%active conversation%')
      .gte('created_at', since24h)
      .limit(500);

    let wrongful: any[] = [];
    if (cancelled?.length) {
      // Parse matched sent_replies.id out of each error message and check it
      const srIds = cancelled
        .map((c: any) => {
          const m = c.error_message?.match(/sent_replies\.id=(\d+)/);
          return m ? parseInt(m[1]) : null;
        })
        .filter(Boolean) as number[];

      if (srIds.length) {
        const { data: srRows } = await supabase
          .from('sent_replies')
          .select('id, bison_outbound_reply_id, sent_by')
          .in('id', srIds);
        const srMap = new Map<number, any>();
        (srRows || []).forEach((r: any) => srMap.set(r.id, r));

        wrongful = cancelled.filter((c: any) => {
          const m = c.error_message?.match(/sent_replies\.id=(\d+)/);
          if (!m) return false;
          const sr = srMap.get(parseInt(m[1]));
          if (!sr) return false;
          // wrongful if matched row has no proof of real reply
          return !sr.bison_outbound_reply_id && sr.sent_by !== 'bison_direct';
        });
      }
    }

    results.push({
      check_name:   'wrongful_cancellations',
      severity:     wrongful.length === 0 ? 'ok' : 'critical',
      issue_count:  wrongful.length,
      description:  wrongful.length === 0
        ? 'All cancellations are backed by a confirmed Bison reply'
        : `${wrongful.length} leads cancelled against a sent_replies row with no proof of actual delivery — these leads need re-processing`,
      affected_ids: wrongful.slice(0, 25).map((c: any) => c.reply_uuid),
      details:      { sample: wrongful.slice(0, 5) },
    });
  }

  // ── Persist all results ──────────────────────────────────────────────────
  const { error: insertErr } = await supabase.from('system_health_checks').insert(results);
  if (insertErr) {
    console.error('Failed to write health checks:', insertErr.message);
  }

  const elapsedMs = Date.now() - startedAt;
  const totalIssues = results.reduce((sum, r) => sum + r.issue_count, 0);
  console.log(`✅ integrity-monitor done in ${elapsedMs}ms — ${totalIssues} issues across ${results.length} checks`);

  return new Response(JSON.stringify({
    success: true,
    elapsed_ms: elapsedMs,
    total_issues: totalIssues,
    results,
  }), { status: 200, headers: corsHeaders });
});
