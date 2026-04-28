import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type DailyRecapRow = {
  workspaceName: string;
  displayName: string;
  billingType: 'per_lead' | 'retainer';
  pricePerLead: number;
  emailsSent: number;
  repliesReceived: number;
  interestedLeads: number;
  expectedRevenue: number;
};

export type DailyRecapTotals = {
  emails: number;
  replies: number;
  leads: number;
  revenue: number;
};

export type DailyRecapData = {
  perLead: DailyRecapRow[];
  retainer: DailyRecapRow[];
  totals: { perLead: DailyRecapTotals; retainer: DailyRecapTotals };
  freshnessUtc: string | null;
};

const CST_TZ = 'America/Chicago';

function ymdInCst(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function previousDay(yyyyMmDd: string): string {
  const d = new Date(`${yyyyMmDd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// UTC window with 8h padding either side — guarantees we capture every row whose
// CST/CDT timestamp falls on the target calendar day, even across DST transitions.
function utcWindow(yyyyMmDd: string): { startIso: string; endIso: string } {
  const start = new Date(`${yyyyMmDd}T00:00:00Z`);
  start.setUTCHours(start.getUTCHours() - 8);
  const end = new Date(`${yyyyMmDd}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  end.setUTCHours(end.getUTCHours() + 8);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function useDailyRecap(targetDate: Date | undefined) {
  const targetYmd = targetDate ? ymdInCst(targetDate) : undefined;

  return useQuery({
    queryKey: ['daily-recap', targetYmd],
    enabled: !!targetYmd,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<DailyRecapData> => {
      const target = targetYmd!;
      const prior = previousDay(target);
      const { startIso, endIso } = utcWindow(target);

      const [registryRes, metricsRes, repliesRes, leadsRes] = await Promise.all([
        supabase
          .from('client_registry')
          .select('workspace_name, display_name, billing_type, price_per_lead, is_active')
          .eq('is_active', true),
        supabase
          .from('client_metrics')
          .select('workspace_name, metric_date, emails_sent_mtd, updated_at')
          .in('metric_date', [target, prior]),
        supabase
          .from('lead_replies')
          .select('workspace_name, reply_date')
          .gte('reply_date', startIso)
          .lt('reply_date', endIso),
        supabase
          .from('client_leads')
          .select('workspace_name, interested_at')
          .eq('interested', true)
          .is('deleted_at', null)
          .gte('interested_at', startIso)
          .lt('interested_at', endIso),
      ]);

      if (registryRes.error) throw registryRes.error;
      if (metricsRes.error) throw metricsRes.error;
      if (repliesRes.error) throw repliesRes.error;
      if (leadsRes.error) throw leadsRes.error;

      const targetMtd = new Map<string, number>();
      const priorMtd = new Map<string, number>();
      let freshness: string | null = null;
      for (const r of metricsRes.data || []) {
        if (r.metric_date === target) {
          targetMtd.set(r.workspace_name, r.emails_sent_mtd ?? 0);
          if (r.updated_at && (!freshness || r.updated_at > freshness)) {
            freshness = r.updated_at;
          }
        } else if (r.metric_date === prior) {
          priorMtd.set(r.workspace_name, r.emails_sent_mtd ?? 0);
        }
      }

      const replyCounts = new Map<string, number>();
      for (const r of repliesRes.data || []) {
        if (r.reply_date && ymdInCst(new Date(r.reply_date)) === target) {
          replyCounts.set(r.workspace_name, (replyCounts.get(r.workspace_name) ?? 0) + 1);
        }
      }

      const leadCounts = new Map<string, number>();
      for (const r of leadsRes.data || []) {
        if (r.interested_at && ymdInCst(new Date(r.interested_at)) === target) {
          leadCounts.set(r.workspace_name, (leadCounts.get(r.workspace_name) ?? 0) + 1);
        }
      }

      const buildRow = (reg: {
        workspace_name: string;
        display_name: string | null;
        billing_type: string | null;
        price_per_lead: number | string | null;
      }): DailyRecapRow => {
        const ws = reg.workspace_name;
        const sent = Math.max((targetMtd.get(ws) ?? 0) - (priorMtd.get(ws) ?? 0), 0);
        const replies = replyCounts.get(ws) ?? 0;
        const leads = leadCounts.get(ws) ?? 0;
        const price = Number(reg.price_per_lead ?? 0);
        const billingType: 'per_lead' | 'retainer' =
          reg.billing_type === 'retainer' ? 'retainer' : 'per_lead';
        return {
          workspaceName: ws,
          displayName: reg.display_name ?? ws,
          billingType,
          pricePerLead: price,
          emailsSent: sent,
          repliesReceived: replies,
          interestedLeads: leads,
          expectedRevenue: price * leads,
        };
      };

      const allRows = (registryRes.data || []).map(buildRow);
      const perLead = allRows
        .filter((r) => r.billingType === 'per_lead')
        .sort((a, b) => b.emailsSent - a.emailsSent);
      const retainer = allRows
        .filter((r) => r.billingType === 'retainer')
        .sort((a, b) => b.emailsSent - a.emailsSent);

      const totalsFor = (rows: DailyRecapRow[]): DailyRecapTotals => ({
        emails: rows.reduce((s, r) => s + r.emailsSent, 0),
        replies: rows.reduce((s, r) => s + r.repliesReceived, 0),
        leads: rows.reduce((s, r) => s + r.interestedLeads, 0),
        revenue: rows.reduce((s, r) => s + r.expectedRevenue, 0),
      });

      return {
        perLead,
        retainer,
        totals: { perLead: totalsFor(perLead), retainer: totalsFor(retainer) },
        freshnessUtc: freshness,
      };
    },
  });
}
