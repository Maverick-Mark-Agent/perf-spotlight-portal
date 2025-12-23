/**
 * Overview Tab Component
 *
 * Dashboard overview with health metrics, alerts, and quick stats
 * Created: 2025-10-27
 */

import { useState, useEffect, useMemo } from 'react';
import { MessageSquare, Send, Users, Mail, DollarSign } from 'lucide-react';
import { AlertsSection } from './AlertsSection';
import { useAlerts, type EmailAccount } from '@/hooks/useAlerts';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer } from 'recharts';

interface OverviewTabProps {
  // Receive pre-fetched data from parent to avoid Supabase's 1000-row limit
  emailAccounts?: any[];
  loading?: boolean;
}

interface QuickStatsMetrics {
  totalAccounts: number;
  connectedAccounts: number;
  disconnectedAccounts: number;
  failedAccounts: number;
  totalSent: number;
  totalReplies: number;
}

export function OverviewTab({ emailAccounts: parentAccounts, loading: parentLoading }: OverviewTabProps) {
  const [metrics, setMetrics] = useState<QuickStatsMetrics | null>(null);
  const [accounts, setAccounts] = useState<EmailAccount[] | null>(null);
  const [loading, setLoading] = useState(parentLoading ?? true);
  const alertsResult = useAlerts(accounts);

  // Calculate client chart data
  const clientChartData = useMemo(() => {
    if (!accounts || accounts.length === 0) return [];
    
    const clientCounts: { [key: string]: number } = {};
    accounts.forEach(account => {
      const clientName = account.workspace_name || 'Unknown Client';
      clientCounts[clientName] = (clientCounts[clientName] || 0) + 1;
    });
    
    const sortedData = Object.entries(clientCounts)
      .map(([name, count]) => ({ name, count: count as number }))
      .sort((a, b) => b.count - a.count);
    
    return sortedData.map((item, index) => ({
      ...item,
      rank: index + 1,
      fill: index < 3 ? '#10B981' : // Top 3 - bright green
            index >= sortedData.length - 3 ? '#6B7280' : // Bottom 3 - gray
            '#3B82F6', // Middle - blue
      isTop3: index < 3
    }));
  }, [accounts]);

  // Calculate account stats (for All Clients cards)
  const accountStats = useMemo(() => {
    if (!accounts || accounts.length === 0) {
      return {
        total: 0,
        avgPerClient: '0',
        totalPrice: 0,
        avgCostPerClient: '0'
      };
    }

    const totalAccounts = accounts.length;
    
    // Count unique clients
    const uniqueClients = new Set(accounts.map(acc => acc.workspace_name).filter(Boolean)).size;
    const avgAccountsPerClient = uniqueClients > 0 ? (totalAccounts / uniqueClients).toFixed(1) : '0';

    // Calculate total price
    const totalPrice = accounts.reduce((sum, account) => {
      const price = (account as any).price || 0;
      return sum + price;
    }, 0);

    const avgCostPerClient = uniqueClients > 0 ? (totalPrice / uniqueClients).toFixed(2) : '0';

    return {
      total: totalAccounts,
      avgPerClient: avgAccountsPerClient,
      totalPrice,
      avgCostPerClient
    };
  }, [accounts]);

  // Use parent's data if available (properly paginated), otherwise calculate from accounts
  useEffect(() => {
    if (parentAccounts && parentAccounts.length > 0) {
      // Use parent's pre-fetched data (properly paginated, bypasses Supabase 1000-row limit)
      const accountsData = parentAccounts.map((acc: any) => ({
        id: acc.id,
        email_address: acc.fields?.Email || acc.email_address,
        workspace_name: acc.workspace_name || acc.fields?.['Client Name (from Client)']?.[0],
        email_provider: acc.fields?.email_provider || acc.email_provider,
        reseller: acc.fields?.reseller || acc.reseller,
        status: acc.fields?.Status || acc.status,
        emails_sent_count: acc.fields?.['Emails Sent Count'] || acc.emails_sent_count || 0,
        total_replied_count: acc.fields?.['Total Replied Count'] || acc.total_replied_count || 0,
        bounced_count: acc.fields?.['Bounced Count'] || acc.bounced_count || 0,
        reply_rate_percentage: acc.fields?.['Reply Rate (%)'] || acc.reply_rate_percentage || 0,
        last_synced_at: acc.last_synced_at,
        price: acc.fields?.Price || acc.price || 0,
      }));

      setAccounts(accountsData as EmailAccount[]);
      calculateMetrics(accountsData);
      setLoading(false);
    }
  }, [parentAccounts]);

  // Update loading state from parent
  useEffect(() => {
    if (parentLoading !== undefined) {
      setLoading(parentLoading);
    }
  }, [parentLoading]);

  const calculateMetrics = (accountsData: any[]) => {
    const totalAccounts = accountsData.length;
    const connectedAccounts = accountsData.filter((a: any) =>
      a.status === 'connected' || a.status === 'Connected'
    ).length;
    const disconnectedAccounts = accountsData.filter((a: any) =>
      a.status === 'disconnected' || a.status === 'Disconnected' || a.status === 'Not connected'
    ).length;
    const failedAccounts = accountsData.filter((a: any) =>
      a.status === 'failed' || a.status === 'Failed'
    ).length;

    const totalSent = accountsData.reduce((sum: number, a: any) => sum + (a.emails_sent_count || 0), 0);
    const totalReplies = accountsData.reduce((sum: number, a: any) => sum + (a.total_replied_count || 0), 0);

    setMetrics({
      totalAccounts,
      connectedAccounts,
      disconnectedAccounts,
      failedAccounts,
      totalSent,
      totalReplies,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-2xl font-bold">Email Infrastructure Overview</h2>
        <p className="text-white/60 text-sm mt-1">
          System health metrics and key performance indicators
        </p>
      </div>

      {/* Account Stats - 4 Cards from All Clients */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <div className="text-2xl font-bold text-white mb-1">{accountStats.total}</div>
              <p className="text-white/70 text-sm">Total Email Accounts Owned</p>
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
              <div className="text-2xl font-bold text-white mb-1">{accountStats.avgPerClient}</div>
              <p className="text-white/70 text-sm">Avg Accounts per Client</p>
            </CardContent>
          </Card>

          {/* Card 3: Total Accounts Value */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <DollarSign className="h-6 w-6 text-dashboard-primary" />
                <Badge variant="outline" className="bg-dashboard-primary/20 text-dashboard-primary border-dashboard-primary/40">
                  Value
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">
                ${accountStats.totalPrice.toFixed(2)}
              </div>
              <p className="text-white/70 text-sm">Total Accounts Value</p>
            </CardContent>
          </Card>

          {/* Card 4: Average Cost per Client */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <DollarSign className="h-6 w-6 text-dashboard-accent" />
                <Badge variant="outline" className="bg-dashboard-accent/20 text-dashboard-accent border-dashboard-accent/40">
                  Average
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">
                ${accountStats.avgCostPerClient}
              </div>
              <p className="text-white/70 text-sm">Avg Cost per Client</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Stats - Performance Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-lg border border-white/10 p-6">
            <div className="flex items-center justify-between mb-3">
              <MessageSquare className="h-8 w-8 text-blue-500" />
              <div className="text-blue-400 text-sm font-semibold">
                {metrics.totalSent > 0 ? ((metrics.totalReplies / metrics.totalSent) * 100).toFixed(1) : '0'}%
              </div>
            </div>
            <div className="text-white/60 text-sm mb-1">Total Replies</div>
            <div className="text-white text-2xl font-bold">
              {metrics.totalReplies.toLocaleString()}
            </div>
            <div className="text-white/40 text-xs mt-1">
              {metrics.totalSent > 0 ? ((metrics.totalReplies / metrics.totalSent) * 100).toFixed(1) : '0'}% reply rate
            </div>
          </div>

          <div className="bg-white/5 rounded-lg border border-white/10 p-6">
            <div className="flex items-center justify-between mb-3">
              <Send className="h-8 w-8 text-purple-500" />
              <div className="text-purple-400 text-sm font-semibold">
                All Campaigns
              </div>
            </div>
            <div className="text-white/60 text-sm mb-1">Total Emails Sent</div>
            <div className="text-white text-2xl font-bold">
              {metrics.totalSent.toLocaleString()}
            </div>
            <div className="text-white/40 text-xs mt-1">
              across all accounts
            </div>
          </div>
        </div>
      )}

      {/* Total Accounts Per Client Chart */}
      <Card className="bg-white/5 backdrop-blur-sm border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Users className="h-5 w-5 text-dashboard-primary" />
            <span>Total Accounts Per Client</span>
          </CardTitle>
          <p className="text-white/60 text-sm mt-1">
            Distribution of email accounts across all clients
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-96 flex items-center justify-center">
              <div className="text-white/70">Loading client data...</div>
            </div>
          ) : clientChartData.length === 0 ? (
            <div className="h-96 flex items-center justify-center">
              <div className="text-white/70">No client data available</div>
            </div>
          ) : (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={clientChartData}
                  margin={{ top: 40, right: 30, left: 20, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="name" 
                    stroke="rgba(255,255,255,0.7)"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    fontSize={11}
                  />
                  <YAxis stroke="rgba(255,255,255,0.7)" />
                  <Bar 
                    dataKey="count" 
                    radius={[4, 4, 0, 0]}
                    label={{
                      position: 'top',
                      fill: 'white',
                      fontSize: 12,
                      fontWeight: 'bold'
                    }}
                  >
                    {clientChartData.map((item, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={item.fill}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts Section - Moved to bottom */}
      <AlertsSection alertsResult={alertsResult} loading={loading} accounts={accounts} />
    </div>
  );
}
