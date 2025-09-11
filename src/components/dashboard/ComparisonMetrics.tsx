import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComparisonMetric {
  title: string;
  current: number;
  previous: number;
  unit?: string;
}

interface ComparisonMetricsProps {
  metrics: ComparisonMetric[];
}

export const ComparisonMetrics = ({ metrics }: ComparisonMetricsProps) => {
  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return { percentage: 0, direction: "neutral" as const };
    
    const percentage = ((current - previous) / previous) * 100;
    const direction = percentage > 0 ? "up" : percentage < 0 ? "down" : "neutral";
    
    return { percentage: Math.abs(percentage), direction };
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case "up":
        return <TrendingUp className="h-4 w-4" />;
      case "down":
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <Minus className="h-4 w-4" />;
    }
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case "up":
        return "text-dashboard-success";
      case "down":
        return "text-dashboard-danger";
      default:
        return "text-dashboard-secondary";
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {metrics.map((metric, index) => {
        const trend = calculateTrend(metric.current, metric.previous);
        
        return (
          <Card key={index} className="bg-dashboard-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-dashboard-secondary">
                {metric.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-dashboard-primary">
                    {(metric.current * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};