import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const nexusHexagonVariants = cva(
  "nexus-hexagon transition-nexus",
  {
    variants: {
      size: {
        sm: "w-12 h-12",
        default: "w-16 h-16", 
        lg: "w-20 h-20",
        xl: "w-24 h-24",
      },
      variant: {
        default: "from-primary/10 to-accent/5",
        neural: "from-nexus-neural-500/20 to-nexus-neural-300/10",
        cognitive: "from-nexus-cognitive-500/20 to-nexus-cognitive-300/10",
        synaptic: "from-nexus-synaptic-500/20 to-nexus-synaptic-300/10",
        critical: "from-nexus-critical-500/20 to-nexus-critical-300/10",
        success: "from-success/20 to-success/5",
      },
      state: {
        default: "",
        active: "animate-nexus-glow shadow-connection",
        processing: "animate-nexus-pulse",
        connected: "scale-110 shadow-floating",
      },
      interactive: {
        none: "",
        hover: "hover:scale-105 cursor-pointer",
        click: "hover:scale-105 active:scale-95 cursor-pointer",
      }
    },
    defaultVariants: {
      size: "default",
      variant: "default", 
      state: "default",
      interactive: "none",
    },
  }
);

export interface NexusHexagonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof nexusHexagonVariants> {
  icon?: React.ReactNode;
  value?: string | number;
  label?: string;
  showValue?: boolean;
}

const NexusHexagon = React.forwardRef<HTMLDivElement, NexusHexagonProps>(
  ({ 
    className, 
    size, 
    variant, 
    state, 
    interactive,
    icon,
    value,
    label,
    showValue = true,
    ...props 
  }, ref) => {
    return (
      <div className="relative inline-flex flex-col items-center space-y-2">
        <div
          ref={ref}
          className={cn(nexusHexagonVariants({ size, variant, state, interactive, className }))}
          role={interactive !== "none" ? "button" : undefined}
          tabIndex={interactive !== "none" ? 0 : undefined}
          aria-label={label}
          {...props}
        >
          <div className="nexus-hexagon-inner flex items-center justify-center text-foreground">
            {icon && (
              <span className="text-current">
                {icon}
              </span>
            )}
            {value && !icon && showValue && (
              <span className="font-mono text-xs font-bold text-center">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </span>
            )}
          </div>
        </div>
        
        {label && (
          <div className="text-center max-w-20">
            <div className="data-label text-xs">{label}</div>
            {value && icon && showValue && (
              <div className="metric text-sm font-semibold">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);
NexusHexagon.displayName = "NexusHexagon";

export { NexusHexagon, nexusHexagonVariants };