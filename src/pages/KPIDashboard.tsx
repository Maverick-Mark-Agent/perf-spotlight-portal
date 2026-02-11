import { ClientOverviewCard } from "@/components/dashboard/ClientOverviewCard";
import { KPICard } from "@/components/dashboard/KPICard";
import { ProgressPieChart } from "@/components/dashboard/ProgressPieChart";
import { RepliesTimelineView } from "@/components/dashboard/RepliesTimelineView";
import { ComparisonMetrics } from "@/components/dashboard/ComparisonMetrics";
import { ClientPerformanceLists } from "@/components/dashboard/ClientPerformanceLists";
import { AggregateMetricsCard } from "@/components/dashboard/AggregateMetricsCard";
import { UnifiedTopCards } from "@/components/dashboard/UnifiedTopCards";
import { UnifiedClientCard } from "@/components/dashboard/UnifiedClientCard";
import { DailyVolumeBanner } from "@/components/dashboard/DailyVolumeBanner";
import { KPIMonthPicker } from "@/components/dashboard/KPIMonthPicker";
import { DailyReplyTrendChart } from "@/components/dashboard/DailyReplyTrendChart";
import { ClientReplyBreakdownTable } from "@/components/dashboard/ClientReplyBreakdownTable";
import { InfrastructureAlertBanner } from "@/components/dashboard/InfrastructureAlertBanner";
import { Button } from "@/components/ui/button";
import { BarChart3, Target, TrendingUp, Users, Zap, RefreshCw, ArrowLeft, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { useDashboardContext } from "@/contexts/DashboardContext";
import { DataFreshnessIndicator } from "@/components/DataFreshnessIndicator";
import { useHistoricalKPI } from "@/hooks/useHistoricalKPI";
import { useReplyMetrics } from "@/hooks/useReplyMetrics";
import { supabase } from "@/integrations/supabase/client";
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
  const [isWebhookLoading, setIsWebhookLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Month picker state
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === (now.getMonth() + 1);

  // Historical data hook
  const historical = useHistoricalKPI();

  // Reply metrics hook
  const replyMetrics = useReplyMetrics();
  const [selectedReplyClients, setSelectedReplyClients] = useState<string[]>([]);

  // Fetch historical data when month changes (non-current)
  useEffect(() => {
    if (!isCurrentMonth) {
      historical.fetchHistoricalMonth(selectedYear, selectedMonth);
    }
  }, [selectedYear, selectedMonth, isCurrentMonth]);

  // Fetch reply metrics when month changes
  useEffect(() => {
    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    replyMetrics.fetchData(startDate, endDate);
  }, [selectedYear, selectedMonth]);

  // Initialize with all clients selected when clients data loads
  useEffect(() => {
    if (activeClients.length > 0 && selectedReplyClients.length === 0) {
      setSelectedReplyClients(activeClients.map(c => c.name));
    }
  }, [activeClients]);

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
  };

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

  // Use historical or live clients based on selection
  const activeClients = isCurrentMonth ? clients : historical.clients;
  const activeLoading = isCurrentMonth ? loading : historical.loading;

  // NOTE: Client filtering is now handled at the data layer via kpi_dashboard_enabled
  // and volume_dashboard_enabled toggles in client_registry table.
  // See realtimeDataService.ts for the database query filters.

  // Calculate aggregate metrics for all clients (already filtered by toggle)
  const aggregateMetrics = activeClients.reduce(
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

  const handleSlackNotification = async () => {
    setIsWebhookLoading(true);
    try {
      console.log("Sending volume report to Slack...");
      const { data, error } = await supabase.functions.invoke('send-volume-slack-dm');

      if (error) throw error;

      console.log("Slack response:", data);
      toast({
        title: "Success",
        description: "Volume report sent to Slack successfully",
      });
    } catch (error) {
      console.error("Error sending to Slack:", error);
      toast({
        title: "Error",
        description: "Failed to send volume report to Slack. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsWebhookLoading(false);
    }
  };

  const handleSyncMetrics = async () => {
    setIsSyncing(true);
    try {
      console.log("Syncing daily metrics from Email Bison...");
      const { data, error } = await supabase.functions.invoke('sync-daily-kpi-metrics');

      if (error) throw error;

      console.log("Sync response:", data);
      toast({
        title: "Success",
        description: "Daily metrics synced successfully. Refreshing dashboard...",
      });

      // Refresh dashboard after sync
      await handleRefresh();
    } catch (error) {
      console.error("Error syncing metrics:", error);
      toast({
        title: "Error",
        description: "Failed to sync daily metrics. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Merge KPI and Volume data by client name
  const unifiedClients = useMemo(() => {
    // For historical months, don't merge live volume data — use only client_metrics
    const volumeMap = isCurrentMonth
      ? new Map(volumeDashboard.clients.map(c => [c.name, c]))
      : new Map();

    return activeClients.map(kpiClient => {
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
        // Volume data — live volumeDashboard for current month, client_metrics for historical
        emails: volumeClient?.emails || kpiClient.emailsSentMTD || 0,
        emailsToday: volumeClient?.emailsToday || 0,
        emailsTomorrow: volumeClient?.emailsTomorrow || 0,
        target: volumeClient?.target || kpiClient.monthlySendingTarget || 0,
        projection: volumeClient?.projection || kpiClient.emailsSentProjection || 0,
        projectedPercentage: volumeClient?.projectedPercentage || (kpiClient.monthlySendingTarget > 0 ? (kpiClient.emailsSentProjection / kpiClient.monthlySendingTarget) * 100 : 0),
        targetPercentage: volumeClient?.targetPercentage || (kpiClient.monthlySendingTarget > 0 ? (kpiClient.emailsSentMTD / kpiClient.monthlySendingTarget) * 100 : 0),
        // Detailed metrics (only available for current month via live volume)
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
  }, [activeClients, volumeDashboard.clients, isCurrentMonth]);

  const selectedClientData = selectedClient
    ? activeClients.find(client => client.id === selectedClient) || {
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
                    <Link to="/admin">
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
                {isCurrentMonth ? (
                  <>
                    <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Dashboard</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Historical View</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-4">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  {viewMode === 'overview' ? 'Client Performance Overview' : selectedClientData?.name || 'Monthly KPI Progress'}
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <KPIMonthPicker
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                  onChange={handleMonthChange}
                  isCurrentMonth={isCurrentMonth}
                />
                {!isCurrentMonth && historical.metricDate && (
                  <span className="text-xs text-muted-foreground">
                    Data from: {new Date(historical.metricDate + 'T00:00:00').toLocaleDateString()}
                  </span>
                )}
              </div>
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
                onClick={handleSyncMetrics}
                disabled={isSyncing}
                variant="outline"
                size="default"
                className="shadow-md hover:shadow-lg transition-all border-success/50 hover:border-success"
                title="Sync today's metrics from Email Bison"
              >
                <BarChart3 className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-pulse' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Metrics'}
              </Button>
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
              <Button
                onClick={handleSlackNotification}
                disabled={isWebhookLoading}
                variant="default"
                size="default"
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-md hover:shadow-lg transition-all"
                title="Send daily volume report to Slack"
              >
                <Send className={`h-4 w-4 mr-2 ${isWebhookLoading ? 'animate-pulse' : ''}`} />
                {isWebhookLoading ? 'Sending...' : 'Send to Slack'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {viewMode === 'overview' ? (
          /* Client Overview Cards */
          activeLoading || (isCurrentMonth && volumeDashboard.loading) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-muted/80 rounded-2xl shadow-md relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-foreground/10 before:to-transparent" />
              ))}
            </div>
          ) : (
            <>
              {/* Daily Volume Banner - Aggregate totals for today/tomorrow (current month only) */}
              {isCurrentMonth && (
                <DailyVolumeBanner
                  clients={volumeDashboard.clients}
                  loading={volumeDashboard.loading}
                />
              )}

              {/* Unified Top Cards - Combining KPI and Volume metrics */}
              <UnifiedTopCards
                kpiClients={activeClients}
                volumeClients={isCurrentMonth ? volumeDashboard.clients : unifiedClients}
                onRefresh={handleRefresh}
                isRefreshing={loading}
                isCurrentMonth={isCurrentMonth}
              />

              {/* Historical data error */}
              {!isCurrentMonth && historical.error && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center">
                  <p className="text-amber-700 dark:text-amber-300 text-sm">{historical.error}</p>
                </div>
              )}

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

              {/* Infrastructure Alerts */}
              {isCurrentMonth && replyMetrics.alerts.length > 0 && (
                <InfrastructureAlertBanner alerts={replyMetrics.alerts} />
              )}

              {/* Reply Tracking Section */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-foreground">Reply Rate & Interested Lead Tracking</h2>
                </div>

                {/* Daily Reply Trend Chart */}
                <DailyReplyTrendChart
                  data={replyMetrics.getFilteredDailyTrend(selectedReplyClients)}
                  selectedClients={selectedReplyClients}
                  onClientChange={setSelectedReplyClients}
                  availableClients={activeClients.map(c => c.name)}
                  loading={replyMetrics.loading}
                />

                {/* Client Reply Breakdown Table */}
                <ClientReplyBreakdownTable
                  data={replyMetrics.clientBreakdown}
                  loading={replyMetrics.loading}
                />
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