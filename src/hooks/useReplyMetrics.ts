/**
 * Hook for fetching reply rate and interested lead metrics
 * 
 * Data Sources:
 * - Total replies: lead_replies table (all replies)
 * - Interested leads: client_leads where interested=true (SOURCE OF TRUTH)
 * - Emails sent: client_metrics table (emails_sent_mtd, emails_sent_today)
 * 
 * DO NOT use lead_replies.is_interested or sentiment for interested counts
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DailyReplyTrend {
  date: string;
  totalReplies: number;
  interestedLeads: number;
  interestedRate: number; // percentage
}

export interface ClientReplyBreakdown {
  clientName: string;
  workspaceName: string;
  totalReplies: number;
  interested: number;
  interestedPercentage: number;
  emailsSent: number;
  replyRate: number; // replies/emails sent %
  status: 'good' | 'warning' | 'critical'; // 🟢 >= 0.3%, 🟡 0.2-0.3%, 🔴 < 0.2%
}

export interface InfrastructureAlert {
  clientName: string;
  workspaceName: string;
  replyRate: number;
  emailsSent: number;
  date: string;
}

interface UseReplyMetricsReturn {
  dailyTrend: DailyReplyTrend[];
  clientBreakdown: ClientReplyBreakdown[];
  alerts: InfrastructureAlert[];
  loading: boolean;
  error: string | null;
  fetchData: (startDate: string, endDate: string, clientFilter?: string) => Promise<void>;
  getFilteredDailyTrend: (clientName: string) => DailyReplyTrend[];
}

export function useReplyMetrics(): UseReplyMetricsReturn {
  const [dailyTrend, setDailyTrend] = useState<DailyReplyTrend[]>([]);
  const [clientBreakdown, setClientBreakdown] = useState<ClientReplyBreakdown[]>([]);
  const [alerts, setAlerts] = useState<InfrastructureAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawRepliesData, setRawRepliesData] = useState<any[]>([]);
  const [rawInterestedData, setRawInterestedData] = useState<any[]>([]);

  const fetchData = useCallback(async (startDate: string, endDate: string, clientFilter?: string) => {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch total replies from lead_replies grouped by date and workspace
      const { data: repliesData, error: repliesError } = await supabase
        .from('lead_replies')
        .select('reply_date, workspace_name')
        .gte('reply_date', startDate)
        .lte('reply_date', endDate)
        .order('reply_date', { ascending: true });

      if (repliesError) throw repliesError;

      // 2. Fetch interested leads from client_leads where interested=true
      const { data: interestedData, error: interestedError } = await supabase
        .from('client_leads')
        .select('created_at, workspace_name')
        .eq('interested', true)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });

      if (interestedError) throw interestedError;

      // Store raw data for client filtering
      setRawRepliesData(repliesData || []);
      setRawInterestedData(interestedData || []);

      // 3. Fetch client_metrics for email volume context (MTD data)
      const { data: metricsData, error: metricsError } = await supabase
        .from('client_metrics')
        .select(`
          workspace_name,
          metric_date,
          emails_sent_mtd,
          emails_sent_today,
          client_registry!inner(
            display_name,
            is_active,
            kpi_dashboard_enabled
          )
        `)
        .eq('metric_type', 'mtd')
        .gte('metric_date', startDate)
        .lte('metric_date', endDate)
        .eq('client_registry.is_active', true)
        .eq('client_registry.kpi_dashboard_enabled', true);

      if (metricsError) throw metricsError;

      // Process daily trend data
      const dailyReplyMap = new Map<string, Map<string, number>>();
      const dailyInterestedMap = new Map<string, Map<string, number>>();

      // Group replies by date and workspace
      (repliesData || []).forEach(reply => {
        const date = reply.reply_date.split('T')[0]; // Extract date part
        const workspace = reply.workspace_name || 'Unknown';
        
        if (!dailyReplyMap.has(date)) {
          dailyReplyMap.set(date, new Map());
        }
        const workspaceMap = dailyReplyMap.get(date)!;
        workspaceMap.set(workspace, (workspaceMap.get(workspace) || 0) + 1);
      });

      // Group interested leads by date and workspace
      (interestedData || []).forEach(lead => {
        const date = lead.created_at.split('T')[0]; // Extract date part
        const workspace = lead.workspace_name || 'Unknown';
        
        if (!dailyInterestedMap.has(date)) {
          dailyInterestedMap.set(date, new Map());
        }
        const workspaceMap = dailyInterestedMap.get(date)!;
        workspaceMap.set(workspace, (workspaceMap.get(workspace) || 0) + 1);
      });

      // Build daily trend (aggregate across all clients)
      const allDates = new Set([...dailyReplyMap.keys(), ...dailyInterestedMap.keys()]);
      const trendData: DailyReplyTrend[] = Array.from(allDates)
        .sort()
        .map(date => {
          const replyMap = dailyReplyMap.get(date) || new Map();
          const interestedMap = dailyInterestedMap.get(date) || new Map();
          
          const totalReplies = Array.from(replyMap.values()).reduce((sum, val) => sum + val, 0);
          const interestedLeads = Array.from(interestedMap.values()).reduce((sum, val) => sum + val, 0);
          const interestedRate = totalReplies > 0 ? (interestedLeads / totalReplies) * 100 : 0;

          return {
            date,
            totalReplies,
            interestedLeads,
            interestedRate,
          };
        });

      setDailyTrend(trendData);

      // Build client breakdown (current month totals)
      const clientMap = new Map<string, {
        workspaceName: string;
        displayName: string;
        totalReplies: number;
        interested: number;
        emailsSent: number;
        emailsSentToday: number;
      }>();

      // Aggregate replies by client
      (repliesData || []).forEach(reply => {
        const workspace = reply.workspace_name || 'Unknown';
        if (!clientMap.has(workspace)) {
          clientMap.set(workspace, {
            workspaceName: workspace,
            displayName: workspace,
            totalReplies: 0,
            interested: 0,
            emailsSent: 0,
            emailsSentToday: 0,
          });
        }
        clientMap.get(workspace)!.totalReplies++;
      });

      // Aggregate interested leads by client
      (interestedData || []).forEach(lead => {
        const workspace = lead.workspace_name || 'Unknown';
        if (!clientMap.has(workspace)) {
          clientMap.set(workspace, {
            workspaceName: workspace,
            displayName: workspace,
            totalReplies: 0,
            interested: 0,
            emailsSent: 0,
            emailsSentToday: 0,
          });
        }
        clientMap.get(workspace)!.interested++;
      });

      // Add email volume data from client_metrics (get latest MTD value per client)
      const latestMetricsMap = new Map<string, any>();
      (metricsData || []).forEach(metric => {
        const workspace = metric.workspace_name;
        const existing = latestMetricsMap.get(workspace);
        
        // Keep the latest metric_date for each workspace
        if (!existing || metric.metric_date > existing.metric_date) {
          latestMetricsMap.set(workspace, metric);
        }
      });

      // Merge metrics into client map
      latestMetricsMap.forEach((metric, workspace) => {
        if (clientMap.has(workspace)) {
          const client = clientMap.get(workspace)!;
          client.emailsSent = metric.emails_sent_mtd || 0;
          client.emailsSentToday = metric.emails_sent_today || 0;
          client.displayName = (metric.client_registry as any)?.display_name || workspace;
        } else {
          // Client sent emails but has no replies
          clientMap.set(workspace, {
            workspaceName: workspace,
            displayName: (metric.client_registry as any)?.display_name || workspace,
            totalReplies: 0,
            interested: 0,
            emailsSent: metric.emails_sent_mtd || 0,
            emailsSentToday: metric.emails_sent_today || 0,
          });
        }
      });

      // Build client breakdown with calculated metrics
      const breakdown: ClientReplyBreakdown[] = Array.from(clientMap.values()).map(client => {
        const interestedPercentage = client.totalReplies > 0
          ? (client.interested / client.totalReplies) * 100
          : 0;
        
        const replyRate = client.emailsSent > 0
          ? (client.totalReplies / client.emailsSent) * 100
          : 0;

        let status: 'good' | 'warning' | 'critical' = 'critical';
        if (replyRate >= 0.3) status = 'good';
        else if (replyRate >= 0.2) status = 'warning';

        return {
          clientName: client.displayName,
          workspaceName: client.workspaceName,
          totalReplies: client.totalReplies,
          interested: client.interested,
          interestedPercentage,
          emailsSent: client.emailsSent,
          replyRate,
          status,
        };
      });

      setClientBreakdown(breakdown);

      // Build infrastructure alerts (for today only)
      const today = new Date().toISOString().split('T')[0];
      const todayAlerts: InfrastructureAlert[] = [];

      latestMetricsMap.forEach((metric, workspace) => {
        const emailsSentToday = metric.emails_sent_today || 0;
        
        // Only alert if > 100 emails sent (avoid false alerts on low-volume days)
        if (emailsSentToday > 100) {
          const client = clientMap.get(workspace);
          const repliesToday = dailyReplyMap.get(today)?.get(workspace) || 0;
          const replyRate = (repliesToday / emailsSentToday) * 100;

          if (replyRate < 0.3) {
            todayAlerts.push({
              clientName: (metric.client_registry as any)?.display_name || workspace,
              workspaceName: workspace,
              replyRate,
              emailsSent: emailsSentToday,
              date: today,
            });
          }
        }
      });

      setAlerts(todayAlerts);

    } catch (err: any) {
      console.error('[useReplyMetrics] Error:', err);
      setError(err.message || 'Failed to fetch reply metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  const getFilteredDailyTrend = useCallback((clientName: string): DailyReplyTrend[] => {
    if (clientName === 'all') {
      return dailyTrend;
    }

    // Filter raw data by client name
    const filteredReplies = rawRepliesData.filter(r => r.workspace_name === clientName || 
                                                      clientBreakdown.find(c => c.clientName === clientName)?.workspaceName === r.workspace_name);
    const filteredInterested = rawInterestedData.filter(r => r.workspace_name === clientName ||
                                                           clientBreakdown.find(c => c.clientName === clientName)?.workspaceName === r.workspace_name);

    // Rebuild daily trend for this client
    const dailyReplyMap = new Map<string, number>();
    const dailyInterestedMap = new Map<string, number>();

    filteredReplies.forEach(reply => {
      const date = reply.reply_date.split('T')[0];
      dailyReplyMap.set(date, (dailyReplyMap.get(date) || 0) + 1);
    });

    filteredInterested.forEach(lead => {
      const date = lead.created_at.split('T')[0];
      dailyInterestedMap.set(date, (dailyInterestedMap.get(date) || 0) + 1);
    });

    const allDates = new Set([...dailyReplyMap.keys(), ...dailyInterestedMap.keys()]);
    return Array.from(allDates)
      .sort()
      .map(date => {
        const totalReplies = dailyReplyMap.get(date) || 0;
        const interestedLeads = dailyInterestedMap.get(date) || 0;
        const interestedRate = totalReplies > 0 ? (interestedLeads / totalReplies) * 100 : 0;

        return {
          date,
          totalReplies,
          interestedLeads,
          interestedRate,
        };
      });
  }, [dailyTrend, rawRepliesData, rawInterestedData, clientBreakdown]);

  return {
    dailyTrend,
    clientBreakdown,
    alerts,
    loading,
    error,
    fetchData,
    getFilteredDailyTrend,
  };
}
