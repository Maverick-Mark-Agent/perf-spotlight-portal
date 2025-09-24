import React, { useState } from "react";
import { 
  Activity, 
  Database, 
  Zap, 
  Shield, 
  TrendingUp, 
  Users, 
  Search,
  Settings,
  Network,
  Brain,
  Target,
  BarChart3
} from "lucide-react";
import {
  NexusButton,
  NexusCard,
  NexusCardHeader,
  NexusCardTitle,
  NexusCardDescription,
  NexusCardContent,
  NexusMetric,
  NexusConnection,
  NexusConnectionLine,
  NexusNode,
  NexusHexagon,
  NexusStatus,
  NexusInput,
} from "./index";

export const NexusShowcase = () => {
  const [activeConnection, setActiveConnection] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const metrics = [
    { label: "Active Connections", value: "2,847", trend: { value: 12.5, isPositive: true }, icon: <Network className="w-4 h-4" /> },
    { label: "Data Processing Rate", value: "1.2TB/min", trend: { value: -2.1, isPositive: false }, icon: <Database className="w-4 h-4" /> },
    { label: "Neural Efficiency", value: "98.7%", trend: { value: 5.3, isPositive: true }, icon: <Brain className="w-4 h-4" /> },
    { label: "System Load", value: "47%", icon: <Activity className="w-4 h-4" /> },
  ];

  const nodes = [
    { id: "data-source", label: "Data Source", variant: "neural" as const, icon: <Database className="w-4 h-4" /> },
    { id: "processor", label: "AI Processor", variant: "cognitive" as const, icon: <Brain className="w-4 h-4" /> },
    { id: "analytics", label: "Analytics", variant: "synaptic" as const, icon: <BarChart3 className="w-4 h-4" /> },
    { id: "output", label: "Intelligence Output", variant: "default" as const, icon: <Target className="w-4 h-4" /> },
  ];

  return (
    <div className="nexus-grid min-h-screen bg-background py-8">
      <div className="col-span-full">
        <div className="text-center space-y-4 mb-12">
          <h1 className="font-display text-4xl font-bold bg-gradient-to-r from-nexus-cognitive-500 to-nexus-synaptic-500 bg-clip-text text-transparent">
            NEXUS Design System
          </h1>
          <p className="text-lg text-foreground-muted max-w-2xl mx-auto">
            The Intelligence Hub System - Where data flows like neural networks, revealing insights through visual connections
          </p>
        </div>
      </div>

      {/* Button Showcase */}
      <NexusCard variant="elevated">
        <NexusCardHeader>
          <NexusCardTitle>Interactive Elements</NexusCardTitle>
          <NexusCardDescription>
            Signature button variants with Nexus styling and animations
          </NexusCardDescription>
        </NexusCardHeader>
        <NexusCardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <NexusButton variant="primary" glow="subtle">
              Primary Action
            </NexusButton>
            <NexusButton variant="secondary">
              Secondary
            </NexusButton>
            <NexusButton variant="neural" glow="strong">
              Neural Network
            </NexusButton>
            <NexusButton variant="synaptic" size="lg">
              Synaptic Flow
            </NexusButton>
            <NexusButton variant="destructive" size="sm">
              Critical Alert
            </NexusButton>
            <NexusButton variant="ghost">
              <Settings className="w-4 h-4 mr-2" />
              Configure
            </NexusButton>
          </div>
        </NexusCardContent>
      </NexusCard>

      {/* Metrics Dashboard */}
      <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <NexusMetric
            key={index}
            label={metric.label}
            value={metric.value}
            trend={metric.trend}
            icon={metric.icon}
            variant="intelligence"
            emphasis={index === 0 ? "high" : "normal"}
          />
        ))}
      </div>

      {/* Node Network Visualization */}
      <NexusCard variant="neural" className="col-span-full">
        <NexusCardHeader>
          <NexusCardTitle className="text-nexus-slate-100">Intelligence Flow Network</NexusCardTitle>
          <NexusCardDescription className="text-nexus-slate-300">
            Interactive data flow visualization with animated connections
          </NexusCardDescription>
        </NexusCardHeader>
        <NexusCardContent>
          <div className="relative p-8">
            <div className="flex justify-between items-center">
              {nodes.map((node, index) => (
                <div key={node.id} className="relative">
                  <NexusNode
                    variant={node.variant}
                    state={selectedNode === node.id ? "connected" : "active"}
                    interactive="click"
                    icon={node.icon}
                    label={node.label}
                    showLabel
                    onClick={() => setSelectedNode(node.id)}
                  />
                  {index < nodes.length - 1 && (
                    <div className="absolute top-1/2 left-full w-24 h-0.5 -translate-y-1/2">
                      <NexusConnection 
                        active={selectedNode === node.id || selectedNode === nodes[index + 1].id}
                        strength="strong"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-8 flex justify-center">
              <NexusButton
                variant="synaptic"
                onClick={() => setActiveConnection(!activeConnection)}
                glow="strong"
              >
                <Zap className="w-4 h-4 mr-2" />
                {activeConnection ? "Disconnect" : "Activate Network"}
              </NexusButton>
            </div>
          </div>
        </NexusCardContent>
      </NexusCard>

      {/* Hexagonal Data Containers */}
      <NexusCard variant="data">
        <NexusCardHeader>
          <NexusCardTitle>Hexagonal Intelligence Containers</NexusCardTitle>
          <NexusCardDescription>
            Signature hexagonal design elements for key metrics and status indicators
          </NexusCardDescription>
        </NexusCardHeader>
        <NexusCardContent>
          <div className="flex flex-wrap justify-center gap-8">
            <NexusHexagon
              variant="cognitive"
              size="lg"
              state="active"
              interactive="hover"
              icon={<Users className="w-6 h-6" />}
              label="Active Users"
              value="847"
            />
            <NexusHexagon
              variant="synaptic"
              size="lg"
              state="processing"
              interactive="hover"
              icon={<TrendingUp className="w-6 h-6" />}
              label="Growth Rate"
              value="+23%"
            />
            <NexusHexagon
              variant="neural"
              size="lg"
              state="connected"
              interactive="hover"
              icon={<Shield className="w-6 h-6" />}
              label="Security Score"
              value="A+"
            />
          </div>
        </NexusCardContent>
      </NexusCard>

      {/* Status Indicators */}
      <NexusCard variant="elevated">
        <NexusCardHeader>
          <NexusCardTitle>System Status</NexusCardTitle>
          <NexusCardDescription>
            Real-time status indicators with animated feedback
          </NexusCardDescription>
        </NexusCardHeader>
        <NexusCardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <NexusStatus variant="connected" label="Core Systems Online" animated="pulse" />
              <NexusStatus variant="processing" label="AI Processing" animated="glow" />
              <NexusStatus variant="warning" label="High Load Detected" />
              <NexusStatus variant="idle" label="Standby Mode" />
            </div>
          </div>
        </NexusCardContent>
      </NexusCard>

      {/* Input Components */}
      <NexusCard variant="intelligence">
        <NexusCardHeader>
          <NexusCardTitle className="text-nexus-slate-100">Intelligence Interface</NexusCardTitle>
          <NexusCardDescription className="text-nexus-slate-300">
            Advanced input components with neural network styling
          </NexusCardDescription>
        </NexusCardHeader>
        <NexusCardContent>
          <div className="space-y-4">
            <NexusInput
              variant="neural"
              placeholder="Search neural networks..."
              icon={<Search className="w-4 h-4" />}
            />
            <NexusInput
              variant="metric"
              placeholder="0.00"
              suffix={<span className="text-xs">TB/s</span>}
              state="success"
            />
            <NexusInput
              variant="default"
              placeholder="Configure parameters..."
              state="warning"
            />
          </div>
        </NexusCardContent>
      </NexusCard>

      {/* Performance Note */}
      <div className="col-span-full">
        <NexusCard variant="data" className="text-center">
          <NexusCardContent>
            <div className="space-y-2">
              <h3 className="font-display text-lg font-semibold">Performance Optimized</h3>
              <p className="text-sm text-foreground-muted">
                Built with GPU acceleration, reduced motion support, and semantic accessibility.
                All animations respect user preferences and maintain 60fps performance.
              </p>
              <div className="flex justify-center space-x-2 mt-4">
                <div className="nexus-status-connected" />
                <span className="text-xs text-foreground-muted">Production Ready</span>
              </div>
            </div>
          </NexusCardContent>
        </NexusCard>
      </div>
    </div>
  );
};