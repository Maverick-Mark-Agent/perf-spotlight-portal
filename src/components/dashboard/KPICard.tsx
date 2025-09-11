import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  type?: "default" | "progress" | "percentage";
  progress?: number;
  target?: number;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
}
export const KPICard = ({
  title,
  value,
  subtitle,
  type = "default",
  progress,
  target,
  trend = "neutral",
  icon
}: KPICardProps) => {
  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return "text-dashboard-success";
      case "down":
        return "text-dashboard-danger";
      default:
        return "text-dashboard-secondary";
    }
  };
  return <Card className="bg-dashboard-card border-border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-dashboard-secondary">
            {title}
          </CardTitle>
          {icon && <div className="text-dashboard-accent">{icon}</div>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-2xl font-bold text-dashboard-primary">{value}</div>
          {subtitle}
          {type === "progress" && progress !== undefined && <div className="space-y-1">
              <Progress value={progress * 100} className="h-2" />
              <div className="text-xs text-dashboard-secondary">
                {Math.round(progress * 100)}% of {target} target
              </div>
            </div>}
        </div>
      </CardContent>
    </Card>;
};