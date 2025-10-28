/**
 * Home Insurance Stats Component
 *
 * Displays aggregate statistics for Home Insurance email accounts
 * Created: 2025-10-27
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, Mail, MessageSquare, AlertTriangle, TrendingUp } from 'lucide-react';
import type { HomeInsuranceStats } from '@/types/homeInsurance';

interface HomeInsuranceStatsProps {
  stats: HomeInsuranceStats;
  loading?: boolean;
}

export function HomeInsuranceStats({ stats, loading = false }: HomeInsuranceStatsProps) {
  // Determine health status color
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getHealthBadge = (score: number) => {
    if (score >= 80) return { variant: 'default' as const, text: 'Excellent', className: 'bg-green-500/20 text-green-500 border-green-500/40' };
    if (score >= 60) return { variant: 'default' as const, text: 'Good', className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/40' };
    return { variant: 'destructive' as const, text: 'Needs Attention', className: 'bg-red-500/20 text-red-500 border-red-500/40' };
  };

  const healthBadge = getHealthBadge(stats.healthScore);

  if (loading) {
    return (
      <Card className="bg-white/5 backdrop-blur-sm border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Home className="h-5 w-5 text-dashboard-accent" />
            Home Insurance Infrastructure
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-white/70">Loading statistics...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Home className="h-5 w-5 text-dashboard-accent" />
            Home Insurance Infrastructure
          </CardTitle>
          <Badge variant={healthBadge.variant} className={healthBadge.className}>
            Health: {stats.healthScore}/100 - {healthBadge.text}
          </Badge>
        </div>
        <p className="text-white/60 text-sm mt-1">
          Performance overview across all Home Insurance clients
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Total Accounts */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="h-4 w-4 text-dashboard-primary" />
              <span className="text-white/70 text-xs">Total Accounts</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalAccounts.toLocaleString()}</div>
          </div>

          {/* Active Clients */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <Home className="h-4 w-4 text-dashboard-primary" />
              <span className="text-white/70 text-xs">Active Clients</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalClients.toLocaleString()}</div>
          </div>

          {/* Avg Reply Rate */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="h-4 w-4 text-dashboard-success" />
              <span className="text-white/70 text-xs">Avg Reply Rate</span>
            </div>
            <div className="text-2xl font-bold text-dashboard-success">{stats.avgReplyRate.toFixed(1)}%</div>
            <div className="text-xs text-white/50">{stats.totalReplies.toLocaleString()} replies</div>
          </div>

          {/* Avg Bounce Rate */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-dashboard-warning" />
              <span className="text-white/70 text-xs">Avg Bounce Rate</span>
            </div>
            <div className={`text-2xl font-bold ${stats.avgBounceRate > 5 ? 'text-red-500' : 'text-dashboard-warning'}`}>
              {stats.avgBounceRate.toFixed(1)}%
            </div>
            <div className="text-xs text-white/50">{stats.totalBounces.toLocaleString()} bounced</div>
          </div>

          {/* Connected */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-white/70 text-xs">Connected</span>
            </div>
            <div className="text-2xl font-bold text-green-500">{stats.connectedCount.toLocaleString()}</div>
            <div className="text-xs text-white/50">
              {stats.totalAccounts > 0 ? ((stats.connectedCount / stats.totalAccounts) * 100).toFixed(0) : 0}% of total
            </div>
          </div>

          {/* Issues */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-white/70 text-xs">Issues</span>
            </div>
            <div className={`text-2xl font-bold ${stats.disconnectedCount > 0 ? 'text-red-500' : 'text-white/50'}`}>
              {stats.disconnectedCount + stats.failedCount}
            </div>
            <div className="text-xs text-white/50">
              {stats.disconnectedCount} disconnected, {stats.failedCount} failed
            </div>
          </div>
        </div>

        {/* Additional Metrics Row */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-white/70">Total Emails Sent:</span>
              <span className="text-white font-semibold ml-2">{stats.totalSent.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-white/70">Connection Rate:</span>
              <span className={`font-semibold ml-2 ${
                stats.totalAccounts > 0 && (stats.connectedCount / stats.totalAccounts) >= 0.95
                  ? 'text-green-500'
                  : 'text-yellow-500'
              }`}>
                {stats.totalAccounts > 0 ? ((stats.connectedCount / stats.totalAccounts) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div>
              <span className="text-white/70">Avg Accounts/Client:</span>
              <span className="text-white font-semibold ml-2">
                {stats.totalClients > 0 ? (stats.totalAccounts / stats.totalClients).toFixed(1) : 0}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
