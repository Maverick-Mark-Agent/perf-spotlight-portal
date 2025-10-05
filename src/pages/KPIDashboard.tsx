import { useState, useEffect } from "react";
import { ClientOverviewCard } from "@/components/dashboard/ClientOverviewCard";
import { KPICard } from "@/components/dashboard/KPICard";
import { ProgressPieChart } from "@/components/dashboard/ProgressPieChart";
import { RepliesTimelineView } from "@/components/dashboard/RepliesTimelineView";
import { ComparisonMetrics } from "@/components/dashboard/ComparisonMetrics";
import { ClientPerformanceLists } from "@/components/dashboard/ClientPerformanceLists";
import { Button } from "@/components/ui/button";
import { BarChart3, Target, TrendingUp, Users, Zap, RefreshCw, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

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

const CACHE_KEY = 'kpi-dashboard-data';
const CACHE_TIMESTAMP_KEY = 'kpi-dashboard-timestamp';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

const MonthlyKPIProgress = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("30-days");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const { toast } = useToast();

  // View mode: 'overview' or 'detail'
  const [viewMode, setViewMode] = useState<'overview' | 'detail'>('overview');

  // Load cached data on mount
  useEffect(() => {
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

    if (cachedData && cachedTimestamp) {
      try {
        const parsedData = JSON.parse(cachedData);
        const timestamp = new Date(cachedTimestamp);
        setClients(parsedData);
        setLastUpdated(timestamp);
        setIsUsingCache(true);
        setLoading(false);
        console.log("Loaded cached KPI dashboard data from", timestamp);
      } catch (error) {
        console.error("Error loading cached data:", error);
      }
    }

    // Fetch fresh data
    fetchAirtableData();
  }, []);

  // Set up hourly auto-refresh
  useEffect(() => {
    const intervalId = setInterval(() => {
      console.log("Auto-refreshing KPI dashboard data...");
      fetchAirtableData();
    }, CACHE_DURATION);

    return () => clearInterval(intervalId);
  }, []);

  const fetchAirtableData = async (isRefresh = false) => {
    try {
      if (!isRefresh && clients.length > 0) {
        // Don't show loading if we already have cached data
      } else {
        setLoading(true);
      }

      // Add timestamp to bust cache
      const { data, error } = await supabase.functions.invoke('hybrid-workspace-analytics', {
        body: { timestamp: Date.now() }
      });

      if (error) throw error;

      if (data?.clients) {
        setClients(data.clients);

        // Cache the data
        const timestamp = new Date();
        localStorage.setItem(CACHE_KEY, JSON.stringify(data.clients));
        localStorage.setItem(CACHE_TIMESTAMP_KEY, timestamp.toISOString());
        setLastUpdated(timestamp);
        setIsUsingCache(false);
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

  const handleRefresh = async () => {
    await fetchAirtableData(true);
    toast({
      title: "Success",
      description: "Data refreshed successfully",
    });
  };

  const selectedClientData = selectedClient
    ? clients.find(client => client.id === selectedClient) || {
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
      }
    : null;

  // Pass selectedClientData to comparison metrics
  const comparisonMetrics = [
    {
      ...selectedClientData,
      title: "Client Performance Data",
      current: 0,
      previous: 0,
    },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {viewMode === 'overview' ? (
                  <Button asChild variant="ghost" size="sm" className="hover:bg-accent mr-2">
                    <Link to="/">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Portal
                    </Link>
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setViewMode('overview');
                      setSelectedClient(null);
                    }}
                    variant="ghost"
                    size="sm"
                    className="mr-2"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
                <div className="h-6 w-px bg-border"></div>
                <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Dashboard</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {viewMode === 'overview' ? 'Client Performance Overview' : selectedClientData?.name || 'Monthly KPI Progress'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {viewMode === 'overview'
                  ? 'Click on any client card to view detailed metrics'
                  : 'Track lead generation and positive reply metrics in real time'
                }
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleRefresh}
                disabled={loading}
                variant="outline"
                size="default"
                className="shadow-md hover:shadow-lg transition-all"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {viewMode === 'overview' ? (
          /* Client Overview Cards */
          loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-card rounded-2xl animate-pulse shadow-md" />
              ))}
            </div>
          ) : (
            <>
              {/* Client Performance Summary - Compact */}
              <ClientPerformanceLists clients={clients.filter(client => client.monthlyKPI > 0)} />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clients
                .filter(client => client.monthlyKPI > 0) // Only show clients with a target set
                .sort((a, b) => {
                  // Sort by current progress descending (best to worst)
                  // Clients meeting target first, then by progress percentage
                  const aProgress = a.currentProgress * 100;
                  const bProgress = b.currentProgress * 100;
                  const aMeetsTarget = a.leadsGenerated >= a.monthlyKPI;
                  const bMeetsTarget = b.leadsGenerated >= b.monthlyKPI;

                  // Prioritize clients meeting target
                  if (aMeetsTarget && !bMeetsTarget) return -1;
                  if (!aMeetsTarget && bMeetsTarget) return 1;

                  // Then sort by progress percentage
                  return bProgress - aProgress;
                })
                .map((client) => (
                  <ClientOverviewCard
                    key={client.id}
                    client={client}
                    onClick={() => {
                      setSelectedClient(client.id);
                      setViewMode('detail');
                    }}
                  />
                ))}
              </div>
            </>
          )
        ) : (
          /* Client Detail View */
          selectedClientData && (
            <>
              {/* KPI Overview Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <KPICard
                  title="Leads Generated This Month"
                  value={selectedClientData.leadsGenerated}
                  subtitle={`Target: ${selectedClientData.monthlyKPI}`}
                  trend={selectedClientData.leadsGenerated >= selectedClientData.monthlyKPI ? "up" : "down"}
                  status={selectedClientData.leadsGenerated >= selectedClientData.monthlyKPI ? "above-target" : "below-target"}
                  icon={<Users className="h-5 w-5" />}
                />

                <KPICard
                  title="Projected Positive Replies"
                  value={selectedClientData.projectedReplies}
                  subtitle={`EOM Target: ${selectedClientData.monthlyKPI}`}
                  trend={selectedClientData.projectedReplies >= selectedClientData.monthlyKPI ? "up" : "down"}
                  status={selectedClientData.projectedReplies >= selectedClientData.monthlyKPI ? "on-target" : "below-target"}
                  icon={<Target className="h-5 w-5" />}
                />

                <KPICard
                  title="MTD Leads Progress"
                  value={`${Math.round(selectedClientData.currentProgress * 100)}%`}
                  type="progress"
                  progress={selectedClientData.currentProgress}
                  target={100}
                  icon={<BarChart3 className="h-5 w-5" />}
                />

                <div className="md:col-span-1">
                  <ProgressPieChart
                    percentage={selectedClientData.repliesProgress * 100}
                    title="Replies Progress"
                  />
                </div>

                <KPICard
                  title="Monthly KPI Target"
                  value={selectedClientData.monthlyKPI}
                  subtitle="Static target"
                  icon={<Zap className="h-5 w-5" />}
                  status="neutral"
                />
              </div>

              {/* Replies Timeline View */}
              <RepliesTimelineView
                positiveRepliesLast7Days={selectedClientData.positiveRepliesLast7Days}
                positiveRepliesLast14Days={selectedClientData.positiveRepliesLast14Days}
                positiveRepliesLast30Days={selectedClientData.positiveRepliesLast30Days}
                positiveRepliesCurrentMonth={selectedClientData.positiveRepliesCurrentMonth}
                positiveRepliesLastMonth={selectedClientData.positiveRepliesLastMonth}
                positiveRepliesLastVsThisMonth={selectedClientData.positiveRepliesLastVsThisMonth}
                monthlyKpiTarget={selectedClientData.monthlyKPI}
              />

              {/* Comparison Metrics */}
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-foreground">
                  Performance Comparisons
                </h2>
                <ComparisonMetrics metrics={comparisonMetrics} />
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
};

export default MonthlyKPIProgress;