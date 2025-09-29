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
  Target, 
  Users, 
  ArrowLeft,
  Calculator,
  PieChart as PieChartIcon,
  Activity,
  Filter,
  ChevronDown
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
        const { data, error } = await supabase.functions.invoke('airtable-clients');
        
        if (error) {
          throw new Error(error.message || 'Failed to fetch client data');
        }
        
        const billingData: ClientBillingData[] = data.clients
          .map((client: any) => {
            const positiveRepliesMTD = client.leadsGenerated || 0;
            const monthlyRevenue = client.payout || 0; // Use Payout field from Airtable
            const pricePerLead = positiveRepliesMTD > 0 ? monthlyRevenue / positiveRepliesMTD : 0; // Calculate price per lead
            const kpiProgress = client.monthlyKPI > 0 ? (positiveRepliesMTD / client.monthlyKPI) * 100 : 0;
            
            let status: 'on-track' | 'warning' | 'danger' = 'on-track';
            if (kpiProgress < 50) status = 'danger';
            else if (kpiProgress < 80) status = 'warning';

            return {
              id: client.id,
              name: client.name,
              monthlyKPI: client.monthlyKPI,
              positiveRepliesMTD,
              pricePerLead,
              monthlyRevenue,
              kpiProgress,
              status,
              isActive: monthlyRevenue > 0
            };
          })
          .filter((client: ClientBillingData) => client.isActive); // Only show active clients

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

  const kpiComparisonData = useMemo(() => [
    { name: 'Above KPI', count: kpiCategories.aboveKPI.length, fill: '#10b981' },
    { name: 'Below KPI', count: kpiCategories.belowKPI.length, fill: '#ef4444' }
  ], [kpiCategories]);

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
        totalLeads: acc.totalLeads + client.positiveRepliesMTD,
        totalKPI: acc.totalKPI + client.monthlyKPI,
        averageProgress: acc.averageProgress + client.kpiProgress
      }),
      { totalRevenue: 0, totalLeads: 0, totalKPI: 0, averageProgress: 0 }
    );
  }, [activeClients]);

  const avgProgress = activeClients.length > 0 ? totalStats.averageProgress / activeClients.length : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-dashboard">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-dashboard flex items-center justify-center">
        <Card className="bg-white/10 backdrop-blur-md border-white/20 text-white">
          <CardContent className="p-8 text-center">
            <div className="text-red-400 text-lg mb-4">Error loading billing data</div>
            <p className="text-white/70">{error}</p>
            <Button asChild className="mt-4">
              <Link to="/">Return to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dashboard">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
              >
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-dashboard-primary/20 rounded-lg">
                  <DollarSign className="h-6 w-6 text-dashboard-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Billing Dashboard</h1>
                  <p className="text-white/70 text-sm">Client revenue and KPI performance tracking</p>
                </div>
              </div>
            </div>
            <div className="px-3 py-1 bg-dashboard-success/20 border border-dashboard-success/40 rounded-full">
              <span className="text-xs font-medium text-dashboard-success">● Live Data</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Client Selection and Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Client Selection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-white/20">
                  <SelectItem value="all" className="text-white">All Active Clients</SelectItem>
                  {activeClients.map((client) => (
                    <SelectItem key={client.id} value={client.id} className="text-white">
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-xs font-medium">Active Clients</p>
                  <p className="text-xl font-bold text-white">{activeClients.length}</p>
                </div>
                <Users className="h-6 w-6 text-dashboard-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-xs font-medium">Above KPI</p>
                  <p className="text-xl font-bold text-dashboard-success">{kpiCategories.aboveKPI.length}</p>
                </div>
                <TrendingUp className="h-6 w-6 text-dashboard-success" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-xs font-medium">Below KPI</p>
                  <p className="text-xl font-bold text-red-400">{kpiCategories.belowKPI.length}</p>
                </div>
                <Target className="h-6 w-6 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Selected Client Detail */}
        {selectedClientData && (
          <Card className="bg-white/10 backdrop-blur-md border-white/20 mb-8">
            <CardHeader>
              <CardTitle className="text-white text-xl">{selectedClientData.name} - Detailed View</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <div className="text-2xl font-bold text-white">${selectedClientData.monthlyRevenue.toLocaleString()}</div>
                <div className="text-white/70 text-sm">Monthly Revenue</div>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <div className="text-2xl font-bold text-white">{selectedClientData.positiveRepliesMTD}</div>
                <div className="text-white/70 text-sm">Leads MTD</div>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <div className="text-2xl font-bold text-white">{selectedClientData.monthlyKPI}</div>
                <div className="text-white/70 text-sm">Monthly Target</div>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <div className={`text-2xl font-bold ${
                  selectedClientData.kpiProgress >= 100 ? 'text-dashboard-success' : 
                  selectedClientData.kpiProgress >= 80 ? 'text-dashboard-warning' : 'text-red-400'
                }`}>
                  {selectedClientData.kpiProgress.toFixed(1)}%
                </div>
                <div className="text-white/70 text-sm">KPI Progress</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts and Analytics */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-white/10 backdrop-blur-md">
            <TabsTrigger value="overview" className="text-white data-[state=active]:bg-dashboard-primary">Overview</TabsTrigger>
            <TabsTrigger value="revenue" className="text-white data-[state=active]:bg-dashboard-primary">Revenue Analysis</TabsTrigger>
            <TabsTrigger value="performance" className="text-white data-[state=active]:bg-dashboard-primary">KPI Performance</TabsTrigger>
            <TabsTrigger value="table" className="text-white data-[state=active]:bg-dashboard-primary">Total View</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* KPI Distribution Pie Chart */}
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5" />
                    KPI Performance Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={kpiComparisonData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="count"
                      >
                        {kpiComparisonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(0,0,0,0.8)', 
                          border: '1px solid rgba(255,255,255,0.2)',
                          color: 'white'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Client Revenue Bar Chart */}
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">Monthly Revenue by Client</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
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
                        formatter={(value, name) => [
                          name === 'revenue' ? `$${value.toLocaleString()}` : value,
                          name === 'revenue' ? 'Revenue' : 'Leads'
                        ]}
                      />
                      <Bar dataKey="revenue" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-6">
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  All Clients Overview (Sorted by Payout)
                </CardTitle>
                <p className="text-white/70 text-sm">Complete client billing overview sorted by highest payout</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/20 hover:bg-white/5">
                        <TableHead className="text-white font-semibold">Client Name</TableHead>
                        <TableHead className="text-white font-semibold text-right">Payout</TableHead>
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
                <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white/5 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">${totalStats.totalRevenue.toLocaleString()}</div>
                    <div className="text-white/70 text-sm">Total Payout</div>
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
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  All Clients Overview (Sorted by Payout)
                </CardTitle>
                <p className="text-white/70 text-sm">Complete client billing overview sorted by highest payout</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/20 hover:bg-white/5">
                        <TableHead className="text-white font-semibold">Client Name</TableHead>
                        <TableHead className="text-white font-semibold text-right">Payout</TableHead>
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
                <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white/5 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">${totalStats.totalRevenue.toLocaleString()}</div>
                    <div className="text-white/70 text-sm">Total Payout</div>
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