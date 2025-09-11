import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mail, Users, CheckCircle, XCircle, RefreshCw, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const SendingAccountsInfrastructure = () => {
  const [emailAccounts, setEmailAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Fetching all records...');
  const [accountStats, setAccountStats] = useState({
    total: 0,
    avgPerClient: '0',
    connected: 0,
    disconnected: 0
  });
  const [resellerData, setResellerData] = useState([]);
  const [accountTypeData, setAccountTypeData] = useState([]);

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
      
      setAccountStats({
        total: totalAccounts,
        avgPerClient: avgAccountsPerClient,
        connected: connectedCount,
        disconnected: disconnectedCount
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
      
    } catch (error) {
      console.error('Error fetching email accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailAccounts();
  }, []);

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
        {/* Status Overview - Only 4 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
      </div>
    </div>
  );
};

export default SendingAccountsInfrastructure;