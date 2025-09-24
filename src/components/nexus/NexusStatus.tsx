import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const nexusStatusVariants = cva(
  "inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium",
  {
    variants: {
      variant: {
        connected: "bg-success-surface text-success border border-success/20",
        disconnected: "bg-destructive-surface text-destructive border border-destructive/20", 
        warning: "bg-warning-surface text-warning border border-warning/20",
        processing: "bg-nexus-cognitive-50 text-nexus-cognitive-700 border border-nexus-cognitive-200",
        idle: "bg-nexus-slate-100 text-nexus-slate-600 border border-nexus-slate-200",
      },
      size: {
        sm: "px-2 py-0.5 text-2xs",
        default: "px-3 py-1 text-xs",
        lg: "px-4 py-2 text-sm",
      },
      animated: {
        none: "",
        pulse: "animate-pulse",
        glow: "animate-nexus-glow",
      }
    },
    defaultVariants: {
      variant: "idle",
      size: "default",
      animated: "none",
    },
  }
);

export interface NexusStatusProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof nexusStatusVariants> {
  label: string;
  showIndicator?: boolean;
}

const NexusStatus = React.forwardRef<HTMLDivElement, NexusStatusProps>(
  ({ 
    className, 
    variant, 
    size, 
    animated,
    label,
    showIndicator = true,
    ...props 
  }, ref) => {
    const getIndicatorClass = () => {
      switch (variant) {
        case "connected":
          return "nexus-status-connected";
        case "warning":
        case "processing":
          return "nexus-status-warning";
        case "disconnected":
          return "nexus-status-error";
        default:
          return "w-2 h-2 rounded-full bg-nexus-slate-400";
      }
    };

    return (
      <div
        ref={ref}
        className={cn(nexusStatusVariants({ variant, size, animated, className }))}
        {...props}
      >
        {showIndicator && (
          <div className={getIndicatorClass()} />
        )}
        <span>{label}</span>
      </div>
    );
  }
);
NexusStatus.displayName = "NexusStatus";

export { NexusStatus, nexusStatusVariants };