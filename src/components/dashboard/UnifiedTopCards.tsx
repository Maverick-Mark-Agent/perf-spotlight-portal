import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send, BarChart3, Target, TrendingUp, TrendingDown, Users, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPIClient {
  name: string;
  leadsGenerated: number;
  monthlyKPI: number;
  projectedReplies: number;
  currentProgress: number;
}

interface VolumeClient {
  name: string;
  emails: number;
  emailsToday: number;
  emailsTomorrow: number;
  target: number;
  projection: number;
  targetPercentage: number;
  projectedPercentage: number;
  dailySendingTarget: number;
}

interface UnifiedTopCardsProps {
  kpiClients: KPIClient[];
  volumeClients: VolumeClient[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const UnifiedTopCards = ({ kpiClients, volumeClients, onRefresh, isRefreshing = false }: UnifiedTopCardsProps) => {
  // Create a map of KPI data by client name for easy lookup
  const kpiMap = new Map(kpiClients.map(c => [c.name, c]));

  // Calculate KPI aggregates
  const totalLeads = kpiClients.reduce((sum, c) => sum + c.leadsGenerated, 0);
  const totalKPITarget = kpiClients.reduce((sum, c) => sum + c.monthlyKPI, 0);
  const kpiProgress = totalKPITarget > 0 ? (totalLeads / totalKPITarget) * 100 : 0;
  const totalLeadProjection = kpiClients.reduce((sum, c) => sum + c.projectedReplies, 0);

  // Calculate Volume aggregates
  const totalEmails = volumeClients.reduce((sum, c) => sum + c.emails, 0);
  const totalEmailTarget = volumeClients.reduce((sum, c) => sum + c.target, 0);
  const volumeProgress = totalEmailTarget > 0 ? (totalEmails / totalEmailTarget) * 100 : 0;
  const totalEmailProjection = volumeClients.reduce((sum, c) => sum + c.projection, 0);

  // Calculate performance metrics
  const clientsAboveTarget = kpiClients.filter(c => c.leadsGenerated >= c.monthlyKPI).length;
  const clientsOnTrack = kpiClients.filter(c =>
    c.leadsGenerated < c.monthlyKPI && c.projectedReplies >= c.monthlyKPI
  ).length;
  const clientsBelowTarget = kpiClients.filter(c => c.projectedReplies < c.monthlyKPI).length;

  const avgKPIAchievement = kpiClients.length > 0
    ? kpiClients.reduce((sum, c) => sum + c.currentProgress, 0) / kpiClients.length * 100
    : 0;

  const volumeVariance = totalEmails - totalEmailTarget;
  const projectedToMeetTarget = volumeClients.filter(c => c.projectedPercentage >= 100).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      {/* Card 1: Today's Sending Volume */}
      <Card className="bg-dashboard-primary/15 backdrop-blur-sm border-dashboard-primary/50 shadow-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-dashboard-primary flex items-center gap-2 text-xl font-bold">
              <Send className="h-6 w-6" />
              Today's Sending Volume
            </CardTitle>
            {onRefresh && (
              <Button
                onClick={onRefresh}
                disabled={isRefreshing}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title="Refresh daily sending data"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {volumeClients
            .sort((a, b) => b.emailsToday - a.emailsToday)
            .map((client) => {
              // Use dailySendingTarget if available, otherwise calculate from monthly target
              const dailyGoal = client.dailySendingTarget > 0
                ? client.dailySendingTarget
                : Math.round(client.target / 30);
              return (
                <div
                  key={client.name}
                  className="flex items-center justify-between p-3 bg-white/10 rounded-lg border border-dashboard-primary/40 hover:bg-white/20 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-2 h-2 rounded-full bg-dashboard-primary"></div>
                    <span className="text-foreground font-medium text-sm">{client.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-dashboard-primary font-bold text-lg">
                      {client.emailsToday.toLocaleString()} / {dailyGoal.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>

      {/* Card 2: Combined Overall Progress */}
      <Card className="bg-dashboard-primary/15 backdrop-blur-sm border-dashboard-primary/50 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-dashboard-primary flex items-center gap-2 text-xl font-bold">
            <BarChart3 className="h-6 w-6" />
            Overall Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Volume Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Email Volume</span>
              <span className="text-2xl font-bold text-dashboard-primary">
                {volumeProgress.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div
                className={cn(
                  "h-3 rounded-full transition-all duration-1000",
                  volumeProgress >= 100
                    ? "bg-dashboard-success"
                    : volumeProgress >= 80
                    ? "bg-dashboard-warning"
                    : "bg-dashboard-danger"
                )}
                style={{ width: `${Math.min(volumeProgress, 100)}%` }}
              ></div>
            </div>
            <p className="text-foreground text-sm mt-2">
              {totalEmails.toLocaleString()} / {totalEmailTarget.toLocaleString()} emails
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Projected EOM: {totalEmailProjection.toLocaleString()} emails
            </p>
          </div>

          {/* KPI Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Lead Generation</span>
              <span className="text-2xl font-bold text-dashboard-primary">
                {kpiProgress.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div
                className={cn(
                  "h-3 rounded-full transition-all duration-1000",
                  kpiProgress >= 100
                    ? "bg-dashboard-success"
                    : kpiProgress >= 80
                    ? "bg-dashboard-warning"
                    : "bg-dashboard-danger"
                )}
                style={{ width: `${Math.min(kpiProgress, 100)}%` }}
              ></div>
            </div>
            <p className="text-foreground text-sm mt-2">
              {totalLeads.toLocaleString()} / {totalKPITarget.toLocaleString()} leads
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Projected EOM: {totalLeadProjection.toLocaleString()} leads
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Tomorrow's Sending Volume */}
      <Card className="bg-dashboard-warning/15 backdrop-blur-sm border-dashboard-warning/50 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-dashboard-warning flex items-center gap-2 text-xl font-bold">
            <Target className="h-6 w-6" />
            Tomorrow's Sending Volume
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {volumeClients
            .sort((a, b) => b.emailsTomorrow - a.emailsTomorrow)
            .map((client) => {
              const dailyGoal = client.dailySendingTarget > 0
                ? client.dailySendingTarget
                : Math.round(client.target / 30);
              return (
                <div
                  key={client.name}
                  className="flex items-center justify-between p-3 bg-white/10 rounded-lg border border-dashboard-warning/40 hover:bg-white/20 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-2 h-2 rounded-full bg-dashboard-warning"></div>
                    <span className="text-foreground font-medium text-sm">{client.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-dashboard-warning font-bold text-lg">
                      {client.emailsTomorrow.toLocaleString()} / {dailyGoal.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
};
