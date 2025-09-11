import { useState } from "react";
import { ClientSelector } from "@/components/dashboard/ClientSelector";
import { KPICard } from "@/components/dashboard/KPICard";
import { ProgressPieChart } from "@/components/dashboard/ProgressPieChart";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { ComparisonMetrics } from "@/components/dashboard/ComparisonMetrics";
import { BarChart3, Target, TrendingUp, Users, Zap } from "lucide-react";

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