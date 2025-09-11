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
  status?: "above-target" | "below-target" | "on-target" | "neutral";
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
  status = "neutral",
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

  const getStatusStyles = () => {
    switch (status) {
      case "above-target":
        return "border-dashboard-success bg-dashboard-success/5";
      case "below-target":
        return "border-dashboard-danger bg-dashboard-danger/5";
      case "on-target":
        return "border-dashboard-success bg-dashboard-success/5";
      default:
        return "border-border bg-dashboard-card";
    }
  };

  const getStatusIndicator = () => {
    switch (status) {
      case "above-target":
        return <div className="w-2 h-2 rounded-full bg-dashboard-success animate-pulse" />;
      case "below-target":
        return <div className="w-2 h-2 rounded-full bg-dashboard-danger animate-pulse" />;
      case "on-target":
        return <div className="w-2 h-2 rounded-full bg-dashboard-success animate-pulse" />;
      default:
        return null;
    }
  };
  return <Card className={cn("shadow-sm hover:shadow-md transition-all duration-200", getStatusStyles())}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-dashboard-secondary">
              {title}
            </CardTitle>
            {getStatusIndicator()}
          </div>
          {icon && <div className="text-dashboard-accent">{icon}</div>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className={cn("text-2xl font-bold", 
            status === "above-target" || status === "on-target" ? "text-dashboard-success" : 
            status === "below-target" ? "text-dashboard-danger" : "text-dashboard-primary"
          )}>
            {value}
          </div>
          {subtitle && (
            <div className={cn("text-sm font-medium", getTrendColor())}>
              {subtitle}
            </div>
          )}
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