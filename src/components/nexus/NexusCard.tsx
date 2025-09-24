import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const nexusCardVariants = cva(
  "nexus-panel transition-nexus",
  {
    variants: {
      variant: {
        default: "nexus-metric",
        elevated: "nexus-panel shadow-elevated hover:shadow-floating",
        neural: "bg-nexus-neural-700 border-nexus-neural-600 text-nexus-slate-100",
        intelligence: "bg-gradient-to-br from-nexus-neural-600 to-nexus-cognitive-700 border-nexus-cognitive-500/30 text-nexus-slate-100",
        data: "border-nexus-synaptic-300 bg-nexus-synaptic-50/50 hover:bg-nexus-synaptic-50",
      },
      padding: {
        sm: "p-4",
        default: "p-6", 
        lg: "p-8",
        none: "p-0",
      },
      interactive: {
        none: "",
        hover: "cursor-pointer hover:scale-[1.02] hover:-translate-y-0.5",
        click: "cursor-pointer hover:scale-[1.02] active:scale-[0.98] active:translate-y-0",
      }
    },
    defaultVariants: {
      variant: "default",
      padding: "default",
      interactive: "none",
    },
  }
);

export interface NexusCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof nexusCardVariants> {}

const NexusCard = React.forwardRef<HTMLDivElement, NexusCardProps>(
  ({ className, variant, padding, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(nexusCardVariants({ variant, padding, interactive, className }))}
      {...props}
    />
  )
);
NexusCard.displayName = "NexusCard";

const NexusCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5", className)}
    {...props}
  />
));
NexusCardHeader.displayName = "NexusCardHeader";

const NexusCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-display text-xl font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
NexusCardTitle.displayName = "NexusCardTitle";

const NexusCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-foreground-muted", className)}
    {...props}
  />
));
NexusCardDescription.displayName = "NexusCardDescription";

const NexusCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-4", className)} {...props} />
));
NexusCardContent.displayName = "NexusCardContent";

const NexusCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center justify-between border-t border-border pt-4", className)}
    {...props}
  />
));
NexusCardFooter.displayName = "NexusCardFooter";

export {
  NexusCard,
  NexusCardHeader,
  NexusCardFooter,
  NexusCardTitle,
  NexusCardDescription,
  NexusCardContent,
  nexusCardVariants,
};