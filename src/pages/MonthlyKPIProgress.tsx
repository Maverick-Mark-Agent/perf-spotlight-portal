import { useState, useEffect } from "react";
import { ClientSelector } from "@/components/dashboard/ClientSelector";
import { KPICard } from "@/components/dashboard/KPICard";
import { ProgressPieChart } from "@/components/dashboard/ProgressPieChart";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { ComparisonMetrics } from "@/components/dashboard/ComparisonMetrics";
import { BarChart3, Target, TrendingUp, Users, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ClientData {
  id: string;
  name: string;
  leadsGenerated: number;
  projectedReplies: number;
  leadsTarget: number;
  repliesTarget: number;
  monthlyKPI: number;
  currentProgress: number;
  repliesProgress: number;
  positiveRepliesLast30Days: number;
  positiveRepliesLast7Days: number;
  positiveRepliesLast14Days: number;
  positiveRepliesCurrentMonth: number;
  positiveRepliesLastMonth: number;
  lastWeekVsWeekBeforeProgress: number;
  positiveRepliesLastVsThisMonth: number;
}

const MonthlyKPIProgress = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("30-days");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAirtableData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('airtable-clients');
      
      if (error) throw error;
      
      if (data?.clients) {
        setClients(data.clients);
        if (data.clients.length > 0 && !selectedClient) {
          setSelectedClient(data.clients[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching Airtable data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch client data from Airtable",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAirtableData();
  }, []);

  const selectedClientData = clients.find(client => client.id === selectedClient) || {
    id: '',
    name: '',
    leadsGenerated: 0,
    projectedReplies: 0,
    leadsTarget: 0,
    repliesTarget: 0,
    monthlyKPI: 0,
    currentProgress: 0,
    repliesProgress: 0,
    positiveRepliesLast30Days: 0,
    positiveRepliesLast7Days: 0,
    positiveRepliesLast14Days: 0,
    positiveRepliesCurrentMonth: 0,
    positiveRepliesLastMonth: 0,
    lastWeekVsWeekBeforeProgress: 0,
    positiveRepliesLastVsThisMonth: 0,
  };

  const comparisonMetrics = [
    {
      title: "Last Week VS Week Before Positive Replies % Progress",
      current: selectedClientData.lastWeekVsWeekBeforeProgress,
      previous: selectedClientData.positiveRepliesLast14Days,
      unit: "%",
    },
    {
      title: "Positive Replies Last VS This Month",
      current: selectedClientData.positiveRepliesCurrentMonth,
      previous: selectedClientData.positiveRepliesLastMonth,
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
            clients={clients}
            selectedClient={selectedClient} 
            onClientChange={setSelectedClient}
            loading={loading}
          />
        </div>

        {/* KPI Overview Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-32 bg-dashboard-card rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard
              title="Leads Generated This Month"
              value={selectedClientData.leadsGenerated}
              subtitle="+12% vs last month"
              trend="up"
              icon={<Users className="h-5 w-5" />}
            />
            
            <KPICard
              title="Projected Positive Replies (EOM)"
              value={selectedClientData.projectedReplies}
              subtitle={selectedClientData.projectedReplies >= selectedClientData.monthlyKPI ? "On Track" : "NOT On Track"}
              trend={selectedClientData.projectedReplies >= selectedClientData.monthlyKPI ? "up" : "down"}
              icon={<Target className="h-5 w-5" />}
            />
            
            <KPICard
              title="MTD Leads Progress"
              value={`${selectedClientData.currentProgress}%`}
              subtitle={`${selectedClientData.leadsGenerated} of ${selectedClientData.leadsTarget}`}
              type="progress"
              progress={selectedClientData.currentProgress}
              target={selectedClientData.leadsTarget}
              icon={<BarChart3 className="h-5 w-5" />}
            />
            
            <div className="md:col-span-1">
              <ProgressPieChart
                achieved={selectedClientData.projectedReplies}
                target={selectedClientData.repliesTarget}
                title="Positive Replies % Progress"
              />
            </div>
            
            <KPICard
              title="Monthly KPI Target"
              value={selectedClientData.monthlyKPI}
              subtitle="Static target"
              icon={<Zap className="h-5 w-5" />}
            />
          </div>
        )}

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