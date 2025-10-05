import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, ArrowRight } from "lucide-react";

interface ClientOverviewCardProps {
  client: {
    id: string;
    name: string;
    leadsGenerated: number;
    monthlyKPI: number;
    currentProgress: number;
    projectedReplies: number;
  };
  onClick: () => void;
}

export const ClientOverviewCard = ({ client, onClick }: ClientOverviewCardProps) => {
  const progressPercentage = client.currentProgress * 100;
  const isOnTarget = client.leadsGenerated >= client.monthlyKPI;
  const isProjectedOnTarget = client.projectedReplies >= client.monthlyKPI;

  const getStatusColor = () => {
    if (isOnTarget) return "border-success bg-success/5";
    if (isProjectedOnTarget) return "border-warning bg-warning/5";
    return "border-destructive bg-destructive/5";
  };

  const getStatusBadge = () => {
    if (isOnTarget) {
      return (
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-semibold">
          <TrendingUp className="h-3 w-3" />
          Above Target
        </div>
      );
    }
    if (isProjectedOnTarget) {
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

  return (
    <Card
      className={`cursor-pointer hover:shadow-xl transition-all duration-300 border-2 ${getStatusColor()} group`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
              {client.name}
            </h3>
            {getStatusBadge()}
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>

        {/* Metrics */}
        <div className="space-y-4">
          {/* Leads Generated */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm text-muted-foreground font-medium">Positive Replies MTD</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">{client.leadsGenerated}</span>
                <span className="text-sm text-muted-foreground">/ {client.monthlyKPI}</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-2.5 bg-muted rounded-full overflow-hidden border border-border">
              <div
                className={`h-full transition-all duration-500 ${
                  isOnTarget ? "bg-success" : isProjectedOnTarget ? "bg-warning" : "bg-destructive"
                }`}
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

          {/* Projected Replies */}
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground font-medium">Projected EOM</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-foreground">{client.projectedReplies}</span>
                <span className={`text-xs font-semibold ${
                  isProjectedOnTarget ? "text-success" : "text-destructive"
                }`}>
                  {client.projectedReplies >= client.monthlyKPI ? "✓" : "↓"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
