import * as React from "react";
import { cn } from "@/lib/utils";

export interface NexusConnectionProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  animated?: boolean;
  strength?: "weak" | "normal" | "strong";
  direction?: "horizontal" | "vertical" | "diagonal";
}

const NexusConnection = React.forwardRef<HTMLDivElement, NexusConnectionProps>(
  ({ 
    className, 
    active = false,
    animated = true,
    strength = "normal",
    direction = "horizontal",
    ...props 
  }, ref) => {
    const getStrengthClass = () => {
      switch (strength) {
        case "weak":
          return "opacity-40";
        case "strong":
          return "opacity-100 scale-110";
        default:
          return "opacity-70";
      }
    };

    const getDirectionClass = () => {
      switch (direction) {
        case "vertical":
          return "w-0.5 h-full";
        case "diagonal":
          return "w-full h-0.5 rotate-45";
        default:
          return "w-full h-0.5";
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          "nexus-connection relative",
          getDirectionClass(),
          getStrengthClass(),
          {
            "animate-nexus-pulse": animated && active,
            "animate-nexus-flow": animated && !active,
          },
          className
        )}
        {...props}
      />
    );
  }
);
NexusConnection.displayName = "NexusConnection";

// SVG Connection Line Component for Complex Paths
export interface NexusConnectionLineProps extends Omit<React.SVGAttributes<SVGElement>, 'start' | 'end'> {
  start: { x: number; y: number };
  end: { x: number; y: number };
  active?: boolean;
  animated?: boolean;
  curved?: boolean;
}

const NexusConnectionLine = React.forwardRef<SVGSVGElement, NexusConnectionLineProps>(
  ({ 
    start, 
    end, 
    active = false,
    animated = true,
    curved = true,
    className,
    ...props 
  }, ref) => {
    const createPath = () => {
      if (!curved) {
        return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
      }
      
      // Create a smooth curve
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const controlOffset = Math.abs(end.x - start.x) * 0.3;
      
      return `M ${start.x} ${start.y} Q ${midX} ${midY - controlOffset} ${end.x} ${end.y}`;
    };

    return (
      <svg
        ref={ref}
        className={cn("absolute inset-0 pointer-events-none", className)}
        {...props}
      >
        <defs>
          <linearGradient id="nexus-connection-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--nexus-cognitive-500))" stopOpacity="0.2" />
            <stop offset="50%" stopColor="hsl(var(--nexus-synaptic-500))" stopOpacity="0.8" />
            <stop offset="100%" stopColor="hsl(var(--nexus-cognitive-500))" stopOpacity="0.2" />
          </linearGradient>
          <filter id="nexus-connection-glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <path
          d={createPath()}
          stroke="url(#nexus-connection-gradient)"
          strokeWidth="2"
          fill="none"
          strokeDasharray={animated ? "5,5" : "none"}
          filter="url(#nexus-connection-glow)"
          className={cn({
            "animate-nexus-connect": active && animated,
          })}
        />
        {active && (
          <circle
            r="3"
            fill="hsl(var(--nexus-synaptic-500))"
            className="animate-nexus-data-flow"
          >
            <animateMotion
              dur="2s"
              repeatCount="indefinite"
              path={createPath()}
            />
          </circle>
        )}
      </svg>
    );
  }
);
NexusConnectionLine.displayName = "NexusConnectionLine";

export { NexusConnection, NexusConnectionLine };