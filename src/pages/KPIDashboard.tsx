import { ClientOverviewCard } from "@/components/dashboard/ClientOverviewCard";
import { KPICard } from "@/components/dashboard/KPICard";
import { ProgressPieChart } from "@/components/dashboard/ProgressPieChart";
import { RepliesTimelineView } from "@/components/dashboard/RepliesTimelineView";
import { ComparisonMetrics } from "@/components/dashboard/ComparisonMetrics";
import { ClientPerformanceLists } from "@/components/dashboard/ClientPerformanceLists";
import { AggregateMetricsCard } from "@/components/dashboard/AggregateMetricsCard";
import { UnifiedTopCards } from "@/components/dashboard/UnifiedTopCards";
import { UnifiedClientCard } from "@/components/dashboard/UnifiedClientCard";
import { Button } from "@/components/ui/button";
import { BarChart3, Target, TrendingUp, Users, Zap, RefreshCw, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { useDashboardContext } from "@/contexts/DashboardContext";
import { DataFreshnessIndicator } from "@/components/DataFreshnessIndicator";
import { useMemo, useState, useEffect } from "react";

const MonthlyKPIProgress = () => {
  const { toast } = useToast();
  const {
    kpiDashboard,
    volumeDashboard,
    setKPISelectedClient,
    setKPIViewMode,
    refreshKPIDashboard,
    refreshVolumeDashboard,
    canRefresh,
    getTimeUntilNextRefresh,
  } = useDashboardContext();

  const [refreshCooldown, setRefreshCooldown] = useState(0);

  // Destructure dashboard state
  const {
    clients,
    selectedClient,
    viewMode,
    loading,
    lastUpdated,
    isUsingCache,
    isFresh,
    error,
    warnings,
    fetchDurationMs
  } = kpiDashboard;

  // Clients to display on KPI Dashboard (whitelist)
  const KPI_DASHBOARD_CLIENTS = [
    'David Amiri',
    'Danny Schwartz',
    'Devin Hodo',
    'StreetSmart Commercial',
    'Kim Wallace',
    'Jason Binyon',
    'Nicholas Sakha',
    'SMA Insurance Services',
    'John Roberts',
    'Rob Russell',
    'Kirk Hodgson',
    'Gregg Blanchard',
    'Jeff Schroder',
    'Tony Schmitz'
  ];

  // Filter to only show clients in the whitelist
  const displayedClients = clients.filter(
    client => KPI_DASHBOARD_CLIENTS.includes(client.name)
  );

  // Calculate aggregate metrics for displayed clients only
  const aggregateMetrics = displayedClients.reduce(
    (acc, client) => ({
      totalLeads: acc.totalLeads + client.leadsGenerated,
      totalTarget: acc.totalTarget + client.monthlyKPI,
      projectedEOM: acc.projectedEOM + client.projectedReplies,
    }),
    { totalLeads: 0, totalTarget: 0, projectedEOM: 0 }
  );

  // Update cooldown timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      if (!canRefresh()) {
        setRefreshCooldown(getTimeUntilNextRefresh());
      } else {
        setRefreshCooldown(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [canRefresh, getTimeUntilNextRefresh]);

  const handleRefresh = async () => {
    if (!canRefresh()) {
      toast({
        title: "Please wait",
        description: `You can refresh again in ${refreshCooldown} seconds`,
        variant: "default",
      });
      return;
    }

    await Promise.all([
      refreshKPIDashboard(true),
      refreshVolumeDashboard(true)
    ]);
    toast({
      title: "Success",
      description: "Data refreshed successfully",
    });
  };

  // Merge KPI and Volume data by client name
  const unifiedClients = useMemo(() => {
    const volumeMap = new Map(
      volumeDashboard.clients.map(c => [c.name, c])
    );

    return displayedClients.map(kpiClient => {
      const volumeClient = volumeMap.get(kpiClient.name);

      // Determine status based on KPI performance
      let status: 'above' | 'ontrack' | 'below' = 'below';
      if (kpiClient.leadsGenerated >= kpiClient.monthlyKPI) {
        status = 'above';
      } else if (kpiClient.projectedReplies >= kpiClient.monthlyKPI) {
        status = 'ontrack';
      }

      return {
        name: kpiClient.name,
        // KPI data
        leadsGenerated: kpiClient.leadsGenerated,
        monthlyKPI: kpiClient.monthlyKPI,
        projectedReplies: kpiClient.projectedReplies,
        currentProgress: kpiClient.currentProgress,
        repliesProgress: kpiClient.repliesProgress,
        leadsTarget: kpiClient.leadsTarget,
        repliesTarget: kpiClient.repliesTarget,
        // KPI Timeline data (for expanded view)
        positiveRepliesLast7Days: kpiClient.positiveRepliesLast7Days,
        positiveRepliesLast14Days: kpiClient.positiveRepliesLast14Days,
        positiveRepliesLast30Days: kpiClient.positiveRepliesLast30Days,
        positiveRepliesCurrentMonth: kpiClient.positiveRepliesCurrentMonth,
        positiveRepliesLastMonth: kpiClient.positiveRepliesLastMonth,
        lastWeekVsWeekBeforeProgress: kpiClient.lastWeekVsWeekBeforeProgress,
        positiveRepliesLastVsThisMonth: kpiClient.positiveRepliesLastVsThisMonth,
        // Volume data (with fallbacks)
        emails: volumeClient?.emails || 0,
        emailsToday: volumeClient?.emailsToday || 0,
        target: volumeClient?.target || 0,
        projection: volumeClient?.projection || 0,
        projectedPercentage: volumeClient?.projectedPercentage || 0,
        targetPercentage: volumeClient?.targetPercentage || 0,
        // Detailed metrics
        emailsLast7Days: volumeClient?.emailsLast7Days,
        emailsLast14Days: volumeClient?.emailsLast14Days,
        emailsLast30Days: volumeClient?.emailsLast30Days,
        dailyQuota: volumeClient?.dailyQuota,
        dailySendingTarget: volumeClient?.dailySendingTarget,
        expectedByNow: volumeClient?.expectedByNow,
        // Computed
        status,
      };
    });
  }, [displayedClients, volumeDashboard.clients]);

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
                      setKPIViewMode('overview');
                      setKPISelectedClient(null);
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
              <DataFreshnessIndicator
                lastUpdated={lastUpdated}
                loading={loading}
                error={error || undefined}
                cached={isUsingCache}
                fresh={isFresh}
                warnings={warnings}
              />
              <Button
                onClick={handleRefresh}
                disabled={loading || !canRefresh()}
                variant="outline"
                size="default"
                className="shadow-md hover:shadow-lg transition-all"
                title={!canRefresh() ? `Wait ${refreshCooldown}s to refresh` : 'Refresh dashboard data'}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {refreshCooldown > 0 ? `Wait ${refreshCooldown}s` : 'Refresh Data'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {viewMode === 'overview' ? (
          /* Client Overview Cards */
          loading || volumeDashboard.loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-card rounded-2xl animate-pulse shadow-md" />
              ))}
            </div>
          ) : (
            <>
              {/* Unified Top Cards - Combining KPI and Volume metrics */}
              <UnifiedTopCards
                kpiClients={displayedClients}
                volumeClients={volumeDashboard.clients}
              />

              {/* Unified Client Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {unifiedClients
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
                  <UnifiedClientCard
                    key={client.name}
                    client={client}
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