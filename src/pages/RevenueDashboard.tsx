import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, AreaChart, Area, Legend
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  Users,
  ArrowLeft,
  RefreshCw,
  Target,
  Activity,
  AlertCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { useDashboardContext } from "@/contexts/DashboardContext";
import { useToast } from "@/hooks/use-toast";

const RevenueDashboard = () => {
  const { toast } = useToast();
  const { revenueDashboard, refreshRevenueDashboard } = useDashboardContext();
  const { clients, totals, loading, lastUpdated } = revenueDashboard;

  const handleRefresh = async () => {
    await refreshRevenueDashboard(true);
    toast({ title: "Success", description: "Revenue data refreshed successfully" });
  };

  // Sort clients by revenue (descending) for main chart
  const sortedByRevenue = useMemo(() => {
    return [...clients].sort((a, b) => b.current_month_revenue - a.current_month_revenue);
  }, [clients]);

  // Calculate revenue percentages
  const perLeadPercentage = useMemo(() => {
    if (totals.total_mtd_revenue === 0) return 0;
    return (totals.total_per_lead_revenue / totals.total_mtd_revenue) * 100;
  }, [totals]);

  const retainerPercentage = useMemo(() => {
    if (totals.total_mtd_revenue === 0) return 0;
    return (totals.total_retainer_revenue / totals.total_mtd_revenue) * 100;
  }, [totals]);

  // NEW: Daily billable revenue time-series data
  const billableRevenueTimeSeriesData = useMemo(() => {
    console.log('📊 Billable Time-Series - daily_billable_revenue:', totals.daily_billable_revenue);
    console.log('📊 Billable Time-Series - daily_billable_revenue_target:', totals.daily_billable_revenue_target);

    if (!totals.daily_billable_revenue || totals.daily_billable_revenue.length === 0) {
      console.log('⚠️ No daily_billable_revenue data available');
      return [];
    }

    // Add target line for comparison
    const targetPerDay = totals.daily_billable_revenue_target || 0;

    const data = totals.daily_billable_revenue.map((day) => ({
      day: day.day,
      date: day.date,
      cumulative_revenue: day.cumulative_revenue,
      target_cumulative: targetPerDay * day.day,
      daily_revenue: day.daily_revenue,
      lead_count: day.lead_count,
    }));

    console.log('✅ Billable Time-Series Data:', data.length, 'days');
    return data;
  }, [totals.daily_billable_revenue, totals.daily_billable_revenue_target]);

  // NEW: Billable revenue forecast data for line chart
  const billableForecastData = useMemo(() => {
    console.log('🔮 Billable Forecast - billable_forecast:', totals.billable_forecast);

    if (!totals.billable_forecast) {
      console.log('⚠️ No billable_forecast data available');
      return [];
    }

    const { days_elapsed, days_remaining, daily_average } = totals.billable_forecast;
    const currentMTD = totals.total_mtd_billable_revenue || 0;
    const data = [];

    // Historical data (MTD actual billable revenue)
    for (let day = 1; day <= days_elapsed; day++) {
      data.push({
        day,
        actual: daily_average * day,
        label: `Day ${day}`,
      });
    }

    // Forecast data (remaining days) - billable leads only
    for (let day = days_elapsed + 1; day <= days_elapsed + days_remaining; day++) {
      const daysFromNow = day - days_elapsed;
      data.push({
        day,
        conservative: currentMTD + ((totals.billable_forecast.conservative - currentMTD) / days_remaining * daysFromNow),
        linear: currentMTD + ((totals.billable_forecast.linear - currentMTD) / days_remaining * daysFromNow),
        optimistic: currentMTD + ((totals.billable_forecast.optimistic - currentMTD) / days_remaining * daysFromNow),
        target: totals.total_possible_billable_revenue,
        label: `Day ${day}`,
      });
    }

    console.log('✅ Billable Forecast Data:', data.length, 'days');
    return data;
  }, [totals]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Skeleton className="h-16 w-full mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="sm">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Link>
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Revenue & Billing Dashboard</h1>
                  <p className="text-sm text-muted-foreground">Real-time revenue and cost tracking</p>
                </div>
              </div>
            </div>
            <Button onClick={handleRefresh} disabled={loading} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Key Metrics - 6 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">MTD Revenue</p>
                  <p className="text-2xl font-bold text-foreground">${totals.total_mtd_revenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totals.total_mtd_leads || 0} leads
                  </p>
                </div>
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Daily Billable Target</p>
                  <p className="text-2xl font-bold text-info">${(totals.daily_billable_revenue_target || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Target pace for per-lead
                  </p>
                </div>
                <Activity className="h-6 w-6 text-info" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Possible Billable</p>
                  <p className="text-2xl font-bold text-success">${(totals.total_possible_billable_revenue || 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Per-lead clients @ 100% KPI
                  </p>
                </div>
                <Target className="h-6 w-6 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Per-Lead</p>
                  <p className="text-2xl font-bold text-foreground">${totals.total_per_lead_revenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {perLeadPercentage.toFixed(0)}% • {totals.per_lead_count} clients
                  </p>
                </div>
                <Users className="h-6 w-6 text-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Retainer</p>
                  <p className="text-2xl font-bold text-foreground">${totals.total_retainer_revenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {retainerPercentage.toFixed(0)}% • {totals.retainer_count} clients
                  </p>
                </div>
                <DollarSign className="h-6 w-6 text-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">MTD Profit</p>
                  <p className="text-2xl font-bold text-foreground">${totals.total_mtd_profit.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totals.overall_profit_margin?.toFixed(1) || '0.0'}% margin
                  </p>
                </div>
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Billable Lead Revenue Forecast Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Billable Lead Revenue Forecast</CardTitle>
                {totals.billable_forecast && (
                  <Badge variant={
                    totals.billable_forecast.confidence === 'high' ? 'default' :
                    totals.billable_forecast.confidence === 'medium' ? 'secondary' : 'destructive'
                  }>
                    {totals.billable_forecast.confidence} confidence
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Per-lead clients only • MTD actual vs. projected end-of-month scenarios
              </p>
            </CardHeader>
            <CardContent>
              {billableForecastData.length === 0 ? (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No billable forecast data available</p>
                    <p className="text-sm mt-1">Please refresh the dashboard to load data</p>
                    <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-3">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Now
                    </Button>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={billableForecastData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => `$${value.toLocaleString()}`}
                      labelFormatter={(label) => `Day ${label}`}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={3} name="Actual MTD (Billable)" dot={false} />
                    <Line type="monotone" dataKey="conservative" stroke="#f59e0b" strokeWidth={2} strokeDasharray="3 3" name="Conservative" dot={false} />
                    <Line type="monotone" dataKey="linear" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" name="Linear Forecast" dot={false} />
                    <Line type="monotone" dataKey="optimistic" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="3 3" name="Optimistic" dot={false} />
                    <Line type="monotone" dataKey="target" stroke="#ef4444" strokeWidth={2} name="100% KPI Target (Billable)" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {totals.billable_forecast && (
                <div className="mt-4 text-xs text-muted-foreground space-y-1">
                  <div>Conservative: ${totals.billable_forecast.conservative.toLocaleString()} • Linear: ${totals.billable_forecast.linear.toLocaleString()} • Optimistic: ${totals.billable_forecast.optimistic.toLocaleString()}</div>
                  <div>Avg Billable KPI Progress: {totals.billable_forecast.avg_kpi_progress.toFixed(1)}% • {totals.billable_forecast.days_remaining} days remaining</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Billable Revenue Time-Series (Cumulative MTD) */}
          <Card>
            <CardHeader>
              <CardTitle>Billable Lead Revenue (MTD)</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Per-lead clients only • Cumulative revenue by day vs target pace
              </p>
            </CardHeader>
            <CardContent>
              {billableRevenueTimeSeriesData.length === 0 ? (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No billable revenue data available</p>
                    <p className="text-sm mt-1">Please refresh the dashboard to load data</p>
                    <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-3">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Now
                    </Button>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={billableRevenueTimeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="day"
                      label={{ value: 'Day of Month', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis
                      label={{ value: 'Cumulative Revenue ($)', angle: -90, position: 'insideLeft' }}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-card p-3 border border-border rounded-lg shadow-lg">
                              <p className="font-semibold">Day {data.day}</p>
                              <p className="text-sm">Actual: ${data.cumulative_revenue?.toLocaleString()}</p>
                              <p className="text-sm">Target: ${data.target_cumulative?.toLocaleString()}</p>
                              <p className="text-sm text-muted-foreground">Daily: ${data.daily_revenue?.toLocaleString()} ({data.lead_count} leads)</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="cumulative_revenue"
                      stroke="#8b5cf6"
                      fill="#8b5cf6"
                      fillOpacity={0.6}
                      name="Actual Revenue"
                    />
                    <Line
                      type="monotone"
                      dataKey="target_cumulative"
                      stroke="#ef4444"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Target Pace"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              {totals.daily_billable_revenue_target && (
                <div className="mt-4 text-xs text-muted-foreground space-y-1">
                  <div>Daily Target: ${totals.daily_billable_revenue_target.toLocaleString()} • Total MTD: ${totals.total_mtd_billable_revenue?.toLocaleString()}</div>
                  <div>Total Possible (100% KPI): ${totals.total_possible_billable_revenue?.toLocaleString()}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* All Active Clients - Revenue Overview - FULL WIDTH */}
        <div className="space-y-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>All Active Clients - Revenue Overview</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Revenue (blue) and Profit (green = positive, red = negative) for all active clients
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={500}>
                <BarChart data={sortedByRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="workspace_name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                  <Bar dataKey="current_month_revenue" fill="#3b82f6" name="Revenue" />
                  <Bar dataKey="current_month_profit" name="Profit">
                    {sortedByRevenue.map((client, index) => (
                      <Cell
                        key={`cell-profit-${index}`}
                        fill={client.current_month_profit >= 0 ? '#10b981' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Client Breakdown Section */}
        <Card>
          <CardHeader>
            <CardTitle>Client Breakdown - MTD Performance</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Costs auto-calculated from infrastructure data (can be manually overridden)
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">MTD Leads</TableHead>
                  <TableHead className="text-right">MTD Revenue</TableHead>
                  <TableHead className="text-right">Infra Costs</TableHead>
                  <TableHead className="text-right">MTD Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedByRevenue.map((client) => (
                  <TableRow key={client.workspace_name}>
                    <TableCell className="font-medium">{client.workspace_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={client.billing_type === 'retainer' ? 'default' : 'secondary'}>
                          {client.billing_type === 'retainer' ? 'Retainer' : 'Per-Lead'}
                        </Badge>
                        {client.cost_source && (
                          <Badge variant="outline" className="text-xs">
                            {client.cost_source === 'calculated' ? '📊 Auto' : '✏️ Manual'}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{client.current_month_leads}</TableCell>
                    <TableCell className="text-right">${client.current_month_revenue.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span>${client.current_month_costs.toLocaleString()}</span>
                        {client.cost_source === 'calculated' && client.email_account_costs !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            ${client.email_account_costs.toFixed(0)} email
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={client.current_month_profit >= 0 ? 'text-success' : 'text-destructive'}>
                        ${client.current_month_profit.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={client.profit_margin > 50 ? 'default' : client.profit_margin > 0 ? 'secondary' : 'destructive'}>
                        {client.profit_margin.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RevenueDashboard;
