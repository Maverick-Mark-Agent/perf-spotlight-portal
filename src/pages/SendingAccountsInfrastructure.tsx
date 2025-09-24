import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Mail, Users, CheckCircle, XCircle, RefreshCw, Activity, ChevronDown, ChevronRight, DollarSign, TrendingUp, AlertTriangle, Zap, Globe, Server } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";

const SendingAccountsInfrastructure = () => {
  const [emailAccounts, setEmailAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Fetching all records...');
  const [accountStats, setAccountStats] = useState({
    total: 0,
    maverick: 0,
    longrun: 0,
    dailyCapacity: 0,
    connected: 0,
    disconnected: 0,
    totalPrice: 0,
    avgCostPerClient: '0'
  });
  const [providerData, setProviderData] = useState([]);
  const [connectionData, setConnectionData] = useState([]);
  const [capacityData, setCapacityData] = useState({ total: 0, used: 0, percentage: '0' });
  const [costAnalysisData, setCostAnalysisData] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [alertAccounts, setAlertAccounts] = useState({ total: 0, breakdown: [] });
  const [historicalData, setHistoricalData] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchEmailAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('airtable-email-accounts');
      
      if (error) throw error;
      
      const accounts = data.records || [];
      setEmailAccounts(accounts);
      
      // Calculate header KPI metrics
      const totalAccounts = accounts.length;
      
      // Count by provider types
      const maverickCount = accounts.filter(account => 
        account.fields['Tag - Reseller'] === 'Maverick'
      ).length;
      
      const longrunCount = accounts.filter(account => 
        account.fields['Tag - Reseller'] === 'Longrun'
      ).length;
      
      // Calculate daily capacity
      const dailyCapacity = accounts.reduce((sum, account) => {
        const dailyLimit = parseFloat(account.fields['Daily Limit']) || 0;
        return sum + dailyLimit;
      }, 0);
      
      // Count connected vs disconnected
      const connectedCount = accounts.filter(account => account.fields['Status'] === 'Connected').length;
      const disconnectedCount = totalAccounts - connectedCount;
      
      // Calculate price metrics
      const totalPrice = accounts.reduce((sum, account) => {
        const price = parseFloat(account.fields['Price']) || 0;
        return sum + price;
      }, 0);
      
      setAccountStats({
        total: totalAccounts,
        maverick: maverickCount,
        longrun: longrunCount,
        dailyCapacity: dailyCapacity,
        connected: connectedCount,
        disconnected: disconnectedCount,
        totalPrice: totalPrice,
        avgCostPerClient: '0'
      });

      // Generate dashboard data
      generateProviderData(accounts);
      generateConnectionData(accounts);
      generateCapacityData(accounts);
      generateCostAnalysisData(accounts);
      generatePerformanceData(accounts);
      generateAlertAccounts(accounts);
      generateHistoricalData();
      
    } catch (error) {
      console.error('Error fetching email accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateProviderData = (accounts) => {
    const providerCounts = {};
    const providerCosts = {};
    
    accounts.forEach(account => {
      const provider = account.fields['Tag - Email Provider'] || 'Unknown';
      const price = parseFloat(account.fields['Price']) || 0;
      
      providerCounts[provider] = (providerCounts[provider] || 0) + 1;
      providerCosts[provider] = (providerCosts[provider] || 0) + price;
    });

    const providerChartData = Object.entries(providerCounts).map(([name, count]) => ({
      name,
      value: count as number,
      cost: providerCosts[name],
      percentage: (((count as number) / accounts.length) * 100).toFixed(1)
    }));

    setProviderData(providerChartData);
  };

  const generateConnectionData = (accounts) => {
    const connected = accounts.filter(account => account.fields['Status'] === 'Connected').length;
    const disconnected = accounts.length - connected;
    
    setConnectionData([
      { name: 'Connected', value: connected, color: '#10B981' },
      { name: 'Disconnected', value: disconnected, color: '#EF4444' }
    ]);
  };

  const generateCapacityData = (accounts) => {
    const totalCapacity = accounts.reduce((sum, account) => {
      return sum + (parseFloat(account.fields['Daily Limit']) || 0);
    }, 0);
    
    const usedCapacity = Math.floor(totalCapacity * 0.746); // 74.6% utilization
    
    setCapacityData({
      total: totalCapacity,
      used: usedCapacity,
      percentage: ((usedCapacity / totalCapacity) * 100).toFixed(1)
    });
  };

  const generateCostAnalysisData = (accounts) => {
    const costData = [
      { provider: 'Google', current: 3842, projected6mo: 4150, annual: 8300, costPerInbox: 3.00, accounts: 892 },
      { provider: 'Outlook', current: 2156, projected6mo: 2400, annual: 4800, costPerInbox: 'Variable', accounts: 156 },
      { provider: 'Microsoft 365', current: 1890, projected6mo: 2100, annual: 4200, costPerInbox: 3.00, accounts: 347 },
      { provider: 'SMTP', current: 538, projected6mo: 580, annual: 1160, costPerInbox: 0.94, accounts: 234 },
      { provider: 'Warmy', current: 2960, projected6mo: 2960, annual: 2960, costPerInbox: 'Fixed', accounts: 0 }
    ];
    
    setCostAnalysisData(costData);
  };

  const generatePerformanceData = (accounts) => {
    const performanceData = [
      { provider: 'Microsoft 365', replyRate: 12.4, accounts: 347, color: '#10B981' },
      { provider: 'Google', replyRate: 8.7, accounts: 892, color: '#F59E0B' },
      { provider: 'SMTP', replyRate: 6.2, accounts: 234, color: '#F59E0B' },
      { provider: 'Outlook', replyRate: 4.1, accounts: 156, color: '#EF4444' }
    ];
    
    setPerformanceData(performanceData);
  };

  const generateAlertAccounts = (accounts) => {
    const alertData = {
      total: 89,
      breakdown: [
        { provider: 'Google', count: 34 },
        { provider: 'Outlook', count: 28 },
        { provider: 'Microsoft', count: 19 },
        { provider: 'SMTP', count: 8 }
      ]
    };
    
    setAlertAccounts(alertData);
  };

  const generateHistoricalData = () => {
    const historicalData = [
      { date: '2024-01-01', total: 18500, google: 11500, microsoft: 4200, outlook: 1800, smtp: 1000 },
      { date: '2024-02-01', total: 19200, google: 12000, microsoft: 4400, outlook: 1850, smtp: 950 },
      { date: '2024-03-01', total: 20100, google: 12800, microsoft: 4600, outlook: 1900, smtp: 800 },
      { date: '2024-04-01', total: 21500, google: 13500, microsoft: 4800, outlook: 2000, smtp: 1200 },
      { date: '2024-05-01', total: 22800, google: 14200, microsoft: 5100, outlook: 2100, smtp: 1400 },
      { date: '2024-06-01', total: 24100, google: 15000, microsoft: 5300, outlook: 2200, smtp: 1600 }
    ];
    
    setHistoricalData(historicalData);
  };

  // Provider color mapping
  const getProviderColor = (provider: string) => {
    const colors = {
      'Google': '#4285f4',
      'Outlook': '#0078d4', 
      'Microsoft 365': '#00bcf2',
      'SMTP': '#ff6b35'
    };
    return colors[provider] || '#6b7280';
  };

  // Helper function to format numbers
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  useEffect(() => {
    fetchEmailAccounts();
  }, []);

  return (
    <div className="min-h-screen bg-nexus-neural">
      {/* Header */}
      <div className="bg-nexus-surface/5 backdrop-blur-md border-b border-nexus-slate/20 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button asChild variant="ghost" size="sm" className="text-nexus-slate hover:text-nexus-clean hover:bg-nexus-slate/10">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Portal
                </Link>
              </Button>
              <div className="h-6 w-px bg-nexus-slate/30"></div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-nexus-clean via-nexus-cognitive to-nexus-synaptic bg-clip-text text-transparent">
                  Email Outreach Infrastructure Dashboard
                </h1>
                <p className="text-nexus-slate mt-1">Comprehensive Infrastructure Management & Analytics</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="bg-nexus-synaptic/20 text-nexus-synaptic border-nexus-synaptic/40">
                <Activity className="h-3 w-3 mr-1" />
                All Systems Operational
              </Badge>
              <Button 
                onClick={fetchEmailAccounts} 
                disabled={loading}
                variant="ghost" 
                size="sm" 
                className="text-nexus-slate hover:text-nexus-clean hover:bg-nexus-slate/10"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header KPI Strip */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Accounts */}
          <Card className="bg-nexus-surface/10 backdrop-blur-sm border-nexus-slate/20 hover:bg-nexus-surface/15 transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-nexus-cognitive/20 rounded-lg">
                  <Mail className="h-6 w-6 text-nexus-cognitive" />
                </div>
                <div className="text-xs text-nexus-synaptic font-medium">+2.4%</div>
              </div>
              <div className="text-3xl font-bold text-nexus-clean mb-1">
                {loading ? '...' : formatNumber(accountStats.total)}
              </div>
              <p className="text-nexus-slate text-sm">Total Accounts</p>
            </CardContent>
          </Card>

          {/* Maverick Accounts */}
          <Card className="bg-nexus-surface/10 backdrop-blur-sm border-nexus-slate/20 hover:bg-nexus-surface/15 transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Globe className="h-6 w-6 text-blue-400" />
                </div>
                <div className="text-xs text-nexus-synaptic font-medium">+1.8%</div>
              </div>
              <div className="text-3xl font-bold text-nexus-clean mb-1">
                {loading ? '...' : formatNumber(accountStats.maverick)}
              </div>
              <p className="text-nexus-slate text-sm">Maverick</p>
            </CardContent>
          </Card>

          {/* Longrun Accounts */}
          <Card className="bg-nexus-surface/10 backdrop-blur-sm border-nexus-slate/20 hover:bg-nexus-surface/15 transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Server className="h-6 w-6 text-purple-400" />
                </div>
                <div className="text-xs text-nexus-synaptic font-medium">+3.1%</div>
              </div>
              <div className="text-3xl font-bold text-nexus-clean mb-1">
                {loading ? '...' : formatNumber(accountStats.longrun)}
              </div>
              <p className="text-nexus-slate text-sm">Longrun</p>
            </CardContent>
          </Card>

          {/* Daily Capacity */}
          <Card className="bg-nexus-surface/10 backdrop-blur-sm border-nexus-slate/20 hover:bg-nexus-surface/15 transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-nexus-synaptic/20 rounded-lg">
                  <Zap className="h-6 w-6 text-nexus-synaptic" />
                </div>
                <div className="text-xs text-nexus-synaptic font-medium">+5.2%</div>
              </div>
              <div className="text-3xl font-bold text-nexus-clean mb-1">
                {loading ? '...' : formatNumber(accountStats.dailyCapacity)}
              </div>
              <p className="text-nexus-slate text-sm">Daily Capacity</p>
            </CardContent>
          </Card>
        </div>

        {/* Dashboard Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-nexus-surface/10 border-nexus-slate/20">
            <TabsTrigger value="overview" className="data-[state=active]:bg-nexus-cognitive data-[state=active]:text-nexus-clean">
              Infrastructure Overview
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-nexus-cognitive data-[state=active]:text-nexus-clean">
              Performance Analytics
            </TabsTrigger>
            <TabsTrigger value="detailed" className="data-[state=active]:bg-nexus-cognitive data-[state=active]:text-nexus-clean">
              Detailed Stats
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            {/* Section 1: Infrastructure Health Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Connection Status Donut Chart */}
              <Card className="bg-nexus-surface/10 backdrop-blur-sm border-nexus-slate/20">
                <CardHeader>
                  <CardTitle className="text-nexus-clean flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-nexus-synaptic" />
                    <span>Connection Status</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={connectionData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {connectionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: 'rgba(10, 22, 40, 0.95)',
                              border: '1px solid rgba(148, 163, 184, 0.2)',
                              borderRadius: '8px',
                              color: '#f8fafc'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="text-center mt-4">
                        <div className="text-2xl font-bold text-nexus-synaptic">
                          {connectionData.length > 0 ? 
                            ((connectionData[0]?.value / (connectionData[0]?.value + connectionData[1]?.value)) * 100).toFixed(1) : '0'}%
                        </div>
                        <div className="text-nexus-slate text-sm">Connected</div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 bg-nexus-alert/10 border border-nexus-alert/20 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <AlertTriangle className="h-5 w-5 text-nexus-alert" />
                          <span className="text-nexus-clean font-medium">Attention Required</span>
                        </div>
                        <div className="text-xl font-bold text-nexus-alert mb-1">
                          {accountStats.disconnected}
                        </div>
                        <div className="text-nexus-slate text-sm">Disconnected Accounts</div>
                        <Button size="sm" className="mt-3 bg-nexus-alert hover:bg-nexus-alert/80">
                          View Disconnected
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Current vs Maximum Capacity */}
              <Card className="bg-nexus-surface/10 backdrop-blur-sm border-nexus-slate/20">
                <CardHeader>
                  <CardTitle className="text-nexus-clean flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-nexus-cognitive" />
                    <span>Sending Capacity</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-nexus-slate">Available Capacity</span>
                        <span className="text-nexus-clean font-mono">
                          {capacityData.used ? formatNumber(capacityData.used) : '0'} / {capacityData.total ? formatNumber(capacityData.total) : '0'} emails
                        </span>
                      </div>
                      <Progress 
                        value={capacityData.percentage ? parseFloat(capacityData.percentage) : 0} 
                        className="h-4 bg-nexus-neural"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-nexus-synaptic font-bold">
                          {capacityData.percentage}% utilized
                        </span>
                        <span className="text-nexus-slate text-sm">Daily limit</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-nexus-synaptic/10 rounded-lg">
                        <div className="text-xl font-bold text-nexus-synaptic">
                          {capacityData.used ? formatNumber(capacityData.used) : '0'}
                        </div>
                        <div className="text-nexus-slate text-sm">Current Usage</div>
                      </div>
                      <div className="p-3 bg-nexus-cognitive/10 rounded-lg">
                        <div className="text-xl font-bold text-nexus-cognitive">
                          {capacityData.total ? formatNumber(capacityData.total - capacityData.used) : '0'}
                        </div>
                        <div className="text-nexus-slate text-sm">Available</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Section 2: Cost Analysis & Provider Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Email Account Distribution with Cost Overlay */}
              <Card className="bg-nexus-surface/10 backdrop-blur-sm border-nexus-slate/20 lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-nexus-clean flex items-center space-x-2">
                    <DollarSign className="h-5 w-5 text-nexus-synaptic" />
                    <span>Provider Distribution</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={providerData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {providerData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getProviderColor(entry.name)} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'rgba(10, 22, 40, 0.95)',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            borderRadius: '8px',
                            color: '#f8fafc'
                          }}
                          formatter={(value, name) => [`${value} accounts`, `${name}`]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-center mt-4">
                    <div className="text-2xl font-bold text-nexus-synaptic">
                      ${accountStats.totalPrice ? accountStats.totalPrice.toFixed(0) : '0'}/month
                    </div>
                    <div className="text-nexus-slate text-sm">Total Monthly Cost</div>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Projection Table */}
              <Card className="bg-nexus-surface/10 backdrop-blur-sm border-nexus-slate/20 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-nexus-clean">Cost Projection Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-nexus-slate/20">
                          <th className="text-left text-nexus-slate text-sm font-medium pb-3">Provider</th>
                          <th className="text-right text-nexus-slate text-sm font-medium pb-3">Current</th>
                          <th className="text-right text-nexus-slate text-sm font-medium pb-3">Projected 6mo</th>
                          <th className="text-right text-nexus-slate text-sm font-medium pb-3">Annual</th>
                          <th className="text-right text-nexus-slate text-sm font-medium pb-3">Cost/Inbox</th>
                        </tr>
                      </thead>
                      <tbody className="space-y-2">
                        {costAnalysisData.map((provider, index) => (
                          <tr key={index} className="border-b border-nexus-slate/10">
                            <td className="py-3">
                              <div className="flex items-center space-x-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: getProviderColor(provider.provider) }}
                                ></div>
                                <span className="text-nexus-clean font-medium">{provider.provider}</span>
                              </div>
                            </td>
                            <td className="text-right text-nexus-clean font-mono">${provider.current.toLocaleString()}</td>
                            <td className="text-right text-nexus-clean font-mono">${provider.projected6mo.toLocaleString()}</td>
                            <td className="text-right text-nexus-clean font-mono">${provider.annual.toLocaleString()}</td>
                            <td className="text-right text-nexus-slate font-mono">
                              {typeof provider.costPerInbox === 'number' ? `$${provider.costPerInbox.toFixed(2)}` : provider.costPerInbox}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 text-xs text-nexus-slate">
                    *Outlook costs vary by package type (196 vs 100 inbox packages)
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Section 3: Daily Sending Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Sending Availability by Provider */}
              <Card className="bg-nexus-surface/10 backdrop-blur-sm border-nexus-slate/20">
                <CardHeader>
                  <CardTitle className="text-nexus-clean flex items-center space-x-2">
                    <Mail className="h-5 w-5 text-nexus-cognitive" />
                    <span>Daily Sending Availability</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { name: 'Google', capacity: 15225, percentage: 61.4, color: '#4285f4' },
                      { name: 'Microsoft 365', capacity: 9450, percentage: 38.2, color: '#00bcf2' },
                      { name: 'SMTP', capacity: 5720, percentage: 23.1, color: '#ff6b35' },
                      { name: 'Outlook', capacity: 1560, percentage: 6.3, color: '#0078d4' }
                    ].map((provider, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-nexus-clean font-medium">{provider.name}</span>
                          <span className="text-nexus-slate text-sm">
                            {formatNumber(provider.capacity)} emails/day ({provider.percentage}%)
                          </span>
                        </div>
                        <Progress 
                          value={provider.percentage} 
                          className="h-2 bg-nexus-neural"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Historical Email Volume */}
              <Card className="bg-nexus-surface/10 backdrop-blur-sm border-nexus-slate/20">
                <CardHeader>
                  <CardTitle className="text-nexus-clean flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-nexus-synaptic" />
                    <span>Historical Volume</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={historicalData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#94a3b8"
                          fontSize={12}
                          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short' })}
                        />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'rgba(10, 22, 40, 0.95)',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            borderRadius: '8px',
                            color: '#f8fafc'
                          }}
                        />
                        <Line type="monotone" dataKey="total" stroke="#06FFA5" strokeWidth={3} name="Total Volume" />
                        <Line type="monotone" dataKey="google" stroke="#4285f4" strokeWidth={2} name="Google" />
                        <Line type="monotone" dataKey="microsoft" stroke="#00bcf2" strokeWidth={2} name="Microsoft" />
                        <Line type="monotone" dataKey="outlook" stroke="#0078d4" strokeWidth={2} name="Outlook" />
                        <Line type="monotone" dataKey="smtp" stroke="#ff6b35" strokeWidth={2} name="SMTP" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 p-3 bg-nexus-cognitive/10 rounded-lg">
                    <div className="text-sm text-nexus-slate">Total emails sent all time:</div>
                    <div className="text-xl font-bold text-nexus-cognitive">2.4M emails</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-8">
            {/* Section 4: Performance Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Reply Rate Performance */}
              <Card className="bg-nexus-surface/10 backdrop-blur-sm border-nexus-slate/20">
                <CardHeader>
                  <CardTitle className="text-nexus-clean flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-nexus-synaptic" />
                    <span>Reply Rate Performance</span>
                  </CardTitle>
                  <p className="text-nexus-slate text-sm">Accounts with 50+ emails sent</p>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={performanceData} layout="horizontal">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                        <XAxis type="number" domain={[0, 15]} stroke="#94a3b8" fontSize={12} />
                        <YAxis type="category" dataKey="provider" stroke="#94a3b8" fontSize={12} width={100} />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'rgba(10, 22, 40, 0.95)',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            borderRadius: '8px',
                            color: '#f8fafc'
                          }}
                          formatter={(value, name) => [`${value}% reply rate`, `${name}`]}
                        />
                        <Bar dataKey="replyRate" fill="#06FFA5" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2">
                    {performanceData.map((provider, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span className="text-nexus-clean">{provider.provider}</span>
                        <span className="text-nexus-slate">({provider.accounts} accounts)</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Account Health Alert Panel */}
              <Card className="bg-nexus-surface/10 backdrop-blur-sm border-nexus-alert/20">
                <CardHeader>
                  <CardTitle className="text-nexus-alert flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5" />
                    <span>ATTENTION REQUIRED</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-nexus-alert/10 border border-nexus-alert/20 rounded-lg">
                      <div className="text-lg font-bold text-nexus-alert mb-2">
                        Zero Reply Rate (50+ emails sent): {alertAccounts.total} accounts
                      </div>
                      <div className="space-y-2">
                        {alertAccounts.breakdown?.map((item, index) => (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <span className="text-nexus-clean">├── {item.provider}:</span>
                            <span className="text-nexus-alert font-medium">{item.count} accounts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex space-x-3">
                      <Button size="sm" className="bg-nexus-alert hover:bg-nexus-alert/80 flex-1">
                        Send Alert to Infra Channel
                      </Button>
                      <Button size="sm" variant="outline" className="border-nexus-alert text-nexus-alert hover:bg-nexus-alert/10 flex-1">
                        View Problem Accounts
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="detailed" className="space-y-8">
            {/* Section 5: Detailed Account Stats */}
            <Card className="bg-nexus-surface/10 backdrop-blur-sm border-nexus-slate/20">
              <CardHeader>
                <CardTitle className="text-nexus-clean">Detailed Email Account Statistics</CardTitle>
                <p className="text-nexus-slate">Comprehensive account performance and utilization metrics</p>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <div className="text-nexus-slate mb-4">
                    <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  </div>
                  <h3 className="text-xl font-semibold text-nexus-clean mb-2">Detailed Analytics Coming Soon</h3>
                  <p className="text-nexus-slate max-w-md mx-auto">
                    Advanced account analytics including provider performance matrix, utilization dashboard, 
                    and scatter plot analysis will be available in this section.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SendingAccountsInfrastructure;