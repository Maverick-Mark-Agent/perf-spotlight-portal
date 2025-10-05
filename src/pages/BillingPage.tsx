import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ReferenceLine
} from 'recharts';
import { 
  DollarSign, 
  TrendingUp,
  TrendingDown, 
  Target, 
  Users, 
  ArrowLeft,
  Calculator,
  PieChart as PieChartIcon,
  Activity,
  Filter,
  ChevronDown,
  Download
} from "lucide-react";
import { Link } from "react-router-dom";

interface ClientBillingData {
  id: string;
  name: string;
  monthlyKPI: number;
  positiveRepliesMTD: number;
  pricePerLead: number;
  monthlyRevenue: number;
  kpiProgress: number;
  status: 'on-track' | 'warning' | 'danger';
  isActive: boolean;
}

const BillingDashboard = () => {
  const [clientsData, setClientsData] = useState<ClientBillingData[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBillingData = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.functions.invoke('hybrid-workspace-analytics');
        
        if (error) {
          throw new Error(error.message || 'Failed to fetch client data');
        }

        const billingData: ClientBillingData[] = data.clients
          .map((client: any) => {
            const positiveRepliesMTD = client.leadsGenerated || 0;
            const monthlyRevenue = client.payout || 0; // Use Payout field from Airtable
            const monthlyKPI = client.monthlyKPI || 0;
            const pricePerLead = positiveRepliesMTD > 0 ? monthlyRevenue / positiveRepliesMTD : 0; // Calculate price per lead
            const kpiProgress = monthlyKPI > 0 ? (positiveRepliesMTD / monthlyKPI) * 100 : 0;
            
            // Debug log for first few clients
            if (data.clients.indexOf(client) < 3) {
              console.log(`Client ${client.name}:`, {
                positiveRepliesMTD,
                monthlyKPI,
                kpiProgress,
                monthlyRevenue
              });
            }
            
            let status: 'on-track' | 'warning' | 'danger' = 'on-track';
            if (kpiProgress < 50) status = 'danger';
            else if (kpiProgress < 80) status = 'warning';

            return {
              id: client.id,
              name: client.name,
              monthlyKPI,
              positiveRepliesMTD,
              pricePerLead,
              monthlyRevenue,
              kpiProgress: Math.round(kpiProgress * 100) / 100, // Round to 2 decimal places
              status,
              isActive: monthlyRevenue > 0 && monthlyKPI > 0 // Only active if both revenue and KPI exist
            };
          })
          .filter((client: ClientBillingData) => client.isActive); // Only show active clients

        console.log('Processed billing data:', billingData.map(c => ({ 
          name: c.name, 
          kpiProgress: c.kpiProgress, 
          leads: c.positiveRepliesMTD, 
          kpi: c.monthlyKPI 
        })));

        setClientsData(billingData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchBillingData();
  }, []);

  // Filter and organize data
  const activeClients = useMemo(() => clientsData.filter(client => client.isActive), [clientsData]);
  
  const kpiCategories = useMemo(() => {
    const aboveKPI = activeClients.filter(client => client.kpiProgress >= 100);
    const belowKPI = activeClients.filter(client => client.kpiProgress < 100);
    return { aboveKPI, belowKPI };
  }, [activeClients]);

  const chartData = useMemo(() => {
    return activeClients.map(client => ({
      name: client.name.length > 15 ? client.name.substring(0, 15) + '...' : client.name,
      revenue: client.monthlyRevenue,
      kpiProgress: client.kpiProgress,
      leads: client.positiveRepliesMTD,
      target: client.monthlyKPI,
      status: client.status
    }));
  }, [activeClients]);

  // Sort clients by KPI progress for the new chart (lowest to highest)
  const sortedByKpiProgress = useMemo(() => {
    return [...activeClients]
      .sort((a, b) => a.kpiProgress - b.kpiProgress)
      .map(client => ({
        name: client.name.length > 12 ? client.name.substring(0, 12) + '...' : client.name,
        fullName: client.name,
        kpiProgress: Math.min(client.kpiProgress, 150), // Cap at 150% for better visualization
        actualProgress: client.kpiProgress,
        leads: client.positiveRepliesMTD,
        target: client.monthlyKPI,
        revenue: client.monthlyRevenue,
        status: client.status,
        color: client.kpiProgress >= 100 ? '#10b981' : 
               client.kpiProgress >= 80 ? '#f59e0b' : 
               client.kpiProgress >= 50 ? '#f97316' : '#ef4444'
      }));
  }, [activeClients]);

  const selectedClientData = useMemo(() => {
    if (selectedClient === "all") return null;
    return activeClients.find(client => client.id === selectedClient);
  }, [selectedClient, activeClients]);

  // Sort clients by payout for table view
  const sortedClientsByPayout = useMemo(() => {
    return [...activeClients].sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);
  }, [activeClients]);

  const totalStats = useMemo(() => {
    return activeClients.reduce(
      (acc, client) => ({
        totalRevenue: acc.totalRevenue + client.monthlyRevenue,
        totalTargetPayout: acc.totalTargetPayout + (client.monthlyKPI * client.pricePerLead),
        totalLeads: acc.totalLeads + client.positiveRepliesMTD,
        totalKPI: acc.totalKPI + client.monthlyKPI,
        averageProgress: acc.averageProgress + client.kpiProgress
      }),
      { totalRevenue: 0, totalTargetPayout: 0, totalLeads: 0, totalKPI: 0, averageProgress: 0 }
    );
  }, [activeClients]);

  const avgProgress = activeClients.length > 0 ? totalStats.averageProgress / activeClients.length : 0;

  const exportToCSV = () => {
    const headers = ['Client Name', 'Monthly Payout ($)', 'Target Payout ($)', 'Leads Generated', 'Monthly KPI', 'KPI Progress (%)', 'Price per Lead ($)', 'Status'];
    const csvData = [
      headers,
      ...sortedClientsByPayout.map(client => [
        client.name,
        client.monthlyRevenue,
        (client.monthlyKPI * client.pricePerLead).toFixed(2),
        client.positiveRepliesMTD,
        client.monthlyKPI,
        client.kpiProgress.toFixed(1),
        client.pricePerLead.toFixed(2),
        client.status === 'on-track' ? 'On Track' : client.status === 'warning' ? 'Warning' : 'Danger'
      ])
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `billing-dashboard-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Card className="bg-card border-2 border-destructive/40 shadow-lg rounded-2xl max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="h-8 w-8 text-destructive" />
            </div>
            <div className="text-destructive text-lg font-semibold mb-2">Error loading billing data</div>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button asChild className="rounded-xl">
              <Link to="/">Return to Home</Link>
            </Button>
          </CardContent>
        </Card>
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
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hover:bg-accent"
              >
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Billing Dashboard</h1>
                  <p className="text-muted-foreground text-sm">Client revenue and KPI performance tracking</p>
                </div>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-success/10 border border-success/40 rounded-full">
              <span className="text-xs font-semibold text-success">● Live Data</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Client Selection and Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-card border-2 border-border shadow-lg rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-sm font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                Client Selection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="bg-background border-2 border-border rounded-xl">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Active Clients</SelectItem>
                  {activeClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="bg-card border-2 border-border shadow-lg rounded-2xl hover:shadow-xl transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">Active Clients</p>
                  <p className="text-3xl font-bold text-foreground">{activeClients.length}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-2 border-success/20 shadow-lg rounded-2xl hover:shadow-xl transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">Above KPI</p>
                  <p className="text-3xl font-bold text-success">{kpiCategories.aboveKPI.length}</p>
                </div>
                <div className="p-3 bg-success/10 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-2 border-warning/20 shadow-lg rounded-2xl hover:shadow-xl transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">Below KPI</p>
                  <p className="text-3xl font-bold text-warning">{kpiCategories.belowKPI.length}</p>
                </div>
                <div className="p-3 bg-warning/10 rounded-xl">
                  <Target className="h-6 w-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Selected Client Detail */}
        {selectedClientData && (
          <Card className="bg-card border-2 border-primary/20 shadow-lg rounded-2xl mb-8">
            <CardHeader>
              <CardTitle className="text-foreground text-xl font-bold flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                {selectedClientData.name} - Detailed View
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center p-5 bg-primary/5 border-2 border-primary/20 rounded-xl">
                <div className="text-3xl font-bold text-foreground mb-1">${selectedClientData.monthlyRevenue.toLocaleString()}</div>
                <div className="text-muted-foreground text-sm font-medium">Monthly Revenue</div>
              </div>
              <div className="text-center p-5 bg-info/5 border-2 border-info/20 rounded-xl">
                <div className="text-3xl font-bold text-foreground mb-1">{selectedClientData.positiveRepliesMTD}</div>
                <div className="text-muted-foreground text-sm font-medium">Leads MTD</div>
              </div>
              <div className="text-center p-5 bg-accent/5 border-2 border-accent/20 rounded-xl">
                <div className="text-3xl font-bold text-foreground mb-1">{selectedClientData.monthlyKPI}</div>
                <div className="text-muted-foreground text-sm font-medium">Monthly Target</div>
              </div>
              <div className="text-center p-5 bg-muted/30 border-2 border-border rounded-xl">
                <div className={`text-3xl font-bold mb-1 ${
                  selectedClientData.kpiProgress >= 100 ? 'text-success' : 
                  selectedClientData.kpiProgress >= 80 ? 'text-warning' : 'text-destructive'
                }`}>
                  {selectedClientData.kpiProgress.toFixed(1)}%
                </div>
                <div className="text-muted-foreground text-sm font-medium">KPI Progress</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts and Analytics */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-card border-2 border-border shadow-md rounded-xl p-1">
            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Overview</TabsTrigger>
            <TabsTrigger value="revenue" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Revenue Analysis</TabsTrigger>
            <TabsTrigger value="performance" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">KPI Performance</TabsTrigger>
            <TabsTrigger value="table" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Total View</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Enhanced KPI Progress Chart - Line Chart */}
              <Card className="bg-card border-2 border-border shadow-lg rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    KPI Progress Trend (Sorted by Performance)
                  </CardTitle>
                  <p className="text-muted-foreground text-sm">Client KPI achievement trend from lowest to highest performers</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart 
                      data={sortedByKpiProgress}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: 'white', fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval={0}
                      />
                      <YAxis 
                        tick={{ fill: 'white', fontSize: 12 }}
                        domain={[0, 'dataMax + 20']}
                        label={{ value: 'KPI Progress (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: 'white' } }}
                      />
                      <ReferenceLine y={100} stroke="#10b981" strokeDasharray="5 5" strokeWidth={2} />
                      <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} />
                      <ReferenceLine y={50} stroke="#f97316" strokeDasharray="3 3" strokeWidth={1} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(0,0,0,0.9)', 
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '8px',
                          color: 'white'
                        }}
                        formatter={(value, name, props) => [
                          `${props.payload.actualProgress.toFixed(1)}%`,
                          'KPI Progress'
                        ]}
                        labelFormatter={(label, payload) => {
                          if (payload && payload[0]) {
                            const data = payload[0].payload;
                            return (
                              <div className="space-y-1">
                                <div className="font-semibold">{data.fullName}</div>
                                <div className="text-sm opacity-80">
                                  Leads: {data.leads}/{data.target} | Revenue: ${data.revenue.toLocaleString()}
                                </div>
                              </div>
                            );
                          }
                          return label;
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="actualProgress" 
                        stroke="#8884d8" 
                        strokeWidth={3}
                        dot={{ fill: '#8884d8', strokeWidth: 2, r: 6 }}
                        activeDot={{ r: 8, stroke: '#8884d8', strokeWidth: 2, fill: 'white' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/70">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-0.5 bg-dashboard-success"></div>
                      <span>100% KPI Target</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-0.5 bg-dashboard-warning"></div>
                      <span>80% Warning Line</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-0.5 bg-orange-500"></div>
                      <span>50% Critical Line</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Enhanced Performance Distribution Donut */}
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5" />
                    Performance Distribution
                  </CardTitle>
                  <p className="text-white/70 text-sm">Client distribution across performance tiers</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { 
                            name: 'Exceeding (≥100%)', 
                            count: activeClients.filter(c => c.kpiProgress >= 100).length,
                            percentage: ((activeClients.filter(c => c.kpiProgress >= 100).length / activeClients.length) * 100).toFixed(1),
                            fill: '#10b981' 
                          },
                          { 
                            name: 'On Track (80-99%)', 
                            count: activeClients.filter(c => c.kpiProgress >= 80 && c.kpiProgress < 100).length,
                            percentage: ((activeClients.filter(c => c.kpiProgress >= 80 && c.kpiProgress < 100).length / activeClients.length) * 100).toFixed(1),
                            fill: '#f59e0b' 
                          },
                          { 
                            name: 'At Risk (50-79%)', 
                            count: activeClients.filter(c => c.kpiProgress >= 50 && c.kpiProgress < 80).length,
                            percentage: ((activeClients.filter(c => c.kpiProgress >= 50 && c.kpiProgress < 80).length / activeClients.length) * 100).toFixed(1),
                            fill: '#f97316' 
                          },
                          { 
                            name: 'Critical (<50%)', 
                            count: activeClients.filter(c => c.kpiProgress < 50).length,
                            percentage: ((activeClients.filter(c => c.kpiProgress < 50).length / activeClients.length) * 100).toFixed(1),
                            fill: '#ef4444' 
                          }
                        ].filter(item => item.count > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={120}
                        paddingAngle={3}
                        dataKey="count"
                      >
                        {activeClients.map((_, index) => (
                          <Cell key={`cell-${index}`} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(0,0,0,0.9)', 
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '8px',
                          color: 'white'
                        }}
                        formatter={(value, name, props) => [
                          `${value} clients (${props.payload.percentage}%)`,
                          props.payload.name
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Legend */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-dashboard-success rounded"></div>
                      <span className="text-white/80">Exceeding</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-dashboard-warning rounded"></div>
                      <span className="text-white/80">On Track</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-500 rounded"></div>
                      <span className="text-white/80">At Risk</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded"></div>
                      <span className="text-white/80">Critical</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-6">
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Revenue vs Target Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: 'white', fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fill: 'white' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(0,0,0,0.8)', 
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: 'white'
                      }}
                    />
                    <Bar dataKey="leads" fill="#10b981" name="Actual Leads" />
                    <Bar dataKey="target" fill="#ef4444" name="Target Leads" opacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-white">KPI Progress by Client</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: 'white', fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fill: 'white' }} />
                    <ReferenceLine y={100} stroke="#ffffff" strokeDasharray="5 5" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(0,0,0,0.8)', 
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: 'white'
                      }}
                      formatter={(value) => [`${Number(value).toFixed(1)}%`, 'KPI Progress']}
                    />
                    <Bar dataKey="kpiProgress">
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.kpiProgress >= 100 ? '#10b981' : entry.kpiProgress >= 80 ? '#f59e0b' : '#ef4444'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Below KPI Clients */}
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-white text-lg">Clients Below KPI Target</CardTitle>
              </CardHeader>
              <CardContent>
                {kpiCategories.belowKPI.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {kpiCategories.belowKPI.map((client) => (
                      <div key={client.id} className="p-4 bg-white/5 rounded-lg border border-red-500/20">
                        <h4 className="text-white font-semibold">{client.name}</h4>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-white/70">Progress:</span>
                            <span className="text-red-400">{client.kpiProgress.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/70">Revenue:</span>
                            <span className="text-white">${client.monthlyRevenue.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/70">Leads:</span>
                            <span className="text-white">{client.positiveRepliesMTD}/{client.monthlyKPI}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/70 text-center py-8">All active clients are meeting their KPI targets! 🎉</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="table" className="space-y-6">
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      All Clients Overview (Sorted by Payout)
                    </CardTitle>
                    <p className="text-white/70 text-sm">Complete client billing overview sorted by highest payout</p>
                  </div>
                  <Button
                    onClick={exportToCSV}
                    variant="outline"
                    size="sm"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                     <TableHeader>
                       <TableRow className="border-white/20 hover:bg-white/5">
                         <TableHead className="text-white font-semibold">Client Name</TableHead>
                         <TableHead className="text-white font-semibold text-right">Payout</TableHead>
                         <TableHead className="text-white font-semibold text-right">Target Payout</TableHead>
                         <TableHead className="text-white font-semibold text-right">Price per Lead</TableHead>
                         <TableHead className="text-white font-semibold text-right">Monthly KPI</TableHead>
                         <TableHead className="text-white font-semibold text-right">Replies MTD</TableHead>
                         <TableHead className="text-white font-semibold text-right">KPI Progress</TableHead>
                         <TableHead className="text-white font-semibold text-center">Status</TableHead>
                       </TableRow>
                     </TableHeader>
                    <TableBody>
                      {sortedClientsByPayout.map((client) => (
                        <TableRow 
                          key={client.id} 
                          className="border-white/10 hover:bg-white/5 transition-colors"
                        >
                          <TableCell className="font-medium text-white">
                            {client.name}
                          </TableCell>
                           <TableCell className="text-right text-white font-semibold">
                             ${client.monthlyRevenue.toLocaleString()}
                           </TableCell>
                           <TableCell className="text-right text-white font-semibold">
                             ${(client.monthlyKPI * client.pricePerLead).toLocaleString()}
                           </TableCell>
                           <TableCell className="text-right text-white">
                             ${client.pricePerLead.toFixed(2)}
                           </TableCell>
                          <TableCell className="text-right text-white">
                            {client.monthlyKPI.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-white">
                            {client.positiveRepliesMTD.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className={`font-medium ${
                                client.kpiProgress >= 100 ? 'text-dashboard-success' : 
                                client.kpiProgress >= 80 ? 'text-dashboard-warning' : 'text-red-400'
                              }`}>
                                {client.kpiProgress.toFixed(1)}%
                              </span>
                              <div className="w-16 bg-white/10 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all duration-300 ${
                                    client.kpiProgress >= 100 ? 'bg-dashboard-success' : 
                                    client.kpiProgress >= 80 ? 'bg-dashboard-warning' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.min(client.kpiProgress, 100)}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant="outline" 
                              className={`${
                                client.status === 'on-track' 
                                  ? 'bg-dashboard-success/20 text-dashboard-success border-dashboard-success/40'
                                  : client.status === 'warning'
                                  ? 'bg-dashboard-warning/20 text-dashboard-warning border-dashboard-warning/40'
                                  : 'bg-red-500/20 text-red-400 border-red-500/40'
                              }`}
                            >
                              {client.status === 'on-track' ? 'On Track' : 
                               client.status === 'warning' ? 'Warning' : 'Danger'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                 {/* Summary Stats for Table */}
                 <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-white/5 rounded-lg">
                   <div className="text-center">
                     <div className="text-2xl font-bold text-white">${totalStats.totalRevenue.toLocaleString()}</div>
                     <div className="text-white/70 text-sm">Total Payout</div>
                   </div>
                   <div className="text-center">
                     <div className={`text-2xl font-bold flex items-center justify-center gap-2 ${
                       (totalStats.totalTargetPayout - totalStats.totalRevenue) <= 0 
                         ? 'text-green-400' 
                         : 'text-red-400'
                     }`}>
                       {(totalStats.totalTargetPayout - totalStats.totalRevenue) <= 0 ? (
                         <TrendingUp className="h-5 w-5" />
                       ) : (
                         <TrendingDown className="h-5 w-5" />
                       )}
                       ${Math.abs(totalStats.totalTargetPayout - totalStats.totalRevenue).toLocaleString()}
                     </div>
                     <div className={`text-sm ${
                       (totalStats.totalTargetPayout - totalStats.totalRevenue) <= 0 
                         ? 'text-green-300' 
                         : 'text-red-300'
                     }`}>
                       {(totalStats.totalTargetPayout - totalStats.totalRevenue) <= 0 
                         ? 'Exceeding Target!' 
                         : 'Below Target'}
                     </div>
                   </div>
                   <div className="text-center">
                     <div className="text-2xl font-bold text-white">{totalStats.totalLeads.toLocaleString()}</div>
                     <div className="text-white/70 text-sm">Total Leads</div>
                   </div>
                   <div className="text-center">
                     <div className="text-2xl font-bold text-white">{totalStats.totalKPI.toLocaleString()}</div>
                     <div className="text-white/70 text-sm">Total KPI Target</div>
                   </div>
                   <div className="text-center">
                     <div className="text-2xl font-bold text-white">{avgProgress.toFixed(1)}%</div>
                     <div className="text-white/70 text-sm">Avg Progress</div>
                   </div>
                 </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {activeClients.length === 0 && (
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-12 text-center">
              <DollarSign className="h-12 w-12 text-white/40 mx-auto mb-4" />
              <h3 className="text-white text-lg font-semibold mb-2">No active billing data available</h3>
              <p className="text-white/70">Active client billing information will appear here once data is loaded.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BillingDashboard;