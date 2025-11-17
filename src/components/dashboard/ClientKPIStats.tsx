import { useEffect, useState } from "react";
import { KPICard } from "./KPICard";
import { Target, TrendingUp, Users, Award, Calendar, Zap, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ClientKPIStatsProps {
  workspaceName: string;
  totalLeads: number;
  wonLeads: number;
  newLeads: number;
  totalPremium?: number;
}

interface WorkspaceAnalytics {
  leadsGenerated: number;
  projectedReplies: number;
  leadsTarget: number;
  repliesTarget: number;
  monthlyKPI: number;
  currentProgress: number;
  repliesProgress: number;
  positiveRepliesLast30Days: number;
  positiveRepliesLast7Days: number;
  positiveRepliesCurrentMonth: number;
}

export const ClientKPIStats = ({ workspaceName, totalLeads, wonLeads, newLeads, totalPremium = 0 }: ClientKPIStatsProps) => {
  const [analytics, setAnalytics] = useState<WorkspaceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [workspaceName]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      console.log(`[ClientKPIStats] Fetching analytics for workspace: "${workspaceName}"`);

      // First, get display_name from client_registry to help with matching
      const { data: registryData, error: registryError } = await supabase
        .from('client_registry')
        .select('workspace_name, display_name, monthly_kpi_target')
        .eq('workspace_name', workspaceName)
        .single();

      const displayName = registryData?.display_name || workspaceName;
      const monthlyKPIFromRegistry = registryData?.monthly_kpi_target || 0;

      console.log(`[ClientKPIStats] Registry lookup - workspace_name: "${workspaceName}", display_name: "${displayName}"`);

      // Fetch from hybrid-workspace-analytics
      const { data, error } = await supabase.functions.invoke('hybrid-workspace-analytics', {
        body: { timestamp: Date.now() }
      });

      // Log available workspace names from Edge Function for debugging
      if (data?.clients && data.clients.length > 0) {
        console.log(`[ClientKPIStats] Edge Function returned ${data.clients.length} workspaces:`, 
          data.clients.map((c: any) => c.name).slice(0, 10)
        );
      } else {
        console.log(`[ClientKPIStats] Edge Function returned no clients data`);
      }

      if (error) {
        console.warn('[ClientKPIStats] Edge Function error:', error);
        // Continue to fallback calculation - don't return early
      }

      // Try multiple matching strategies for workspace (only if we have data)
      // Match by both workspace_name and display_name since Edge Function returns display_name
      let workspaceData = null;
      if (data?.clients && data.clients.length > 0) {
        workspaceData = data.clients.find(
          (c: any) => 
            c.name === workspaceName ||                                    // Match by workspace_name
            c.name === displayName ||                                       // Match by display_name
            c.name?.toLowerCase() === workspaceName?.toLowerCase() ||      // Case-insensitive workspace_name
            c.name?.toLowerCase() === displayName?.toLowerCase()            // Case-insensitive display_name
        );
      }

      if (workspaceData) {
        console.log(`[ClientKPIStats] Found workspace data for "${workspaceName}" via Edge Function:`, workspaceData);
        const edgeFunctionAnalytics = {
          leadsGenerated: workspaceData.leadsGenerated || 0,
          projectedReplies: workspaceData.projectedReplies || 0,
          leadsTarget: workspaceData.leadsTarget || 0,
          repliesTarget: workspaceData.repliesTarget || 0,
          monthlyKPI: workspaceData.monthlyKPI || 0,
          currentProgress: workspaceData.currentProgress || 0,
          repliesProgress: workspaceData.repliesProgress || 0,
          positiveRepliesLast30Days: workspaceData.positiveRepliesLast30Days || 0,
          positiveRepliesLast7Days: workspaceData.positiveRepliesLast7Days || 0,
          positiveRepliesCurrentMonth: workspaceData.positiveRepliesCurrentMonth || 0,
        };
        console.log(`[ClientKPIStats] Setting analytics from Edge Function:`, edgeFunctionAnalytics);
        setAnalytics(edgeFunctionAnalytics);
        return; // Exit early if we found data
      }
      
      // Fallback: Always calculate from client_leads if Edge Function didn't provide data
      console.log(`[ClientKPIStats] No Edge Function match found for "${workspaceName}", calculating from client_leads...`);
        
        // Fetch leads for this workspace
        const { data: leads, error: leadsError } = await supabase
          .from('client_leads')
          .select('date_received')
          .eq('workspace_name', workspaceName)
          .eq('interested', true);

        if (leadsError) {
          console.error('[ClientKPIStats] Error fetching leads:', leadsError);
        }

        console.log(`[ClientKPIStats] Found ${leads?.length || 0} interested leads for "${workspaceName}"`);

        // Calculate date ranges
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);

        // Calculate metrics from leads data
        const positiveRepliesCurrentMonth = leads?.filter(l => {
          if (!l.date_received) return false;
          const dateReceived = new Date(l.date_received);
          return dateReceived >= monthStart;
        }).length || 0;

        const positiveRepliesLast30Days = leads?.filter(l => {
          if (!l.date_received) return false;
          const dateReceived = new Date(l.date_received);
          return dateReceived >= thirtyDaysAgo;
        }).length || 0;

        const positiveRepliesLast7Days = leads?.filter(l => {
          if (!l.date_received) return false;
          const dateReceived = new Date(l.date_received);
          return dateReceived >= sevenDaysAgo;
        }).length || 0;

        // Use monthlyKPI from registry (already fetched above)
        const monthlyKPI = monthlyKPIFromRegistry;

        // Calculate projections (simple daily average projection)
        const daysElapsed = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const dailyAverage = daysElapsed > 0 ? positiveRepliesCurrentMonth / daysElapsed : 0;
        const projectedReplies = Math.round(dailyAverage * daysInMonth);

        const currentProgress = monthlyKPI > 0 ? positiveRepliesCurrentMonth / monthlyKPI : 0;
        const repliesProgress = monthlyKPI > 0 ? projectedReplies / monthlyKPI : 0;

        console.log(`[ClientKPIStats] Calculated metrics for "${workspaceName}":`, {
          positiveRepliesCurrentMonth,
          positiveRepliesLast30Days,
          positiveRepliesLast7Days,
          monthlyKPI,
          projectedReplies,
          totalLeads: leads?.length || 0,
          monthStart: monthStart.toISOString(),
          thirtyDaysAgo: thirtyDaysAgo.toISOString()
        });

        // Use calculated values
        const calculatedAnalytics = {
          leadsGenerated: positiveRepliesCurrentMonth,
          projectedReplies: projectedReplies,
          leadsTarget: 0,
          repliesTarget: monthlyKPI,
          monthlyKPI: monthlyKPI,
          currentProgress: currentProgress,
          repliesProgress: repliesProgress,
          positiveRepliesLast30Days: positiveRepliesLast30Days,
          positiveRepliesLast7Days: positiveRepliesLast7Days,
          positiveRepliesCurrentMonth: positiveRepliesCurrentMonth,
        };

        console.log(`[ClientKPIStats] Setting analytics state:`, calculatedAnalytics);
        setAnalytics(calculatedAnalytics);
    } catch (error) {
      console.error('[ClientKPIStats] Error fetching analytics:', error);
      // Set default values to prevent showing undefined
      setAnalytics({
        leadsGenerated: 0,
        projectedReplies: 0,
        leadsTarget: 0,
        repliesTarget: 0,
        monthlyKPI: 0,
        currentProgress: 0,
        repliesProgress: 0,
        positiveRepliesLast30Days: 0,
        positiveRepliesLast7Days: 0,
        positiveRepliesCurrentMonth: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate portal-specific metrics
  const winRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : 0;
  const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : 0;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-40 bg-muted/80 border border-border rounded-2xl relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-foreground/10 before:to-transparent" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Monthly Target */}
      <KPICard
        title="Monthly Target"
        value={analytics?.positiveRepliesCurrentMonth || 0}
        subtitle={`Goal: ${analytics?.monthlyKPI || 0} replies`}
        type="progress"
        progress={analytics?.monthlyKPI > 0 ? ((analytics.positiveRepliesCurrentMonth || 0) / analytics.monthlyKPI) * 100 : 0}
        status={
          analytics?.monthlyKPI > 0 && (analytics?.positiveRepliesCurrentMonth || 0) >= analytics.monthlyKPI
            ? "above-target"
            : analytics?.monthlyKPI > 0 && (analytics?.positiveRepliesCurrentMonth || 0) >= (analytics.monthlyKPI * 0.8)
            ? "on-target"
            : "below-target"
        }
        icon={<Target className="h-5 w-5" />}
      />

      {/* Last 30 Days */}
      <KPICard
        title="Last 30 Days"
        value={analytics?.positiveRepliesLast30Days || 0}
        subtitle="Positive replies"
        trend="up"
        status="neutral"
        icon={<TrendingUp className="h-5 w-5" />}
      />

      {/* Total Premium */}
      <KPICard
        title="Total Premium"
        value={`$${totalPremium.toLocaleString()}`}
        subtitle={`From ${wonLeads} won deals`}
        status={totalPremium > 0 ? "above-target" : "neutral"}
        icon={<DollarSign className="h-5 w-5" />}
      />

      {/* Conversion Rate */}
      <KPICard
        title="Conversion Rate"
        value={`${conversionRate}%`}
        subtitle="Leads converted to won"
        status={Number(conversionRate) >= 10 ? "above-target" : "neutral"}
        icon={<Zap className="h-5 w-5" />}
      />
    </div>
  );
};
