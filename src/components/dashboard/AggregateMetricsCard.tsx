import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Target, Users, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface AggregateMetricsCardProps {
  totalLeads: number;
  totalTarget: number;
  projectedEOM: number;
  clientCount: number;
}

export const AggregateMetricsCard = ({
  totalLeads,
  totalTarget,
  projectedEOM,
  clientCount
}: AggregateMetricsCardProps) => {
  const currentProgress = totalTarget > 0 ? (totalLeads / totalTarget) * 100 : 0;
  const projectedProgress = totalTarget > 0 ? (projectedEOM / totalTarget) * 100 : 0;

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-card to-card border-2 border-primary/30 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Overall Performance - October 2025
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Aggregate metrics across {clientCount} active clients
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Current MTD Leads */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">MTD Leads</span>
            </div>
            <div className="text-3xl font-bold text-foreground">
              {totalLeads.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">
              Collected this month
            </div>
          </div>

          {/* Monthly Target */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Monthly Target</span>
            </div>
            <div className="text-3xl font-bold text-foreground">
              {totalTarget.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">
              Total target across all clients
            </div>
          </div>

          {/* Current Progress */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Current Progress</span>
            </div>
            <div className={cn(
              "text-3xl font-bold",
              currentProgress >= 100 ? "text-success" : "text-warning"
            )}>
              {currentProgress.toFixed(1)}%
            </div>
            <div className="w-full bg-muted/80 rounded-full h-2 border border-border">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  currentProgress >= 100 ? "bg-success" : "bg-warning"
                )}
                style={{ width: `${Math.min(currentProgress, 100)}%` }}
              />
            </div>
          </div>

          {/* Projected EOM */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Projected EOM</span>
            </div>
            <div className={cn(
              "text-3xl font-bold",
              projectedProgress >= 100 ? "text-success" : "text-destructive"
            )}>
              {projectedEOM.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">
              {projectedProgress.toFixed(1)}% of target
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
