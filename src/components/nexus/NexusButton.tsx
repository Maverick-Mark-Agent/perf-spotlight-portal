import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const nexusButtonVariants = cva(
  "nexus-button focus-nexus disabled:pointer-events-none disabled:opacity-50 transition-nexus",
  {
    variants: {
      variant: {
        primary: "nexus-button-primary",
        secondary: "nexus-button-secondary", 
        ghost: "nexus-button-ghost",
        neural: "bg-nexus-neural-600 text-nexus-slate-100 hover:bg-nexus-neural-500 active:bg-nexus-neural-400",
        synaptic: "bg-nexus-synaptic-500 text-nexus-neural-800 hover:bg-nexus-synaptic-400 active:bg-nexus-synaptic-600 shadow-connection",
        destructive: "bg-destructive text-destructive-foreground hover:bg-nexus-critical-600 active:bg-nexus-critical-700",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-4 py-2 text-sm",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-8 text-lg",
        icon: "h-10 w-10",
      },
      glow: {
        none: "",
        subtle: "hover:shadow-connection",
        strong: "hover:shadow-floating hover:animate-nexus-glow",
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      glow: "none",
    },
  }
);

export interface NexusButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof nexusButtonVariants> {
  asChild?: boolean;
}

const NexusButton = React.forwardRef<HTMLButtonElement, NexusButtonProps>(
  ({ className, variant, size, glow, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(nexusButtonVariants({ variant, size, glow, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
NexusButton.displayName = "NexusButton";

export { NexusButton, nexusButtonVariants };