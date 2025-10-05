import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  ArrowLeft,
  RefreshCw,
  Percent,
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

  // Sort clients by profit (descending)
  const sortedByProfit = useMemo(() => {
    return [...clients].sort((a, b) => b.current_month_profit - a.current_month_profit);
  }, [clients]);

  // Calculate average profit margin
  const avgProfitMargin = useMemo(() => {
    if (clients.length === 0) return 0;
    const sum = clients.reduce((acc, c) => acc + c.profit_margin, 0);
    return sum / clients.length;
  }, [clients]);

  // Billing type breakdown
  const billingBreakdown = useMemo(() => [
    { name: 'Per-Lead', value: totals.total_per_lead_revenue, fill: '#10b981' },
    { name: 'Retainer', value: totals.total_retainer_revenue, fill: '#3b82f6' }
  ], [totals]);

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
                  <h1 className="text-2xl font-bold">Revenue Dashboard</h1>
                  <p className="text-sm text-muted-foreground">Real-time profitability tracking</p>
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
                </div>
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">MTD Profit</p>
                  <p className="text-3xl font-bold text-success">${totals.total_mtd_profit.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Projected Revenue</p>
                  <p className="text-3xl font-bold text-info">${totals.total_projected_revenue.toLocaleString()}</p>
                </div>
                <Target className="h-8 w-8 text-info" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Avg Profit Margin</p>
                  <p className="text-3xl font-bold text-foreground">{avgProfitMargin.toFixed(1)}%</p>
                </div>
                <Percent className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="profitability">Profitability</TabsTrigger>
            <TabsTrigger value="breakdown">Client Breakdown</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue by Type */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Billing Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={billingBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {billingBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 flex justify-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-success rounded"></div>
                      <span className="text-sm">Per-Lead: ${totals.total_per_lead_revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-info rounded"></div>
                      <span className="text-sm">Retainer: ${totals.total_retainer_revenue.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top Revenue Clients */}
              <Card>
                <CardHeader>
                  <CardTitle>Top 5 Revenue Generators</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={sortedByProfit.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="workspace_name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                      <Bar dataKey="current_month_revenue" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="profitability" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Client Profitability Ranking</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedByProfit.map((client, idx) => (
                      <TableRow key={client.workspace_name}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-medium">{client.workspace_name}</TableCell>
                        <TableCell className="text-right">${client.current_month_revenue.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-success">${client.current_month_profit.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{client.profit_margin.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="breakdown" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Client Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">MTD Leads</TableHead>
                      <TableHead className="text-right">MTD Revenue</TableHead>
                      <TableHead className="text-right">Projected</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow key={client.workspace_name}>
                        <TableCell className="font-medium">{client.workspace_name}</TableCell>
                        <TableCell>
                          <Badge variant={client.billing_type === 'retainer' ? 'default' : 'secondary'}>
                            {client.billing_type === 'retainer' ? 'Retainer' : 'Per-Lead'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{client.current_month_leads}</TableCell>
                        <TableCell className="text-right">${client.current_month_revenue.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${client.projected_revenue.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={client.profit_margin > 50 ? 'default' : 'secondary'}>
                            {client.profit_margin.toFixed(1)}% margin
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RevenueDashboard;
