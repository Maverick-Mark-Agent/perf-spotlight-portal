import * as React from "react";
import { cn } from "@/lib/utils";
import { NexusCard } from "./NexusCard";
import { cva, type VariantProps } from "class-variance-authority";

const nexusMetricVariants = cva(
  "space-y-2",
  {
    variants: {
      layout: {
        default: "flex flex-col",
        horizontal: "flex items-center justify-between",
        centered: "flex flex-col items-center text-center",
      },
      emphasis: {
        normal: "",
        high: "animate-nexus-glow",
        critical: "animate-pulse border-destructive",
      }
    },
    defaultVariants: {
      layout: "default",
      emphasis: "normal",
    },
  }
);

export interface NexusMetricProps 
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof nexusMetricVariants> {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  description?: string;
  variant?: "default" | "elevated" | "neural" | "intelligence" | "data";
}

const NexusMetric = React.forwardRef<HTMLDivElement, NexusMetricProps>(
  ({ 
    className, 
    label, 
    value, 
    trend, 
    icon, 
    description, 
    variant = "default",
    layout,
    emphasis,
    ...props 
  }, ref) => {
    const formatValue = (val: string | number) => {
      if (typeof val === 'number') {
        return val.toLocaleString();
      }
      return val;
    };

    const getTrendColor = (isPositive: boolean) => {
      return isPositive ? "text-success" : "text-destructive";
    };

    return (
      <NexusCard
        ref={ref}
        variant={variant}
        interactive="hover"
        className={cn(nexusMetricVariants({ layout, emphasis }), className)}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="data-label">{label}</p>
            <div className="flex items-baseline space-x-2">
              <span className="metric text-2xl font-bold">{formatValue(value)}</span>
              {trend && (
                <span className={cn("text-xs font-medium", getTrendColor(trend.isPositive))}>
                  {trend.isPositive ? "+" : ""}{trend.value}%
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-foreground-subtle">{description}</p>
            )}
          </div>
          {icon && (
            <div className="nexus-node nexus-node-sm flex-shrink-0">
              {icon}
            </div>
          )}
        </div>
      </NexusCard>
    );
  }
);
NexusMetric.displayName = "NexusMetric";

export { NexusMetric, nexusMetricVariants };