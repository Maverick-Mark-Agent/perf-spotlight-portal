import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const nexusInputVariants = cva(
  "nexus-input",
  {
    variants: {
      variant: {
        default: "",
        neural: "bg-nexus-neural-700 border-nexus-neural-600 text-nexus-slate-100 placeholder:text-nexus-slate-400",
        search: "pl-10 bg-nexus-slate-50 border-nexus-slate-300",
        metric: "font-mono text-right tabular-nums",
      },
      size: {
        sm: "h-8 px-2 text-xs",
        default: "h-10 px-3 text-sm",
        lg: "h-12 px-4 text-base",
      },
      state: {
        default: "",
        error: "border-destructive focus:border-destructive focus:ring-destructive",
        success: "border-success focus:border-success focus:ring-success",
        warning: "border-warning focus:border-warning focus:ring-warning",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default", 
      state: "default",
    },
  }
);

export interface NexusInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof nexusInputVariants> {
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
}

const NexusInput = React.forwardRef<HTMLInputElement, NexusInputProps>(
  ({ className, variant, size, state, icon, suffix, ...props }, ref) => {
    if (icon || suffix) {
      return (
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">
              {icon}
            </div>
          )}
          <input
            className={cn(
              nexusInputVariants({ variant, size, state }),
              {
                "pl-10": icon,
                "pr-10": suffix,
              },
              className
            )}
            ref={ref}
            {...props}
          />
          {suffix && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted">
              {suffix}
            </div>
          )}
        </div>
      );
    }

    return (
      <input
        className={cn(nexusInputVariants({ variant, size, state, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
NexusInput.displayName = "NexusInput";

export { NexusInput, nexusInputVariants };