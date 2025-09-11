import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Calendar, Clock, TrendingUp, TrendingDown } from "lucide-react";

interface RepliesTimelineViewProps {
  positiveRepliesLast7Days: number;
  positiveRepliesLast14Days: number;
  positiveRepliesLast30Days: number;
  positiveRepliesCurrentMonth: number;
  positiveRepliesLastMonth: number;
  positiveRepliesLastVsThisMonth: number;
  monthlyKpiTarget: number;
}

export const RepliesTimelineView = ({
  positiveRepliesLast7Days,
  positiveRepliesLast14Days,
  positiveRepliesLast30Days,
  positiveRepliesCurrentMonth,
  positiveRepliesLastMonth,
  positiveRepliesLastVsThisMonth,
  monthlyKpiTarget,
}: RepliesTimelineViewProps) => {
  const periods = [
    {
      label: "Last 7 Days",
      value: positiveRepliesLast7Days,
      icon: <Clock className="h-4 w-4" />,
      color: "bg-blue-500",
      period: "Recent"
    },
    {
      label: "Last 14 Days", 
      value: positiveRepliesLast14Days,
      icon: <Calendar className="h-4 w-4" />,
      color: "bg-indigo-500",
      period: "Recent"
    },
    {
      label: "Last 30 Days",
      value: positiveRepliesLast30Days,
      icon: <Calendar className="h-4 w-4" />,
      color: "bg-purple-500",
      period: "Extended"
    },
    {
      label: "Current Month",
      value: positiveRepliesCurrentMonth,
      icon: <TrendingUp className="h-4 w-4" />,
      color: "bg-green-500",
      period: "Monthly"
    },
    {
      label: "Last Month",
      value: positiveRepliesLastMonth,
      icon: <TrendingDown className="h-4 w-4" />,
      color: "bg-gray-500",
      period: "Monthly"
    }
  ];

  const monthlyTrend = positiveRepliesLastVsThisMonth >= 0 ? "up" : "down";

  return (
    <Card className="bg-dashboard-card border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-dashboard-primary">
          Positive Replies Timeline
        </CardTitle>
        <div className="text-sm text-dashboard-secondary">
          Track positive replies across different time periods
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {periods.map((period, index) => {
            const progressPercentage = monthlyKpiTarget > 0 ? Math.min((period.value / monthlyKpiTarget) * 100, 100) : 0;
            
            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-dashboard-secondary">
                      {period.icon}
                    </div>
                    <span className="text-sm font-medium text-dashboard-primary">
                      {period.label}
                    </span>
                    <span className="text-xs text-dashboard-secondary px-2 py-1 rounded-md bg-dashboard-card border">
                      {period.period}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-dashboard-primary">
                      {period.value}
                    </span>
                    <span className="text-xs text-dashboard-secondary">replies</span>
                  </div>
                </div>
                <div className="relative">
                  <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
                    <div 
                      className={`h-3 rounded-full ${period.color} transition-all duration-500 ease-in-out`}
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <div className="absolute right-2 top-0 h-3 flex items-center">
                    <span className="text-xs text-white font-medium">
                      {progressPercentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="text-xs text-dashboard-secondary text-right">
                  {period.value} of {monthlyKpiTarget} target ({progressPercentage.toFixed(1)}%)
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};