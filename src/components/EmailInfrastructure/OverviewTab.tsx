/**
 * Overview Tab Component
 *
 * Dashboard overview with health metrics, alerts, and quick stats
 * Created: 2025-10-27
 */

import { useState, useEffect } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { AlertsSection } from './AlertsSection';
import { useAlerts, type EmailAccount } from '@/hooks/useAlerts';
import { supabase } from '@/integrations/supabase/client';

interface OverviewTabProps {
  // Optional: can receive pre-fetched data to avoid duplicate queries
}

interface QuickStatsMetrics {
  totalAccounts: number;
  connectedAccounts: number;
  disconnectedAccounts: number;
  failedAccounts: number;
  totalSent: number;
  totalReplies: number;
}

export function OverviewTab({}: OverviewTabProps) {
  const [metrics, setMetrics] = useState<QuickStatsMetrics | null>(null);
  const [accounts, setAccounts] = useState<EmailAccount[] | null>(null);
  const [loading, setLoading] = useState(true);
  const alertsResult = useAlerts(accounts);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);

      // Fetch email accounts data
      const { data: accountsData, error } = await supabase
        .from('email_accounts_view')
        .select('id, email_address, workspace_name, status, emails_sent_count, total_replied_count, bounced_count, reply_rate_percentage, last_synced_at');

      if (error) throw error;

      if (!accountsData) {
        setMetrics(null);
        setAccounts(null);
        return;
      }

      // Store accounts for alerts
      setAccounts(accountsData as EmailAccount[]);

      // Calculate metrics for quick stats
      const totalAccounts = accountsData.length;
      const connectedAccounts = accountsData.filter(a => a.status === 'connected').length;
      const disconnectedAccounts = accountsData.filter(a => a.status === 'disconnected').length;
      const failedAccounts = accountsData.filter(a => a.status === 'failed').length;

      const totalSent = accountsData.reduce((sum, a) => sum + (a.emails_sent_count || 0), 0);
      const totalReplies = accountsData.reduce((sum, a) => sum + (a.total_replied_count || 0), 0);

      setMetrics({
        totalAccounts,
        connectedAccounts,
        disconnectedAccounts,
        failedAccounts,
        totalSent,
        totalReplies,
      });
    } catch (error) {
      console.error('Error fetching health metrics:', error);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-2xl font-bold">Email Infrastructure Overview</h2>
        <p className="text-white/60 text-sm mt-1">
          System health metrics and key performance indicators
        </p>
      </div>

      {/* Alerts Section */}
      <AlertsSection alertsResult={alertsResult} loading={loading} />

      {/* Quick Stats */}
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
    </div>
  );
}
