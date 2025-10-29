/**
 * Home Insurance Tab Component
 *
 * Main component for the Home Insurance view in the Email Infrastructure Dashboard
 * Displays aggregate stats, client performance breakdown, and client management
 * Created: 2025-10-27
 */

import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, AlertTriangle, CheckCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HomeInsuranceStats } from './HomeInsuranceStats';
import { ClientPerformanceList } from './ClientPerformanceList';
import { ManageClientsSection } from './ManageClientsSection';
import { CriticalAccountsModal } from './CriticalAccountsModal';
import {
  fetchHomeInsuranceAccounts,
  calculateHomeInsuranceStats,
  calculateClientPerformanceMetrics,
  identifyProblemAccounts,
} from '@/services/homeInsuranceService';
import type {
  HomeInsuranceEmailAccount,
  HomeInsuranceStats as StatsType,
  ClientPerformanceMetrics,
  ProblemAccount,
} from '@/types/homeInsurance';

export function HomeInsuranceTab() {
  const [accounts, setAccounts] = useState<HomeInsuranceEmailAccount[]>([]);
  const [stats, setStats] = useState<StatsType | null>(null);
  const [clientMetrics, setClientMetrics] = useState<ClientPerformanceMetrics[]>([]);
  const [problemAccounts, setProblemAccounts] = useState<ProblemAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManageClients, setShowManageClients] = useState(false);
  const [showCriticalAccountsModal, setShowCriticalAccountsModal] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const accountsData = await fetchHomeInsuranceAccounts();
      setAccounts(accountsData);

      // Calculate derived data
      const calculatedStats = calculateHomeInsuranceStats(accountsData);
      const calculatedMetrics = calculateClientPerformanceMetrics(accountsData);
      const problems = identifyProblemAccounts(accountsData);

      setStats(calculatedStats);
      setClientMetrics(calculatedMetrics);
      setProblemAccounts(problems);
    } catch (error) {
      console.error('Error loading Home Insurance data:', error);
      // Set empty states on error
      setStats({
        totalAccounts: 0,
        totalClients: 0,
        totalSent: 0,
        totalReplies: 0,
        totalBounces: 0,
        avgReplyRate: 0,
        avgBounceRate: 0,
        disconnectedCount: 0,
        connectedCount: 0,
        failedCount: 0,
        healthScore: 0,
      });
      setClientMetrics([]);
      setProblemAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleManageClientsUpdate = () => {
    // Reload data after clients are added/removed
    loadData();
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-white/70">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="text-lg">Loading Home Insurance data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-2xl font-bold">Home Insurance Email Infrastructure</h2>
          <p className="text-white/60 text-sm mt-1">
            Dedicated view for Home Insurance campaign email accounts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowManageClients(!showManageClients)}
            variant="outline"
            className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
          >
            {showManageClients ? 'Hide' : 'Manage Clients'}
          </Button>
          <Button
            onClick={loadData}
            variant="outline"
            className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Manage Clients Section (Collapsible) */}
      {showManageClients && (
        <ManageClientsSection onUpdate={handleManageClientsUpdate} />
      )}

      {/* Aggregate Statistics */}
      {stats && <HomeInsuranceStats stats={stats} loading={loading} />}

      {/* Problem Accounts Alert Section */}
      {problemAccounts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-white font-semibold text-lg">Action Required</h3>
              <p className="text-red-200 text-sm mt-0.5">
                {problemAccounts.length} account{problemAccounts.length === 1 ? '' : 's'} need attention
              </p>
            </div>
            <Button
              onClick={() => setShowCriticalAccountsModal(true)}
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 hover:bg-white/20 text-white flex-shrink-0"
            >
              <Eye className="h-4 w-4 mr-2" />
              View All {problemAccounts.length}
            </Button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {problemAccounts.slice(0, 10).map((problem, idx) => (
              <div
                key={idx}
                className="bg-white/5 rounded p-3 text-sm hover:bg-white/10 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-white font-medium">{problem.email_address}</div>
                    <div className="text-white/60 text-xs mt-0.5">{problem.workspace_name}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      problem.severity === 'critical'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {problem.severity}
                    </span>
                    <span className="text-white/50 text-xs capitalize">
                      {problem.issue.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div className="text-white/70 text-xs mt-2">{problem.details}</div>
              </div>
            ))}
          </div>

          {problemAccounts.length > 10 && (
            <div className="mt-3 text-center text-white/60 text-sm">
              And {problemAccounts.length - 10} more issue{problemAccounts.length - 10 === 1 ? '' : 's'}...
            </div>
          )}
        </div>
      )}

      {/* Success Message if No Problems */}
      {problemAccounts.length === 0 && accounts.length > 0 && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div>
              <h3 className="text-white font-semibold">All Systems Healthy</h3>
              <p className="text-green-200 text-sm mt-0.5">
                No critical issues detected across {accounts.length} email account{accounts.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Client Performance Breakdown */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-dashboard-primary" />
          <h3 className="text-white font-semibold text-lg">Client Performance Breakdown</h3>
        </div>
        <ClientPerformanceList clients={clientMetrics} accounts={accounts} />
      </div>

      {/* Empty State */}
      {accounts.length === 0 && !loading && (
        <div className="bg-white/5 rounded-lg border border-white/10 p-12 text-center">
          <AlertTriangle className="h-12 w-12 text-white/30 mx-auto mb-4" />
          <h3 className="text-white text-xl font-semibold mb-2">No Home Insurance Accounts</h3>
          <p className="text-white/60 mb-4">
            No clients are currently marked as "Home Insurance" in the client registry.
          </p>
          <Button
            onClick={() => setShowManageClients(true)}
            className="bg-dashboard-primary hover:bg-dashboard-primary/80"
          >
            Manage Clients
          </Button>
        </div>
      )}

      {/* Critical Accounts Modal */}
      <CriticalAccountsModal
        isOpen={showCriticalAccountsModal}
        onClose={() => setShowCriticalAccountsModal(false)}
        accounts={problemAccounts}
      />
    </div>
  );
}
