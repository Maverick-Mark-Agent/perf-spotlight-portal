import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Calendar, TrendingUp, Clock, CheckCircle2 } from "lucide-react";

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
      title: "Last 7 Days",
      value: positiveRepliesLast7Days,
      icon: Clock,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Last 14 Days",
      value: positiveRepliesLast14Days,
      icon: Calendar,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Last 30 Days",
      value: positiveRepliesLast30Days,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-600/10",
    },
    {
      title: "Current Month",
      value: positiveRepliesCurrentMonth,
      icon: CheckCircle2,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  const getProgressPercentage = (value: number) => {
    return (value / monthlyKpiTarget) * 100;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-success";
    if (percentage >= 70) return "bg-warning";
    return "bg-primary";
  };

  return (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden bg-card border-2 border-primary/10">
      <CardHeader className="border-b-2 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Positive Replies Timeline
            </h3>
            <p className="text-sm text-foreground/60 font-medium mt-1">
              Track your progress across different time periods
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">Monthly Target</p>
            <p className="text-2xl font-bold text-primary">{monthlyKpiTarget}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {periods.map((period) => {
            const percentage = getProgressPercentage(period.value);
            const Icon = period.icon;
            
            return (
              <div
                key={period.title}
                className="group relative p-5 rounded-xl border-2 border-border bg-card hover:border-primary/40 hover:shadow-lg transition-all duration-300"
              >
                {/* Icon Badge */}
                <div className={`inline-flex p-3 rounded-lg ${period.bgColor} ${period.color} mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="h-5 w-5" />
                </div>

                {/* Title */}
                <p className="text-sm font-semibold text-foreground/70 mb-2">
                  {period.title}
                </p>

                {/* Value */}
                <div className="flex items-baseline gap-2 mb-4">
                  <p className="text-3xl font-bold text-foreground tracking-tight">
                    {period.value}
                  </p>
                  <p className="text-sm text-muted-foreground">replies</p>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground/60 font-medium">Progress</span>
                    <span className={`font-semibold ${period.color}`}>
                      {Math.round(percentage)}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-muted/80 rounded-full overflow-hidden border border-border">
                    <div
                      className={`h-full ${getProgressColor(percentage)} transition-all duration-500 rounded-full`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Target Indicator */}
                {percentage >= 100 && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-semibold">
                    <CheckCircle2 className="h-3 w-3" />
                    Target Reached
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Monthly Comparison */}
        <div className="mt-8 p-5 rounded-xl border-2 border-primary/20 bg-card shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground/70 mb-1">
                Last Month vs Current Month
              </p>
              <div className="flex items-baseline gap-3">
                <p className="text-2xl font-bold text-foreground">
                  {positiveRepliesLastMonth} → {positiveRepliesCurrentMonth}
                </p>
                <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  positiveRepliesLastVsThisMonth >= 0 
                    ? 'bg-success/10 text-success' 
                    : 'bg-warning/10 text-warning'
                }`}>
                  <TrendingUp className={`h-3 w-3 ${positiveRepliesLastVsThisMonth < 0 ? 'rotate-180' : ''}`} />
                  {Math.abs(Math.round(positiveRepliesLastVsThisMonth))}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};