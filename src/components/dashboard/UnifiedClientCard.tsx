import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, ChevronDown, ChevronUp, BarChart3, Users, Zap, Calendar, Clock, CheckCircle2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnifiedClient {
  name: string;
  // KPI data
  leadsGenerated: number;
  monthlyKPI: number;
  projectedReplies: number;
  currentProgress: number;
  repliesProgress: number;
  leadsTarget: number;
  repliesTarget: number;
  // KPI Timeline data (for expanded view)
  positiveRepliesLast7Days: number;
  positiveRepliesLast14Days: number;
  positiveRepliesLast30Days: number;
  positiveRepliesCurrentMonth: number;
  positiveRepliesLastMonth: number;
  lastWeekVsWeekBeforeProgress: number;
  positiveRepliesLastVsThisMonth: number;
  // Volume data
  emails: number;
  emailsToday: number;
  target: number;
  projection: number;
  projectedPercentage: number;
  // Detailed metrics
  emailsLast7Days?: number;
  emailsLast14Days?: number;
  emailsLast30Days?: number;
  dailyQuota?: number;
  dailySendingTarget?: number;
  expectedByNow?: number;
  targetPercentage?: number;
  // Computed
  status: 'above' | 'ontrack' | 'below';
}

interface UnifiedClientCardProps {
  client: UnifiedClient;
  onClick?: () => void;
}

export const UnifiedClientCard = ({ client, onClick }: UnifiedClientCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const progressPercentage = client.currentProgress * 100;
  const isOnTarget = client.leadsGenerated >= client.monthlyKPI;
  const isProjectedOnTarget = client.projectedReplies >= client.monthlyKPI;

  const getStatusColor = () => {
    if (client.status === 'above') return "border-success bg-success/5";
    if (client.status === 'ontrack') return "border-warning bg-warning/5";
    return "border-destructive bg-destructive/5";
  };

  const getStatusBadge = () => {
    if (client.status === 'above') {
      return (
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-semibold">
          <TrendingUp className="h-3 w-3" />
          Above Target
        </div>
      );
    }
    if (client.status === 'ontrack') {
      return (
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-warning/10 text-warning text-xs font-semibold">
          <Target className="h-3 w-3" />
          On Track
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">
        <TrendingDown className="h-3 w-3" />
        Below Target
      </div>
    );
  };

  const handleCardClick = () => {
    // Toggle expansion inline - no navigation
    setIsExpanded(!isExpanded);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <Card
      className={`cursor-pointer hover:shadow-xl transition-all duration-300 border-2 ${getStatusColor()} ${
        isExpanded ? 'col-span-1 md:col-span-2 lg:col-span-3' : ''
      }`}
      onClick={handleCardClick}
    >
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-foreground mb-1">
              {client.name}
            </h3>
            {getStatusBadge()}
          </div>
          <button
            onClick={handleExpandClick}
            className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
            title={isExpanded ? "Show less" : "Show more"}
          >
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Metrics */}
        <div className="space-y-4">
          {/* MTD Leads Section */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm text-muted-foreground font-medium">MTD Leads</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">{client.leadsGenerated}</span>
                <span className="text-sm text-muted-foreground">/ {client.monthlyKPI}</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-2.5 bg-muted rounded-full overflow-hidden border border-border">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  isOnTarget ? "bg-success" : isProjectedOnTarget ? "bg-warning" : "bg-destructive"
                )}
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-muted-foreground">Progress</span>
              <span className="text-xs font-semibold text-foreground">
                {Math.round(progressPercentage)}%
              </span>
            </div>
          </div>

          {/* MTD Sending Volume Section */}
          <div className="pt-3 border-t border-border">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm text-muted-foreground font-medium">MTD Emails Sent</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-foreground">{client.emails.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">/ {client.target.toLocaleString()}</span>
              </div>
            </div>

            {/* Projected EOM Emails */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Projected EOM (emails)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-foreground">{client.projection.toLocaleString()}</span>
                <span
                  className={cn(
                    "text-xs font-semibold",
                    client.projectedPercentage >= 100 ? "text-success" : "text-destructive"
                  )}
                >
                  ({client.projectedPercentage.toFixed(0)}%)
                </span>
              </div>
            </div>

            {/* Projected EOM Leads */}
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">Projected EOM (leads)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-foreground">{client.projectedReplies}</span>
                <span
                  className={cn(
                    "text-xs font-semibold",
                    client.projectedReplies >= client.monthlyKPI ? "text-success" : "text-destructive"
                  )}
                >
                  ({Math.round((client.projectedReplies / client.monthlyKPI) * 100)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="pt-4 border-t-2 border-border space-y-6 mt-4">
              {/* KPI Overview Cards Grid */}
              <div>
                <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  KPI Overview
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {/* Leads Generated */}
                  <div className="p-3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-primary" />
                      <p className="text-[10px] text-muted-foreground font-medium">Leads Generated</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{client.leadsGenerated}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Target: {client.monthlyKPI}</p>
                  </div>

                  {/* Projected Replies */}
                  <div className="p-3 bg-gradient-to-br from-accent/10 to-accent/5 rounded-lg border border-accent/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-accent" />
                      <p className="text-[10px] text-muted-foreground font-medium">Projected EOM</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{client.projectedReplies}</p>
                    <p className={cn(
                      "text-[10px] mt-1",
                      client.projectedReplies >= client.monthlyKPI ? "text-success" : "text-destructive"
                    )}>
                      {client.projectedReplies >= client.monthlyKPI ? "✓ On Target" : "⚠ Below Target"}
                    </p>
                  </div>

                  {/* MTD Progress % */}
                  <div className="p-3 bg-gradient-to-br from-success/10 to-success/5 rounded-lg border border-success/20">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="h-4 w-4 text-success" />
                      <p className="text-[10px] text-muted-foreground font-medium">MTD Progress</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{Math.round(progressPercentage)}%</p>
                    <div className="w-full bg-muted/50 rounded-full h-1.5 mt-2">
                      <div
                        className="h-full rounded-full bg-success transition-all"
                        style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Replies Progress */}
                  <div className="p-3 bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-lg border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-purple-500" />
                      <p className="text-[10px] text-muted-foreground font-medium">Replies Progress</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{Math.round(client.repliesProgress * 100)}%</p>
                    <div className="w-full bg-muted/50 rounded-full h-1.5 mt-2">
                      <div
                        className="h-full rounded-full bg-purple-500 transition-all"
                        style={{ width: `${Math.min(client.repliesProgress * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Monthly KPI */}
                  <div className="p-3 bg-gradient-to-br from-warning/10 to-warning/5 rounded-lg border border-warning/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4 text-warning" />
                      <p className="text-[10px] text-muted-foreground font-medium">Monthly KPI</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{client.monthlyKPI}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Static Target</p>
                  </div>
                </div>
              </div>

              {/* Replies Timeline */}
              <div>
                <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Positive Replies Timeline
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-3 w-3 text-primary" />
                      <p className="text-[10px] text-muted-foreground">Last 7 Days</p>
                    </div>
                    <p className="text-xl font-bold text-foreground">{client.positiveRepliesLast7Days}</p>
                    <div className="w-full bg-muted/50 rounded-full h-1 mt-2">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min((client.positiveRepliesLast7Days / client.monthlyKPI) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-accent/5 rounded-lg border border-accent/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-3 w-3 text-accent" />
                      <p className="text-[10px] text-muted-foreground">Last 14 Days</p>
                    </div>
                    <p className="text-xl font-bold text-foreground">{client.positiveRepliesLast14Days}</p>
                    <div className="w-full bg-muted/50 rounded-full h-1 mt-2">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${Math.min((client.positiveRepliesLast14Days / client.monthlyKPI) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-purple-500/5 rounded-lg border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-3 w-3 text-purple-500" />
                      <p className="text-[10px] text-muted-foreground">Last 30 Days</p>
                    </div>
                    <p className="text-xl font-bold text-foreground">{client.positiveRepliesLast30Days}</p>
                    <div className="w-full bg-muted/50 rounded-full h-1 mt-2">
                      <div
                        className="h-full rounded-full bg-purple-500 transition-all"
                        style={{ width: `${Math.min((client.positiveRepliesLast30Days / client.monthlyKPI) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-success/5 rounded-lg border border-success/20">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-3 w-3 text-success" />
                      <p className="text-[10px] text-muted-foreground">Current Month</p>
                    </div>
                    <p className="text-xl font-bold text-foreground">{client.positiveRepliesCurrentMonth}</p>
                    <div className="w-full bg-muted/50 rounded-full h-1 mt-2">
                      <div
                        className="h-full rounded-full bg-success transition-all"
                        style={{ width: `${Math.min((client.positiveRepliesCurrentMonth / client.monthlyKPI) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Email Volume Rolling Windows */}
              <div>
                <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Email Volume Rolling Windows
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">Last 7 Days</p>
                    <p className="text-lg font-bold text-foreground">{client.emailsLast7Days?.toLocaleString() || 0}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">Last 14 Days</p>
                    <p className="text-lg font-bold text-foreground">{client.emailsLast14Days?.toLocaleString() || 0}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">Last 30 Days</p>
                    <p className="text-lg font-bold text-foreground">{client.emailsLast30Days?.toLocaleString() || 0}</p>
                  </div>
                </div>
              </div>

              {/* Daily Pace & Targets */}
              <div>
                <h4 className="text-sm font-bold text-foreground mb-3">Daily Sending Pace</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-[10px] text-muted-foreground mb-1">Today's Sending</p>
                    <p className="text-lg font-bold text-foreground">{client.emailsToday.toLocaleString()}</p>
                  </div>
                  {client.dailyQuota && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-[10px] text-muted-foreground mb-1">Daily Quota</p>
                      <p className="text-lg font-bold text-foreground">{Math.round(client.dailyQuota).toLocaleString()}</p>
                    </div>
                  )}
                  {client.dailySendingTarget && client.dailySendingTarget > 0 && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-[10px] text-muted-foreground mb-1">Daily Target</p>
                      <p className="text-lg font-bold text-foreground">{client.dailySendingTarget.toLocaleString()}</p>
                    </div>
                  )}
                  {client.expectedByNow && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-[10px] text-muted-foreground mb-1">Expected By Now</p>
                      <p className={cn(
                        "text-lg font-bold",
                        client.emails >= client.expectedByNow ? "text-success" : "text-destructive"
                      )}>
                        {Math.round(client.expectedByNow).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Month Comparison */}
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="text-sm font-bold text-foreground mb-3">Month-over-Month Comparison</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Current Month</p>
                    <p className="text-2xl font-bold text-foreground">{client.positiveRepliesCurrentMonth}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Last Month</p>
                    <p className="text-2xl font-bold text-muted-foreground">{client.positiveRepliesLastMonth}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-2">Month vs Month Growth</p>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "text-xl font-bold",
                        client.positiveRepliesLastVsThisMonth >= 0 ? "text-success" : "text-destructive"
                      )}>
                        {client.positiveRepliesLastVsThisMonth >= 0 ? "+" : ""}
                        {client.positiveRepliesLastVsThisMonth}%
                      </div>
                      {client.positiveRepliesLastVsThisMonth >= 0 ? (
                        <TrendingUp className="h-5 w-5 text-success" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
