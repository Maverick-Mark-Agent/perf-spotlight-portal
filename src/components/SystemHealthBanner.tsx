// SystemHealthBanner: runs 4 invariant checks live against existing tables
// and surfaces problems immediately. No cron, no extra tables — just queries
// the same tables the dashboard already has, every 60 seconds.
//
// Invariants this checks (last 24h window):
//   1. STUCK_LEADS — interested leads >30 min old with no sent_reply and
//      no queue entry. The Pass 4 failsafe should catch these within 2 min.
//   2. PHANTOM_VERIFICATIONS — sent_replies with verified_at set but no
//      bison_outbound_reply_id and sent_by != 'bison_direct'. These lie.
//   3. WRONGFUL_CANCELLATIONS — queue rows cancelled as "active_conversation"
//      where the matched sent_replies row has no proof of real delivery.
//   4. SILENT_FAILURES — queue rows with status='failed' but no failed
//      sent_replies row — the error doesn't surface on the dashboard.

import { useEffect, useState } from 'react';
import { AlertTriangle, AlertOctagon, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Issue {
  name:        string;
  severity:    'warning' | 'critical';
  count:       number;
  description: string;
}

async function runHealthChecks(): Promise<Issue[]> {
  const issues: Issue[] = [];
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since30m = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  // 1. STUCK_LEADS
  const { data: oldLeads } = await supabase
    .from('lead_replies')
    .select('id')
    .eq('is_interested', true)
    .gte('reply_date', since24h)
    .lte('reply_date', since30m);

  if (oldLeads && oldLeads.length > 0) {
    const ids = oldLeads.map((l: any) => l.id);
    const [{ data: sr }, { data: q }] = await Promise.all([
      supabase.from('sent_replies').select('reply_uuid').in('reply_uuid', ids),
      supabase.from('auto_reply_queue').select('reply_uuid').in('reply_uuid', ids),
    ]);
    const srSet = new Set((sr || []).map((r: any) => r.reply_uuid));
    const qSet  = new Set((q  || []).map((r: any) => r.reply_uuid));
    const stuck = oldLeads.filter((l: any) => !srSet.has(l.id) && !qSet.has(l.id));
    if (stuck.length > 0) {
      issues.push({
        name:        'Stuck leads',
        severity:    'critical',
        count:       stuck.length,
        description: `${stuck.length} interested lead${stuck.length === 1 ? '' : 's'} older than 30 min with no queue entry — the failsafe should have caught these`,
      });
    }
  }

  // 2. PHANTOM_VERIFICATIONS
  const { data: phantom } = await supabase
    .from('sent_replies')
    .select('id')
    .not('verified_at', 'is', null)
    .is('bison_outbound_reply_id', null)
    .neq('sent_by', 'bison_direct')
    .gte('created_at', since24h)
    .limit(100);
  if (phantom && phantom.length > 0) {
    issues.push({
      name:        'Phantom verifications',
      severity:    'critical',
      count:       phantom.length,
      description: `${phantom.length} repl${phantom.length === 1 ? 'y' : 'ies'} marked "delivered" with no Bison confirmation — may be showing false "Replied" status`,
    });
  }

  // 3. WRONGFUL_CANCELLATIONS — check most-recent cancellations that pointed
  // at a sent_replies row with no proof of real delivery.
  const { data: cancelled } = await supabase
    .from('auto_reply_queue')
    .select('reply_uuid, error_message')
    .eq('status', 'cancelled')
    .like('error_message', '%active conversation%')
    .gte('created_at', since24h)
    .limit(300);
  if (cancelled && cancelled.length > 0) {
    const srIds = cancelled
      .map((c: any) => {
        const m = c.error_message?.match(/sent_replies\.id=(\d+)/);
        return m ? parseInt(m[1]) : null;
      })
      .filter(Boolean) as number[];
    if (srIds.length > 0) {
      const { data: srRows } = await supabase
        .from('sent_replies')
        .select('id, bison_outbound_reply_id, sent_by')
        .in('id', srIds);
      const srMap = new Map<number, any>();
      (srRows || []).forEach((r: any) => srMap.set(r.id, r));
      const wrongful = cancelled.filter((c: any) => {
        const m = c.error_message?.match(/sent_replies\.id=(\d+)/);
        if (!m) return false;
        const sr = srMap.get(parseInt(m[1]));
        if (!sr) return false;
        return !sr.bison_outbound_reply_id && sr.sent_by !== 'bison_direct';
      });
      if (wrongful.length > 0) {
        issues.push({
          name:        'Wrongful cancellations',
          severity:    'critical',
          count:       wrongful.length,
          description: `${wrongful.length} lead${wrongful.length === 1 ? '' : 's'} cancelled against an unverified sent_replies row — these may not actually have been replied to in Bison`,
        });
      }
    }
  }

  // 4. SILENT_FAILURES
  const { data: failedQ } = await supabase
    .from('auto_reply_queue')
    .select('reply_uuid')
    .eq('status', 'failed')
    .gte('created_at', since24h)
    .limit(200);
  if (failedQ && failedQ.length > 0) {
    const ids = failedQ.map((q: any) => q.reply_uuid);
    const { data: sr } = await supabase
      .from('sent_replies')
      .select('reply_uuid, status')
      .in('reply_uuid', ids);
    const srMap = new Map<string, string>();
    (sr || []).forEach((r: any) => srMap.set(r.reply_uuid, r.status));
    const silent = failedQ.filter((q: any) => srMap.get(q.reply_uuid) !== 'failed');
    if (silent.length > 0) {
      issues.push({
        name:        'Silent failures',
        severity:    'warning',
        count:       silent.length,
        description: `${silent.length} send failure${silent.length === 1 ? '' : 's'} not showing on the dashboard — error not surfaced to the user`,
      });
    }
  }

  return issues;
}

export function SystemHealthBanner() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      // Skip if the tab isn't visible — no point polling when nobody's looking.
      // This keeps DB load down when users have the dashboard open in background tabs.
      if (document.visibilityState !== 'visible') return;
      runHealthChecks()
        .then(r => { if (!cancelled) setIssues(r); })
        .catch(() => {}); // never crash the dashboard if a check fails
    };
    tick();
    // Run every 5 min — the auto-reply pipeline can't go from healthy → broken
    // faster than that, so polling more often just wastes DB queries.
    const t = setInterval(tick, 5 * 60_000);
    // Also re-check the moment the tab regains focus, so issues surface fast
    // when you switch back to the dashboard.
    document.addEventListener('visibilitychange', tick);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  if (issues.length === 0) return null;

  const hasCritical = issues.some(i => i.severity === 'critical');
  const bg = hasCritical ? 'bg-red-50 border-red-300' : 'bg-yellow-50 border-yellow-300';
  const fg = hasCritical ? 'text-red-800' : 'text-yellow-800';
  const Icon = hasCritical ? AlertOctagon : AlertTriangle;
  const total = issues.reduce((sum, i) => sum + i.count, 0);

  return (
    <div className={`border-b ${bg} ${fg}`}>
      <div className="max-w-6xl mx-auto px-6 py-3">
        <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm font-semibold">
              {total} integrity issue{total === 1 ? '' : 's'} detected across {issues.length} check{issues.length === 1 ? '' : 's'}
            </span>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {expanded && (
          <div className="mt-3 space-y-2 text-xs">
            {issues.map(i => (
              <div key={i.name} className="flex items-start gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${i.severity === 'critical' ? 'bg-red-200 text-red-900' : 'bg-yellow-200 text-yellow-900'}`}>
                  {i.severity}
                </span>
                <span><strong>{i.name}:</strong> {i.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
