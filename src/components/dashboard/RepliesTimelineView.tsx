import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Calendar, Clock, TrendingUp, TrendingDown } from "lucide-react";

interface RepliesTimelineViewProps {
  positiveRepliesLast7Days: number;
  positiveRepliesLast14Days: number;
  positiveRepliesLast30Days: number;
  positiveRepliesCurrentMonth: number;
  positiveRepliesLastMonth: number;
}

export const RepliesTimelineView = ({
  positiveRepliesLast7Days,
  positiveRepliesLast14Days,
  positiveRepliesLast30Days,
  positiveRepliesCurrentMonth,
  positiveRepliesLastMonth,
}: RepliesTimelineViewProps) => {
  // Find the maximum value to normalize the progress bars
  const maxValue = Math.max(
    positiveRepliesLast7Days,
    positiveRepliesLast14Days,
    positiveRepliesLast30Days,
    positiveRepliesCurrentMonth,
    positiveRepliesLastMonth
  );

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

  const monthlyComparison = positiveRepliesCurrentMonth - positiveRepliesLastMonth;
  const monthlyTrend = monthlyComparison >= 0 ? "up" : "down";

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
        {/* Timeline Bars */}
        <div className="space-y-4">
          {periods.map((period, index) => {
            const percentage = maxValue > 0 ? (period.value / maxValue) * 100 : 0;
            
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
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="absolute right-2 top-0 h-3 flex items-center">
                    <span className="text-xs text-white font-medium">
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Monthly Comparison Summary */}
        <div className="mt-6 p-4 bg-dashboard-card border border-border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${monthlyTrend === 'up' ? 'bg-dashboard-success' : 'bg-dashboard-danger'} animate-pulse`} />
              <span className="text-sm font-medium text-dashboard-secondary">
                Monthly Trend
              </span>
            </div>
            <div className="flex items-center gap-2">
              {monthlyTrend === 'up' ? (
                <TrendingUp className="h-4 w-4 text-dashboard-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-dashboard-danger" />
              )}
              <span className={`text-lg font-bold ${monthlyTrend === 'up' ? 'text-dashboard-success' : 'text-dashboard-danger'}`}>
                {monthlyComparison > 0 ? '+' : ''}{monthlyComparison}
              </span>
              <span className="text-xs text-dashboard-secondary">
                vs last month
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {positiveRepliesLast7Days}
            </div>
            <div className="text-xs text-blue-500 dark:text-blue-300">
              Weekly Average
            </div>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {positiveRepliesCurrentMonth}
            </div>
            <div className="text-xs text-green-500 dark:text-green-300">
              This Month
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};