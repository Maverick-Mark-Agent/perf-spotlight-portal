import { useState } from "react";
import { ClientSelector } from "@/components/dashboard/ClientSelector";
import { KPICard } from "@/components/dashboard/KPICard";
import { ProgressPieChart } from "@/components/dashboard/ProgressPieChart";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { ComparisonMetrics } from "@/components/dashboard/ComparisonMetrics";
import { BarChart3, Target, TrendingUp, Users, Zap } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// Mock data - in real app this would come from Airtable
const getClientData = (clientId: string) => {
  const baseData = {
    leadsGenerated: 125,
    projectedReplies: 45,
    leadsTarget: 150,
    repliesTarget: 50,
    monthlyKPI: 200,
    currentProgress: 83.3,
    repliesProgress: 90,
  };

  // Simulate different data per client
  const multiplier = clientId === "acme-corp" ? 1.2 : clientId === "techstart" ? 0.8 : 1.0;
  
  return {
    leadsGenerated: Math.round(baseData.leadsGenerated * multiplier),
    projectedReplies: Math.round(baseData.projectedReplies * multiplier),
    leadsTarget: Math.round(baseData.leadsTarget * multiplier),
    repliesTarget: Math.round(baseData.repliesTarget * multiplier),
    monthlyKPI: Math.round(baseData.monthlyKPI * multiplier),
    currentProgress: baseData.currentProgress,
    repliesProgress: baseData.repliesProgress,
  };
};
const underperformingData = [
  { name: "Client A", projectedReplies: 25, monthlyKPI: 50, leadsGenerated: 45 },
  { name: "Client B", projectedReplies: 30, monthlyKPI: 55, leadsGenerated: 52 },
  { name: "Client C", projectedReplies: 20, monthlyKPI: 45, leadsGenerated: 38 },
  { name: "Client D", projectedReplies: 35, monthlyKPI: 60, leadsGenerated: 47 },
];

// Mock data for overperforming clients
const overperformingData = [
  { name: "Client E", projectedReplies: 65, monthlyKPI: 50, leadsGenerated: 78 },
  { name: "Client F", projectedReplies: 70, monthlyKPI: 55, leadsGenerated: 82 },
  { name: "Client G", projectedReplies: 55, monthlyKPI: 45, leadsGenerated: 71 },
  { name: "Client H", projectedReplies: 75, monthlyKPI: 60, leadsGenerated: 89 },
];

const MonthlyKPIProgress = () => {
  const [selectedClient, setSelectedClient] = useState("acme-corp");
  const [selectedPeriod, setSelectedPeriod] = useState("30-days");

  const clientData = getClientData(selectedClient);

  const comparisonMetrics = [
    {
      title: "Last Week VS Week Before Positive Replies % Progress",
      current: 15.2,
      previous: 12.8,
      unit: "%",
    },
    {
      title: "Positive Replies Last VS This Month",
      current: 42,
      previous: 38,
    },
  ];

  return (
    <div className="min-h-screen bg-dashboard-bg p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-dashboard-primary">
              Monthly Lead KPI Progress
            </h1>
            <p className="text-dashboard-secondary mt-1">
              Track lead generation and positive reply metrics
            </p>
          </div>
          <ClientSelector 
            selectedClient={selectedClient} 
            onClientChange={setSelectedClient} 
          />
        </div>

        {/* KPI Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard
            title="Leads Generated This Month"
            value={clientData.leadsGenerated}
            subtitle="+12% vs last month"
            trend="up"
            icon={<Users className="h-5 w-5" />}
          />
          
          <KPICard
            title="Projected Positive Replies (EOM)"
            value={clientData.projectedReplies}
            subtitle="On track"
            trend="up"
            icon={<Target className="h-5 w-5" />}
          />
          
          <KPICard
            title="MTD Leads Progress"
            value={`${clientData.currentProgress}%`}
            subtitle={`${clientData.leadsGenerated} of ${clientData.leadsTarget}`}
            type="progress"
            progress={clientData.currentProgress}
            target={clientData.leadsTarget}
            icon={<BarChart3 className="h-5 w-5" />}
          />
          
          <div className="md:col-span-1">
            <ProgressPieChart
              achieved={clientData.projectedReplies}
              target={clientData.repliesTarget}
              title="Positive Replies % Progress"
            />
          </div>
          
          <KPICard
            title="Monthly KPI Target"
            value={clientData.monthlyKPI}
            subtitle="Static target"
            icon={<Zap className="h-5 w-5" />}
          />
        </div>

        {/* Performance Chart */}
        <PerformanceChart 
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
        />

        {/* Client Performance Analysis */}
        <div>
          <h2 className="text-xl font-semibold text-dashboard-primary mb-4">
            Client Performance Analysis
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Underperforming Clients Chart */}
            <div className="bg-dashboard-card rounded-lg p-6 border shadow-sm">
              <h3 className="text-lg font-medium text-dashboard-primary mb-4">
                Underperforming Clients (Below Monthly KPI)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={underperformingData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-3 border rounded shadow-lg">
                              <p className="font-medium">{label}</p>
                              <p className="text-dashboard-primary">
                                Projected Positive Replies: {payload[0]?.value}
                              </p>
                              <p className="text-dashboard-secondary">
                                Monthly KPI Target: {payload[1]?.value}
                              </p>
                              <p className="text-dashboard-accent">
                                Leads Generated This Month: {payload[0]?.payload?.leadsGenerated}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="projectedReplies" 
                      stroke="hsl(var(--dashboard-primary))" 
                      strokeWidth={2}
                      name="Projected Positive Replies"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="monthlyKPI" 
                      stroke="hsl(var(--dashboard-secondary))" 
                      strokeWidth={2} 
                      strokeDasharray="5 5"
                      name="Monthly KPI Target"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Overperforming Clients Chart */}
            <div className="bg-dashboard-card rounded-lg p-6 border shadow-sm">
              <h3 className="text-lg font-medium text-dashboard-primary mb-4">
                Overperforming Clients (Above KPI Target)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={overperformingData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-3 border rounded shadow-lg">
                              <p className="font-medium">{label}</p>
                              <p className="text-dashboard-success">
                                Projected Positive Replies: {payload[0]?.value}
                              </p>
                              <p className="text-dashboard-secondary">
                                Monthly KPI Target: {payload[1]?.value}
                              </p>
                              <p className="text-dashboard-accent">
                                Leads Generated This Month: {payload[0]?.payload?.leadsGenerated}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="projectedReplies" 
                      stroke="hsl(var(--dashboard-success))" 
                      strokeWidth={2}
                      name="Projected Positive Replies"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="monthlyKPI" 
                      stroke="hsl(var(--dashboard-secondary))" 
                      strokeWidth={2} 
                      strokeDasharray="5 5"
                      name="Monthly KPI Target"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Comparison Metrics */}
        <div>
          <h2 className="text-xl font-semibold text-dashboard-primary mb-4">
            Weekly Performance Comparison
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Last Week vs Week Before */}
            <div className="bg-dashboard-card rounded-lg p-6 border shadow-sm">
              <h3 className="text-lg font-medium text-dashboard-primary mb-4">
                Last Week vs Week Before Positive Replies
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-dashboard-secondary">Last Week</span>
                  <span className="text-2xl font-bold text-dashboard-primary">42</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-dashboard-secondary">Week Before</span>
                  <span className="text-2xl font-bold text-dashboard-secondary">38</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-dashboard-secondary">Difference</span>
                  <span className="text-xl font-semibold text-dashboard-success">+4</span>
                </div>
              </div>
            </div>

            {/* Percentage Progress */}
            <div className="bg-dashboard-card rounded-lg p-6 border shadow-sm">
              <h3 className="text-lg font-medium text-dashboard-primary mb-4">
                Last Week VS Week Before Positive Replies % Progress
              </h3>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-dashboard-success mb-2">
                    +10.5%
                  </div>
                  <div className="text-dashboard-secondary">
                    Improvement over previous week
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-dashboard-success to-dashboard-accent h-3 rounded-full transition-all duration-300"
                    style={{ width: '67%' }}
                  ></div>
                </div>
                <div className="text-sm text-dashboard-secondary text-center">
                  67% of weekly improvement target achieved
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Metrics */}
        <div>
          <h2 className="text-xl font-semibold text-dashboard-primary mb-4">
            Performance Comparisons
          </h2>
          <ComparisonMetrics metrics={comparisonMetrics} />
        </div>
      </div>
    </div>
  );
};

export default MonthlyKPIProgress;