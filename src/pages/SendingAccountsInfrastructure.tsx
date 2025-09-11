import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Server, Shield, Activity, Database, Mail, Settings, AlertTriangle, CheckCircle, PieChart, BarChart } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

const SendingAccountsInfrastructure = () => {
  const [emailAccounts, setEmailAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accountStats, setAccountStats] = useState({
    total: 0,
    typeStats: [],
    statusStats: []
  });

  useEffect(() => {
    const fetchEmailAccounts = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('airtable-email-accounts');
        
        if (error) throw error;
        
        const accounts = data.records || [];
        setEmailAccounts(accounts);
        
        // Process account type statistics
        const typeCount = {};
        const statusCount = {};
        
        accounts.forEach(account => {
          const type = account.fields['Account Type'] || 'Unknown';
          const status = account.fields['Status'] || 'Unknown';
          
          typeCount[type] = (typeCount[type] || 0) + 1;
          statusCount[status] = (statusCount[status] || 0) + 1;
        });
        
        const typeStats = Object.entries(typeCount).map(([name, count]) => ({
          name,
          value: count as number,
          percentage: accounts.length > 0 ? (((count as number) / accounts.length) * 100).toFixed(1) : '0'
        }));
        
        const statusStats = Object.entries(statusCount).map(([name, count]) => ({
          name,
          value: count as number
        }));
        
        setAccountStats({
          total: accounts.length,
          typeStats,
          statusStats
        });
        
      } catch (error) {
        console.error('Error fetching email accounts:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEmailAccounts();
  }, []);

  const COLORS = ['hsl(var(--dashboard-primary))', 'hsl(var(--dashboard-accent))', 'hsl(var(--dashboard-success))', 'hsl(var(--dashboard-warning))'];

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
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Server className="h-6 w-6 text-dashboard-primary" />
                <Badge variant="outline" className="bg-dashboard-success/20 text-dashboard-success border-dashboard-success/40">
                  Online
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">12</div>
              <p className="text-white/70 text-sm">Active Sending Domains</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Mail className="h-6 w-6 text-dashboard-accent" />
                <Badge variant="outline" className="bg-dashboard-success/20 text-dashboard-success border-dashboard-success/40">
                  Healthy
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">{loading ? '...' : accountStats.total}</div>
              <p className="text-white/70 text-sm">Total Email Accounts</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Shield className="h-6 w-6 text-dashboard-warning" />
                <Badge variant="outline" className="bg-dashboard-warning/20 text-dashboard-warning border-dashboard-warning/40">
                  Monitoring
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">98.7%</div>
              <p className="text-white/70 text-sm">Deliverability Rate</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Database className="h-6 w-6 text-dashboard-success" />
                <Badge variant="outline" className="bg-dashboard-success/20 text-dashboard-success border-dashboard-success/40">
                  Synced
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">24/7</div>
              <p className="text-white/70 text-sm">Monitoring Active</p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Account Types Pie Chart */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <PieChart className="h-5 w-5 text-dashboard-primary" />
                Account Types Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-white/70">Loading...</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={accountStats.typeStats}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                    >
                      {accountStats.typeStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(0,0,0,0.8)', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px'
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Account Status Bar Chart */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart className="h-5 w-5 text-dashboard-accent" />
                Account Status Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-white/70">Loading...</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBarChart data={accountStats.statusStats}>
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                    />
                    <YAxis 
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(0,0,0,0.8)', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--dashboard-primary))" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Sending Domains */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Server className="h-5 w-5 text-dashboard-primary" />
                Sending Domains Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { domain: "mail1.maverickmarketing.com", status: "Active", health: "Excellent" },
                { domain: "mail2.maverickmarketing.com", status: "Active", health: "Good" },
                { domain: "notifications.maverickmarketing.com", status: "Active", health: "Excellent" },
                { domain: "campaigns.maverickmarketing.com", status: "Warming", health: "Warming" }
              ].map((domain, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                  <div>
                    <p className="text-white font-medium">{domain.domain}</p>
                    <p className="text-white/60 text-sm">{domain.status}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={
                        domain.health === "Excellent" ? "bg-dashboard-success/20 text-dashboard-success border-dashboard-success/40" :
                        domain.health === "Good" ? "bg-dashboard-primary/20 text-dashboard-primary border-dashboard-primary/40" :
                        "bg-dashboard-warning/20 text-dashboard-warning border-dashboard-warning/40"
                      }
                    >
                      {domain.health}
                    </Badge>
                    <CheckCircle className="h-4 w-4 text-dashboard-success" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Account Health */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-dashboard-success" />
                Account Health Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { metric: "Spam Score", value: "0.2/10", status: "excellent" },
                { metric: "Bounce Rate", value: "1.2%", status: "good" },
                { metric: "Complaint Rate", value: "0.05%", status: "excellent" },
                { metric: "Domain Reputation", value: "95/100", status: "excellent" },
                { metric: "IP Reputation", value: "92/100", status: "good" },
                { metric: "Authentication", value: "Pass", status: "excellent" }
              ].map((metric, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                  <div>
                    <p className="text-white font-medium">{metric.metric}</p>
                    <p className="text-white/60 text-sm">{metric.value}</p>
                  </div>
                  <div className={`h-3 w-3 rounded-full ${
                    metric.status === "excellent" ? "bg-dashboard-success" :
                    metric.status === "good" ? "bg-dashboard-primary" :
                    "bg-dashboard-warning"
                  }`}></div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Infrastructure Settings */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="h-5 w-5 text-dashboard-accent" />
                Infrastructure Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <p className="text-white/70 text-sm">Daily Send Limit</p>
                  <p className="text-white font-semibold">50,000</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <p className="text-white/70 text-sm">Hourly Rate Limit</p>
                  <p className="text-white font-semibold">2,500</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <p className="text-white/70 text-sm">Active Connections</p>
                  <p className="text-white font-semibold">12</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <p className="text-white/70 text-sm">Load Balancing</p>
                  <p className="text-white font-semibold">Enabled</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Alerts */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-dashboard-warning" />
                Recent System Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-dashboard-success/10 border border-dashboard-success/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-dashboard-success" />
                  <span className="text-dashboard-success font-medium">Domain Warming Complete</span>
                </div>
                <p className="text-white/70 text-sm mt-1">campaigns.maverickmarketing.com is now ready for full volume</p>
                <p className="text-white/50 text-xs mt-1">2 hours ago</p>
              </div>
              
              <div className="p-3 bg-dashboard-primary/10 border border-dashboard-primary/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-dashboard-primary" />
                  <span className="text-dashboard-primary font-medium">Performance Optimization</span>
                </div>
                <p className="text-white/70 text-sm mt-1">Delivery rate improved by 2.3% after recent updates</p>
                <p className="text-white/50 text-xs mt-1">1 day ago</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SendingAccountsInfrastructure;