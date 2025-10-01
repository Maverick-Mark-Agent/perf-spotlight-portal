import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  type?: "standard" | "progress";
  progress?: number;
  target?: number;
  trend?: "up" | "down";
  status?: "above-target" | "on-target" | "below-target" | "neutral";
  icon?: React.ReactNode;
}

export const KPICard = ({ 
  title, 
  value, 
  subtitle, 
  type = "standard",
  progress = 0,
  target = 100,
  trend,
  status = "neutral",
  icon
}: KPICardProps) => {
  
  const getStatusStyles = () => {
    switch (status) {
      case "above-target":
        return "border-l-4 border-l-success bg-gradient-to-br from-white to-green-50/30";
      case "on-target":
        return "border-l-4 border-l-success bg-gradient-to-br from-white to-green-50/30";
      case "below-target":
        return "border-l-4 border-l-warning bg-gradient-to-br from-white to-amber-50/30";
      default:
        return "border-l-4 border-l-primary bg-gradient-to-br from-white to-blue-50/30";
    }
  };

  const getStatusBadge = () => {
    if (status === "above-target" || status === "on-target") {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-semibold">
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          On Track
        </div>
      );
    }
    if (status === "below-target") {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/10 text-warning text-xs font-semibold">
          <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
          Needs Attention
        </div>
      );
    }
    return null;
  };

  const getTrendIcon = () => {
    if (trend === "up") {
      return <TrendingUp className="h-4 w-4 text-success" />;
    }
    if (trend === "down") {
      return <TrendingDown className="h-4 w-4 text-warning" />;
    }
    return null;
  };

  return (
    <Card className={`${getStatusStyles()} shadow-md hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden group`}>
      <CardHeader className="pb-3 space-y-0">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
          </div>
          {icon && (
            <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
              {icon}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <p className="text-4xl font-bold text-foreground tracking-tight">
            {value}
          </p>
          {getTrendIcon()}
        </div>

        {type === "progress" && (
          <div className="space-y-2">
            <Progress 
              value={progress} 
              className="h-2 bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              {Math.round(progress)}% of target
            </p>
          </div>
        )}

        {subtitle && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {subtitle}
          </p>
        )}

        {getStatusBadge()}
      </CardContent>
    </Card>
  );
};