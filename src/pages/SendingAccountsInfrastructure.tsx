import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mail, Users, CheckCircle, XCircle, RefreshCw, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SendingAccountsInfrastructure = () => {
  const [emailAccounts, setEmailAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Fetching all records...');
  const [accountStats, setAccountStats] = useState({
    total: 0,
    avgPerClient: '0',
    connected: 0,
    disconnected: 0,
    totalPrice: 0,
    avgCostPerClient: '0'
  });
  const [resellerData, setResellerData] = useState([]);
  const [accountTypeData, setAccountTypeData] = useState([]);
  const [priceAnalysisData, setPriceAnalysisData] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState('Email Provider');

  const fetchEmailAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('airtable-email-accounts');
      
      if (error) throw error;
      
      const accounts = data.records || [];
      setEmailAccounts(accounts);
      
      // Calculate metrics
      const totalAccounts = accounts.length;
      
      // Count unique clients
      const uniqueClients = new Set(
        accounts.map(account => {
          const clientField = account.fields['Client'];
          return clientField && clientField.length > 0 ? clientField[0] : 'Unknown';
        })
      ).size;
      
      const avgAccountsPerClient = uniqueClients > 0 ? (totalAccounts / uniqueClients).toFixed(1) : '0';
      
      // Count connected vs disconnected
      const connectedCount = accounts.filter(account => account.fields['Status'] === 'Connected').length;
      const disconnectedCount = totalAccounts - connectedCount;
      
      // Calculate price metrics
      const totalPrice = accounts.reduce((sum, account) => {
        const price = parseFloat(account.fields['Price']) || 0;
        return sum + price;
      }, 0);
      
      const avgCostPerClient = uniqueClients > 0 ? (totalPrice / uniqueClients).toFixed(2) : '0';
      
      setAccountStats({
        total: totalAccounts,
        avgPerClient: avgAccountsPerClient,
        connected: connectedCount,
        disconnected: disconnectedCount,
        totalPrice: totalPrice,
        avgCostPerClient: avgCostPerClient
      });

      // Calculate reseller distribution
      const resellerCounts = {};
      accounts.forEach(account => {
        const reseller = account.fields['Tag - Reseller'] || 'Unknown';
        resellerCounts[reseller] = (resellerCounts[reseller] || 0) + 1;
      });

      const resellerChartData = Object.entries(resellerCounts).map(([name, count]) => ({
        name,
        value: count as number,
        percentage: (((count as number) / totalAccounts) * 100).toFixed(1)
      }));

      setResellerData(resellerChartData);

      // Calculate account type distribution
      const accountTypeCounts = {};
      accounts.forEach(account => {
        const accountType = account.fields['Account Type'] || 'Unknown';
        accountTypeCounts[accountType] = (accountTypeCounts[accountType] || 0) + 1;
      });

      const accountTypeChartData = Object.entries(accountTypeCounts).map(([name, count]) => ({
        name,
        value: count as number,
        percentage: (((count as number) / totalAccounts) * 100).toFixed(1)
      }));

      setAccountTypeData(accountTypeChartData);
      
      // Generate simplified price analysis data
      generatePriceAnalysisData(accounts);
      
    } catch (error) {
      console.error('Error fetching email accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePriceAnalysisData = (accounts) => {
    const fieldMap = {
      'Email Provider': 'Tag - Email Provider',
      'Reseller': 'Tag - Reseller', 
      'Client': 'Client Name (from Client)',
      'Account Type': 'Account Type'
    };
    
    const field = fieldMap[selectedAnalysis];
    const groupedData = {};
    
    accounts.forEach(account => {
      const value = account.fields[field] || 'Unknown';
      const price = parseFloat(account.fields['Price']) || 0;
      
      if (!groupedData[value]) {
        groupedData[value] = {
          name: value,
          totalPrice: 0,
          count: 0,
          avgPrice: 0
        };
      }
      
      groupedData[value].totalPrice += price;
      groupedData[value].count += 1;
    });
    
    // Calculate average price and sort by total price
    const analysisData = Object.values(groupedData).map((item: any) => ({
      ...item,
      avgPrice: item.totalPrice / item.count
    })).sort((a: any, b: any) => b.totalPrice - a.totalPrice);
    
    setPriceAnalysisData(analysisData);
  };

  useEffect(() => {
    fetchEmailAccounts();
  }, []);

  useEffect(() => {
    if (emailAccounts.length > 0) {
      generatePriceAnalysisData(emailAccounts);
    }
  }, [selectedAnalysis, emailAccounts]);

  return (
    <div className="min-h-screen bg-gradient-dashboard">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-md border-b border-white/10 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button asChild variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Portal
                </Link>
              </Button>
              <div className="h-6 w-px bg-white/20"></div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-dashboard-primary to-dashboard-accent bg-clip-text text-transparent">
                  Sending Accounts Infrastructure
                </h1>
                <p className="text-white/70 mt-1">Email Infrastructure Management & Monitoring</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="bg-dashboard-success/20 text-dashboard-success border-dashboard-success/40">
                <Activity className="h-3 w-3 mr-1" />
                All Systems Operational
              </Badge>
              <Button 
                onClick={fetchEmailAccounts} 
                disabled={loading}
                variant="ghost" 
                size="sm" 
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Status Overview - 6 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {/* Card 1: Total Email Accounts Owned */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Mail className="h-6 w-6 text-dashboard-primary" />
                <Badge variant="outline" className="bg-dashboard-success/20 text-dashboard-success border-dashboard-success/40">
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">{loading ? '...' : accountStats.total}</div>
              <p className="text-white/70 text-sm">{loading ? loadingMessage : 'Total Email Accounts Owned'}</p>
            </CardContent>
          </Card>

          {/* Card 2: Average Email Accounts per Client */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Users className="h-6 w-6 text-dashboard-accent" />
                <Badge variant="outline" className="bg-dashboard-primary/20 text-dashboard-primary border-dashboard-primary/40">
                  Balanced
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">{loading ? '...' : accountStats.avgPerClient}</div>
              <p className="text-white/70 text-sm">Avg Accounts per Client</p>
            </CardContent>
          </Card>

          {/* Card 3: Connected Accounts */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CheckCircle className="h-6 w-6 text-dashboard-success" />
                <Badge variant="outline" className="bg-dashboard-success/20 text-dashboard-success border-dashboard-success/40">
                  Connected
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">{loading ? '...' : accountStats.connected}</div>
              <p className="text-white/70 text-sm">Connected Accounts</p>
            </CardContent>
          </Card>

          {/* Card 4: Disconnected Accounts */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <XCircle className="h-6 w-6 text-dashboard-warning" />
                <Badge variant="outline" className="bg-dashboard-warning/20 text-dashboard-warning border-dashboard-warning/40">
                  {accountStats.disconnected > 0 ? 'Attention' : 'All Good'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">{loading ? '...' : accountStats.disconnected}</div>
              <p className="text-white/70 text-sm">Disconnected Accounts</p>
            </CardContent>
          </Card>

          {/* Card 5: Total Price */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Mail className="h-6 w-6 text-dashboard-primary" />
                <Badge variant="outline" className="bg-dashboard-primary/20 text-dashboard-primary border-dashboard-primary/40">
                  Revenue
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">
                ${loading ? '...' : accountStats.totalPrice.toFixed(2)}
              </div>
              <p className="text-white/70 text-sm">Total Account Value</p>
            </CardContent>
          </Card>

          {/* Card 6: Average Cost per Client */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Users className="h-6 w-6 text-dashboard-accent" />
                <Badge variant="outline" className="bg-dashboard-accent/20 text-dashboard-accent border-dashboard-accent/40">
                  Average
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">
                ${loading ? '...' : accountStats.avgCostPerClient}
              </div>
              <p className="text-white/70 text-sm">Avg Cost per Client</p>
            </CardContent>
          </Card>
        </div>

        {/* Visual Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Resellers Distribution */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Users className="h-5 w-5 text-dashboard-primary" />
                <span>Resellers Distribution</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-white/70">Loading chart data...</div>
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={resellerData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({name, percentage}) => `${name}: ${percentage}%`}
                      >
                        {resellerData.map((entry, index) => (
                          <Cell 
                            key={`reseller-${index}`} 
                            fill={index === 0 ? 'hsl(var(--dashboard-primary))' : 
                                  index === 1 ? 'hsl(var(--dashboard-accent))' : 
                                  index === 2 ? 'hsl(var(--dashboard-success))' : 
                                  'hsl(var(--dashboard-warning))'} 
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: 'white'
                        }}
                        formatter={(value, name) => [
                          `${value} accounts (${resellerData.find(d => d.value === value)?.percentage}%)`,
                          'Count'
                        ]}
                      />
                      <Legend 
                        wrapperStyle={{ color: 'white' }}
                        formatter={(value) => {
                          const item = resellerData.find(d => d.name === value);
                          return `${value} (${item?.value} accounts)`;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Types Distribution */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Mail className="h-5 w-5 text-dashboard-accent" />
                <span>Account Types Distribution</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="text-white/70">Loading chart data...</div>
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={accountTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({name, percentage}) => `${name}: ${percentage}%`}
                      >
                        {accountTypeData.map((entry, index) => (
                          <Cell 
                            key={`type-${index}`} 
                            fill={index === 0 ? 'hsl(var(--dashboard-success))' : 
                                  index === 1 ? 'hsl(var(--dashboard-primary))' : 
                                  index === 2 ? 'hsl(var(--dashboard-accent))' : 
                                  'hsl(var(--dashboard-warning))'} 
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: 'white'
                        }}
                        formatter={(value, name) => [
                          `${value} accounts (${accountTypeData.find(d => d.value === value)?.percentage}%)`,
                          'Count'
                        ]}
                      />
                      <Legend 
                        wrapperStyle={{ color: 'white' }}
                        formatter={(value) => {
                          const item = accountTypeData.find(d => d.name === value);
                          return `${value} (${item?.value} accounts)`;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Simplified Price Analysis */}
        <div className="mt-8">
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Activity className="h-5 w-5 text-dashboard-primary" />
                <span>Price Analysis</span>
              </CardTitle>
              <div className="flex items-center space-x-4 mt-4">
                <label className="text-white/70 text-sm">Analyze by:</label>
                <Select value={selectedAnalysis} onValueChange={setSelectedAnalysis}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Email Provider">Email Provider</SelectItem>
                    <SelectItem value="Reseller">Reseller</SelectItem>
                    <SelectItem value="Client">Client</SelectItem>
                    <SelectItem value="Account Type">Account Type</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-96 flex items-center justify-center">
                  <div className="text-white/70">Loading analysis...</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bar Chart */}
                  <div className="h-80">
                    <h3 className="text-white/90 text-lg font-semibold mb-4">Total Price by {selectedAnalysis}</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={priceAnalysisData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis 
                          dataKey="name" 
                          stroke="rgba(255,255,255,0.7)"
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          interval={0}
                          fontSize={11}
                        />
                        <YAxis stroke="rgba(255,255,255,0.7)" />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: 'white'
                          }}
                          formatter={(value: number) => [`$${value.toFixed(2)}`, 'Total Price']}
                        />
                        <Bar 
                          dataKey="totalPrice" 
                          fill="hsl(var(--dashboard-primary))"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Summary Table */}
                  <div className="h-80 overflow-y-auto">
                    <h3 className="text-white/90 text-lg font-semibold mb-4">Summary by {selectedAnalysis}</h3>
                    <div className="space-y-3">
                      {priceAnalysisData.map((item: any, index) => (
                        <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-white font-medium truncate">{item.name}</h4>
                            <Badge variant="outline" className="bg-dashboard-primary/20 text-dashboard-primary border-dashboard-primary/40 ml-2">
                              {item.count} accounts
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-white/70">Total Value:</span>
                              <div className="text-white font-semibold">${item.totalPrice.toFixed(2)}</div>
                            </div>
                            <div>
                              <span className="text-white/70">Avg per Account:</span>
                              <div className="text-white font-semibold">${item.avgPrice.toFixed(2)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SendingAccountsInfrastructure;