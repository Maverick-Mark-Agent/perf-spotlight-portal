import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const nexusNodeVariants = cva(
  "nexus-node will-change-transform transition-nexus",
  {
    variants: {
      size: {
        sm: "nexus-node-sm",
        default: "",
        lg: "nexus-node-lg",
      },
      variant: {
        default: "bg-gradient-to-br from-primary to-accent",
        neural: "bg-gradient-to-br from-nexus-neural-600 to-nexus-neural-400",
        cognitive: "bg-gradient-to-br from-nexus-cognitive-500 to-nexus-cognitive-300",
        synaptic: "bg-gradient-to-br from-nexus-synaptic-500 to-nexus-synaptic-300",
        critical: "bg-gradient-to-br from-nexus-critical-500 to-nexus-critical-300",
        data: "bg-gradient-to-br from-nexus-slate-600 to-nexus-slate-400",
      },
      state: {
        inactive: "opacity-60",
        active: "shadow-connection animate-nexus-glow",
        connected: "shadow-floating scale-110",
        processing: "animate-nexus-pulse",
      },
      interactive: {
        none: "",
        hover: "hover:scale-110 cursor-pointer",
        click: "hover:scale-110 active:scale-95 cursor-pointer",
      }
    },
    defaultVariants: {
      size: "default",
      variant: "default",
      state: "inactive",
      interactive: "hover",
    },
  }
);

export interface NexusNodeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof nexusNodeVariants> {
  icon?: React.ReactNode;
  label?: string;
  value?: string | number;
  showLabel?: boolean;
}

const NexusNode = React.forwardRef<HTMLDivElement, NexusNodeProps>(
  ({ 
    className, 
    size, 
    variant, 
    state, 
    interactive,
    icon, 
    label, 
    value,
    showLabel = false,
    ...props 
  }, ref) => {
    return (
      <div className="relative inline-flex flex-col items-center space-y-2">
        <div
          ref={ref}
          className={cn(nexusNodeVariants({ size, variant, state, interactive, className }))}
          role="button"
          tabIndex={interactive !== "none" ? 0 : undefined}
          aria-label={label}
          {...props}
        >
          {icon && (
            <span className="text-current">
              {icon}
            </span>
          )}
          {value && !icon && (
            <span className="font-mono text-xs font-bold">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
          )}
        </div>
        
        {showLabel && label && (
          <div className="text-center">
            <div className="data-label text-xs">{label}</div>
            {value && icon && (
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
NexusNode.displayName = "NexusNode";

export { NexusNode, nexusNodeVariants };