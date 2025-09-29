import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DollarSign, 
  TrendingUp, 
  Target, 
  Users, 
  ArrowLeft,
  Calculator,
  PieChart,
  Activity
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
}

const BillingDashboard = () => {
  const [clientsData, setClientsData] = useState<ClientBillingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBillingData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/airtable-clients');
        
        if (!response.ok) {
          throw new Error('Failed to fetch client data');
        }

        const data = await response.json();
        
        // Transform data for billing dashboard
        const billingData: ClientBillingData[] = data.clients.map((client: any) => {
          const pricePerLead = 75; // Default price per lead (you can adjust this)
          const positiveRepliesMTD = client.leadsGenerated || 0;
          const monthlyRevenue = positiveRepliesMTD * pricePerLead;
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
            status
          };
        });

        setClientsData(billingData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchBillingData();
  }, []);

  const totalStats = useMemo(() => {
    return clientsData.reduce(
      (acc, client) => ({
        totalRevenue: acc.totalRevenue + client.monthlyRevenue,
        totalLeads: acc.totalLeads + client.positiveRepliesMTD,
        totalKPI: acc.totalKPI + client.monthlyKPI,
        averageProgress: acc.averageProgress + client.kpiProgress
      }),
      { totalRevenue: 0, totalLeads: 0, totalKPI: 0, averageProgress: 0 }
    );
  }, [clientsData]);

  const avgProgress = clientsData.length > 0 ? totalStats.averageProgress / clientsData.length : 0;

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
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-sm font-medium">Total Revenue MTD</p>
                  <p className="text-2xl font-bold text-white">${totalStats.totalRevenue.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-dashboard-success/20 rounded-lg">
                  <DollarSign className="h-6 w-6 text-dashboard-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-sm font-medium">Total Leads MTD</p>
                  <p className="text-2xl font-bold text-white">{totalStats.totalLeads.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-dashboard-primary/20 rounded-lg">
                  <Users className="h-6 w-6 text-dashboard-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-sm font-medium">Total KPI Target</p>
                  <p className="text-2xl font-bold text-white">{totalStats.totalKPI.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-dashboard-warning/20 rounded-lg">
                  <Target className="h-6 w-6 text-dashboard-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-sm font-medium">Avg KPI Progress</p>
                  <p className="text-2xl font-bold text-white">{avgProgress.toFixed(1)}%</p>
                </div>
                <div className="p-3 bg-dashboard-accent/20 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-dashboard-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Client Billing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clientsData.map((client) => (
            <Card 
              key={client.id} 
              className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-lg font-semibold">
                    {client.name}
                  </CardTitle>
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
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Revenue */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-dashboard-success" />
                    <span className="text-white/70 text-sm">Revenue MTD</span>
                  </div>
                  <span className="text-white font-semibold">${client.monthlyRevenue.toLocaleString()}</span>
                </div>

                {/* KPI Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/70">KPI Progress</span>
                    <span className="text-white font-medium">{client.kpiProgress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        client.status === 'on-track' 
                          ? 'bg-dashboard-success'
                          : client.status === 'warning'
                          ? 'bg-dashboard-warning'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(client.kpiProgress, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-white/5 rounded">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Activity className="h-3 w-3 text-dashboard-primary" />
                      <span className="text-xs text-white/60">Leads MTD</span>
                    </div>
                    <div className="text-white font-semibold">{client.positiveRepliesMTD}</div>
                  </div>
                  <div className="text-center p-2 bg-white/5 rounded">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Target className="h-3 w-3 text-dashboard-warning" />
                      <span className="text-xs text-white/60">KPI Target</span>
                    </div>
                    <div className="text-white font-semibold">{client.monthlyKPI}</div>
                  </div>
                  <div className="text-center p-2 bg-white/5 rounded">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Calculator className="h-3 w-3 text-dashboard-accent" />
                      <span className="text-xs text-white/60">Price/Lead</span>
                    </div>
                    <div className="text-white font-semibold">${client.pricePerLead}</div>
                  </div>
                  <div className="text-center p-2 bg-white/5 rounded">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <PieChart className="h-3 w-3 text-dashboard-success" />
                      <span className="text-xs text-white/60">Remaining</span>
                    </div>
                    <div className="text-white font-semibold">{Math.max(0, client.monthlyKPI - client.positiveRepliesMTD)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {clientsData.length === 0 && (
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-12 text-center">
              <DollarSign className="h-12 w-12 text-white/40 mx-auto mb-4" />
              <h3 className="text-white text-lg font-semibold mb-2">No billing data available</h3>
              <p className="text-white/70">Client billing information will appear here once data is loaded.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BillingDashboard;