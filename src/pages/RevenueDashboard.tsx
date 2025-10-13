import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  Users,
  ArrowLeft,
  RefreshCw,
  Target
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

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Skeleton className="h-16 w-full mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
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
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">MTD Revenue</p>
                  <p className="text-3xl font-bold text-foreground">${totals.total_mtd_revenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totals.total_mtd_leads || 0} billable leads
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Per-Lead Revenue</p>
                  <p className="text-3xl font-bold text-success">${totals.total_per_lead_revenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {perLeadPercentage.toFixed(1)}% of total • {totals.per_lead_count || 0} clients
                  </p>
                </div>
                <Users className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Retainer Revenue</p>
                  <p className="text-3xl font-bold text-info">${totals.total_retainer_revenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {retainerPercentage.toFixed(1)}% of total • {totals.retainer_count || 0} clients
                  </p>
                </div>
                <Target className="h-8 w-8 text-info" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">MTD Profit</p>
                  <p className="text-3xl font-bold text-foreground">${totals.total_mtd_profit.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totals.overall_profit_margin?.toFixed(1) || '0.0'}% margin
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
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
                      <Badge variant={client.billing_type === 'retainer' ? 'default' : 'secondary'}>
                        {client.billing_type === 'retainer' ? 'Retainer' : 'Per-Lead'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{client.current_month_leads}</TableCell>
                    <TableCell className="text-right">${client.current_month_revenue.toLocaleString()}</TableCell>
                    <TableCell className="text-right">${client.current_month_costs.toLocaleString()}</TableCell>
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
