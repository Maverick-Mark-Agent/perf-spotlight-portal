import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, TrendingUp, TrendingDown, Target } from "lucide-react";

interface VolumeClient {
  emailsToday: number;
  emailsTomorrow: number;
  dailySendingTarget: number;
}

interface DailyVolumeBannerProps {
  clients: VolumeClient[];
  loading?: boolean;
}

export const DailyVolumeBanner = ({ clients, loading = false }: DailyVolumeBannerProps) => {
  // Don't render when loading or no clients
  if (loading || clients.length === 0) {
    return (
      <Card className="bg-dashboard-primary/15 backdrop-blur-sm border-dashboard-primary/50 shadow-2xl">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-dashboard-primary/20 rounded-2xl">
              <BarChart3 className="h-8 w-8 text-dashboard-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Daily Volume Overview</h2>
              <p className="text-sm text-muted-foreground">
                {loading ? 'Loading sending data...' : 'No client data available'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const totalToday = clients.reduce((sum, client) => sum + client.emailsToday, 0);
  const totalTomorrow = clients.reduce((sum, client) => sum + client.emailsTomorrow, 0);
  const totalTarget = clients.reduce((sum, client) => sum + client.dailySendingTarget, 0);

  // Calculate percentage change from today to tomorrow
  const percentageChange = totalToday > 0
    ? ((totalTomorrow - totalToday) / totalToday) * 100
    : 0;

  // Calculate status based on today's performance vs target
  const todayPercentage = totalTarget > 0 ? (totalToday / totalTarget) * 100 : 0;

  const getStatusBadge = () => {
    if (todayPercentage >= 90) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-dashboard-success/20 text-dashboard-success text-xs font-semibold">
          On Target
        </span>
      );
    } else if (todayPercentage >= 70) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-dashboard-warning/20 text-dashboard-warning text-xs font-semibold">
          Below Target
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-dashboard-danger/20 text-dashboard-danger text-xs font-semibold">
          Critical
        </span>
      );
    }
  };

  const getTomorrowIndicator = () => {
    if (percentageChange > 5) {
      return (
        <span className="inline-flex items-center gap-1 text-dashboard-success">
          <TrendingUp className="h-4 w-4" />
          +{percentageChange.toFixed(1)}%
        </span>
      );
    } else if (percentageChange < -5) {
      return (
        <span className="inline-flex items-center gap-1 text-dashboard-danger">
          <TrendingDown className="h-4 w-4" />
          {percentageChange.toFixed(1)}%
        </span>
      );
    } else {
      return (
        <span className="text-muted-foreground">
          {percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(1)}%
        </span>
      );
    }
  };

  return (
    <Card className="bg-dashboard-primary/15 backdrop-blur-sm border-dashboard-primary/50 shadow-2xl">
      <CardContent className="pt-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Left Section: Icon & Title */}
          <div className="flex items-center gap-4">
            <div className="p-4 bg-dashboard-primary/20 rounded-2xl">
              <BarChart3 className="h-8 w-8 text-dashboard-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                Daily Volume Overview
              </h2>
              <p className="text-sm text-muted-foreground">
                Aggregate sending capacity across all clients
              </p>
            </div>
          </div>

          {/* Right Section: Metrics */}
          <div className="flex items-center gap-6 lg:gap-8">
            {/* Today's Volume */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Today
              </p>
              <p className="text-3xl font-bold text-foreground">
                {totalToday.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                emails
              </p>
            </div>

            {/* Divider */}
            <div className="h-16 w-px bg-border"></div>

            {/* Tomorrow's Volume */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Tomorrow
              </p>
              <p className="text-3xl font-bold text-dashboard-primary">
                {totalTomorrow.toLocaleString()}
              </p>
              <p className="text-xs mt-1">
                {getTomorrowIndicator()}
              </p>
            </div>

            {/* Divider */}
            <div className="h-16 w-px bg-border"></div>

            {/* Daily Target */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1 justify-center">
                <Target className="h-3 w-3" />
                Target
              </p>
              <p className="text-3xl font-bold text-muted-foreground">
                {totalTarget.toLocaleString()}
              </p>
              <div className="mt-1">
                {getStatusBadge()}
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Today's Progress
            </span>
            <span className="text-sm font-semibold text-foreground">
              {todayPercentage.toFixed(1)}% of target
            </span>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-1000 ${
                todayPercentage >= 90
                  ? 'bg-dashboard-success'
                  : todayPercentage >= 70
                  ? 'bg-dashboard-warning'
                  : 'bg-dashboard-danger'
              }`}
              style={{ width: `${Math.min(todayPercentage, 100)}%` }}
            ></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
