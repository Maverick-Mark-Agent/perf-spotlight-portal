import { useEffect, useState } from "react";
import { KPICard } from "./KPICard";
import { Target, TrendingUp, Users, Award, Calendar, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ClientKPIStatsProps {
  workspaceName: string;
  totalLeads: number;
  wonLeads: number;
  newLeads: number;
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

export const ClientKPIStats = ({ workspaceName, totalLeads, wonLeads, newLeads }: ClientKPIStatsProps) => {
  const [analytics, setAnalytics] = useState<WorkspaceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [workspaceName]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch from hybrid-workspace-analytics
      const { data, error } = await supabase.functions.invoke('hybrid-workspace-analytics', {
        body: { timestamp: Date.now() }
      });

      if (error) throw error;

      // Find the specific workspace
      const workspaceData = data?.clients?.find(
        (c: any) => c.name === workspaceName
      );

      if (workspaceData) {
        setAnalytics({
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
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
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
          <div key={i} className="h-40 bg-white/5 border border-white/10 rounded-2xl animate-pulse" />
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
        subtitle="Goal: 100 replies"
        type="progress"
        progress={((analytics?.positiveRepliesCurrentMonth || 0) / 100) * 100}
        status={
          (analytics?.positiveRepliesCurrentMonth || 0) >= 100
            ? "above-target"
            : (analytics?.positiveRepliesCurrentMonth || 0) >= 80
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

      {/* Win Rate */}
      <KPICard
        title="Win Rate"
        value={`${winRate}%`}
        subtitle={`${wonLeads} won out of ${totalLeads}`}
        status={Number(winRate) >= 10 ? "above-target" : "neutral"}
        icon={<Award className="h-5 w-5" />}
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
