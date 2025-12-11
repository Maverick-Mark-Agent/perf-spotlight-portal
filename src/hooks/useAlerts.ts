/**
 * Alerts Hook
 *
 * Identifies critical issues and action items in email infrastructure
 * Created: 2025-10-27
 */

import { useMemo } from 'react';

export interface EmailAccount {
  id: number;
  email_address: string;
  workspace_name: string;
  status: string;
  emails_sent_count: number;
  total_replied_count: number;
  bounced_count: number;
  reply_rate_percentage: number;
  last_synced_at: string | null;
}

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'connection' | 'performance' | 'reliability' | 'data';
  title: string;
  description: string;
  count?: number;
  accounts?: string[];
  actionable: boolean;
  recommendation: string;
  priority: number; // 1 = highest
}

export interface AlertsResult {
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  alerts: Alert[];
}

export function useAlerts(accounts: EmailAccount[] | null): AlertsResult {
  return useMemo(() => {
    if (!accounts || accounts.length === 0) {
      return {
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0,
        alerts: [],
      };
    }

    const alerts: Alert[] = [];
    let alertId = 0;

    // 1. CRITICAL: Disconnected Accounts
    const disconnectedAccounts = accounts.filter(a => a.status === 'disconnected');
    if (disconnectedAccounts.length > 0) {
      alerts.push({
        id: `alert-${++alertId}`,
        type: 'critical',
        category: 'connection',
        title: `${disconnectedAccounts.length} Disconnected Account${disconnectedAccounts.length === 1 ? '' : 's'}`,
        description: 'Email accounts are disconnected and not sending emails. This impacts your sending capacity.',
        count: disconnectedAccounts.length,
        accounts: disconnectedAccounts.slice(0, 5).map(a => a.email_address),
        actionable: true,
        recommendation: 'Reconnect accounts immediately via Email Bison dashboard',
        priority: 1,
      });
    }

    // 2. CRITICAL: Failed Accounts
    const failedAccounts = accounts.filter(a => a.status === 'failed');
    if (failedAccounts.length > 0) {
      alerts.push({
        id: `alert-${++alertId}`,
        type: 'critical',
        category: 'reliability',
        title: `${failedAccounts.length} Failed Account${failedAccounts.length === 1 ? '' : 's'}`,
        description: 'Accounts in failed state require immediate attention. They may have authentication or configuration issues.',
        count: failedAccounts.length,
        accounts: failedAccounts.slice(0, 5).map(a => a.email_address),
        actionable: true,
        recommendation: 'Check account credentials and settings in Email Bison',
        priority: 1,
      });
    }

    // 3. WARNING: High Bounce Rate Accounts (>5%)
    const highBounceAccounts = accounts.filter(a => {
      const bounceRate = a.emails_sent_count > 0 ? a.bounced_count / a.emails_sent_count : 0;
      return bounceRate > 0.05 && a.emails_sent_count > 50;
    });
    if (highBounceAccounts.length > 0) {
      alerts.push({
        id: `alert-${++alertId}`,
        type: 'warning',
        category: 'performance',
        title: `${highBounceAccounts.length} Account${highBounceAccounts.length === 1 ? '' : 's'} with High Bounce Rate`,
        description: 'Accounts with bounce rate >5% may be sending to invalid emails or have deliverability issues.',
        count: highBounceAccounts.length,
        accounts: highBounceAccounts.slice(0, 5).map(a => a.email_address),
        actionable: true,
        recommendation: 'Review and clean email lists, verify domain reputation',
        priority: 2,
      });
    }

    // 4. WARNING: Zero Reply Rate with 100+ Sent
    const zeroReplyAccounts = accounts.filter(a =>
      a.emails_sent_count >= 100 &&
      a.total_replied_count === 0
    );
    if (zeroReplyAccounts.length > 0) {
      alerts.push({
        id: `alert-${++alertId}`,
        type: 'warning',
        category: 'performance',
        title: `${zeroReplyAccounts.length} Account${zeroReplyAccounts.length === 1 ? '' : 's'} with 0% Reply Rate (100+ Sent)`,
        description: 'Accounts with no replies after 100+ emails sent may indicate poor email quality or targeting issues.',
        count: zeroReplyAccounts.length,
        accounts: zeroReplyAccounts.slice(0, 5).map(a => a.email_address),
        actionable: true,
        recommendation: 'Review email copy, subject lines, and targeting strategy',
        priority: 3,
      });
    }

    // 5. CRITICAL: Burnt Mailboxes (<0.4% reply rate with 200+ sent)
    const burntMailboxes = accounts.filter(a => {
      const replyRate = a.emails_sent_count > 0 ? (a.total_replied_count / a.emails_sent_count) * 100 : 0;
      return replyRate < 0.4 && a.emails_sent_count >= 200;
    });
    if (burntMailboxes.length > 0) {
      alerts.push({
        id: `alert-${++alertId}`,
        type: 'critical',
        category: 'performance',
        title: `${burntMailboxes.length} Burnt Mailbox${burntMailboxes.length === 1 ? '' : 'es'} (<0.4% Reply Rate)`,
        description: 'Accounts with extremely low reply rates (<0.4%) and 200+ emails sent. These mailboxes are likely burnt and should be canceled to reduce costs.',
        count: burntMailboxes.length,
        accounts: burntMailboxes.slice(0, 5).map(a => a.email_address),
        actionable: true,
        recommendation: 'Review and cancel these accounts immediately to save on subscription costs',
        priority: 2,
      });
    }

    // 6. WARNING: Low Reply Rate Accounts (<2% with 50+ sent)
    const lowReplyAccounts = accounts.filter(a => {
      const replyRate = a.emails_sent_count > 0 ? (a.total_replied_count / a.emails_sent_count) * 100 : 0;
      return replyRate >= 0.4 && replyRate < 2 && a.emails_sent_count >= 50;
    });
    if (lowReplyAccounts.length > 10) { // Only alert if it's a significant number
      alerts.push({
        id: `alert-${++alertId}`,
        type: 'warning',
        category: 'performance',
        title: `${lowReplyAccounts.length} Account${lowReplyAccounts.length === 1 ? '' : 's'} with Low Reply Rate (<2%)`,
        description: 'Multiple accounts showing below-average reply rates. This could indicate broader issues with email quality.',
        count: lowReplyAccounts.length,
        accounts: lowReplyAccounts.slice(0, 5).map(a => a.email_address),
        actionable: true,
        recommendation: 'A/B test email content and review targeting criteria',
        priority: 4,
      });
    }

    // 7. INFO: Stale Data
    const syncDates = accounts
      .map(a => a.last_synced_at ? new Date(a.last_synced_at).getTime() : 0)
      .filter(t => t > 0);
    if (syncDates.length > 0) {
      const mostRecentSync = Math.max(...syncDates);
      const dataAgeHours = (Date.now() - mostRecentSync) / (1000 * 60 * 60);

      if (dataAgeHours > 24) {
        alerts.push({
          id: `alert-${++alertId}`,
          type: 'critical',
          category: 'data',
          title: 'Data is Very Stale (>24 hours old)',
          description: `Email account data was last synced ${dataAgeHours.toFixed(1)} hours ago. Metrics may not reflect current state.`,
          actionable: true,
          recommendation: 'Trigger manual sync to refresh data',
          priority: 2,
        });
      } else if (dataAgeHours > 12) {
        alerts.push({
          id: `alert-${++alertId}`,
          type: 'warning',
          category: 'data',
          title: 'Data May Be Outdated (>12 hours old)',
          description: `Email account data was last synced ${dataAgeHours.toFixed(1)} hours ago.`,
          actionable: true,
          recommendation: 'Consider refreshing data for latest metrics',
          priority: 5,
        });
      }
    }

    // 8. INFO: Accounts with No Activity (0 sent, connected)
    const inactiveAccounts = accounts.filter(a =>
      a.status === 'connected' &&
      a.emails_sent_count === 0
    );
    if (inactiveAccounts.length > 20) { // Only alert if significant
      alerts.push({
        id: `alert-${++alertId}`,
        type: 'info',
        category: 'performance',
        title: `${inactiveAccounts.length} Connected Accounts with No Activity`,
        description: 'Accounts are connected but haven\'t sent any emails yet. This is normal for new accounts.',
        count: inactiveAccounts.length,
        actionable: false,
        recommendation: 'Monitor for the next few days as campaigns begin',
        priority: 6,
      });
    }

    // Sort alerts by priority
    alerts.sort((a, b) => a.priority - b.priority);

    // Count by type
    const criticalCount = alerts.filter(a => a.type === 'critical').length;
    const warningCount = alerts.filter(a => a.type === 'warning').length;
    const infoCount = alerts.filter(a => a.type === 'info').length;

    return {
      criticalCount,
      warningCount,
      infoCount,
      alerts,
    };
  }, [accounts]);
}
