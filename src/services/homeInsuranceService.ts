/**
 * Home Insurance Service
 *
 * Service layer for fetching and managing Home Insurance client data
 * Created: 2025-10-27
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  HomeInsuranceClient,
  HomeInsuranceEmailAccount,
  HomeInsuranceStats,
  ClientPerformanceMetrics,
  ProblemAccount,
} from '@/types/homeInsurance';

/**
 * Fetch all Home Insurance email accounts
 * Uses the email_accounts_home_insurance_view materialized view for performance
 */
export async function fetchHomeInsuranceAccounts(): Promise<HomeInsuranceEmailAccount[]> {
  const { data, error } = await supabase
    .from('email_accounts_home_insurance_view')
    .select('*')
    .order('workspace_name', { ascending: true })
    .order('email_address', { ascending: true });

  if (error) {
    console.error('Error fetching home insurance accounts:', error);
    throw new Error(`Failed to fetch home insurance accounts: ${error.message}`);
  }

  return data || [];
}

/**
 * Fetch all Home Insurance clients from client_registry
 */
export async function fetchHomeInsuranceClients(): Promise<HomeInsuranceClient[]> {
  const { data, error } = await supabase
    .from('client_registry')
    .select('*')
    .eq('client_type', 'home_insurance')
    .eq('is_active', true)
    .order('display_name', { ascending: true });

  if (error) {
    console.error('Error fetching home insurance clients:', error);
    throw new Error(`Failed to fetch home insurance clients: ${error.message}`);
  }

  return data || [];
}

/**
 * Fetch all clients (for manage clients section)
 */
export async function fetchAllClients(): Promise<HomeInsuranceClient[]> {
  const { data, error } = await supabase
    .from('client_registry')
    .select('*')
    .eq('is_active', true)
    .order('display_name', { ascending: true });

  if (error) {
    console.error('Error fetching all clients:', error);
    throw new Error(`Failed to fetch all clients: ${error.message}`);
  }

  return data || [];
}

/**
 * Add a client to the Home Insurance category
 */
export async function addClientToHomeInsurance(workspaceName: string): Promise<void> {
  const { error } = await supabase
    .from('client_registry')
    .update({ client_type: 'home_insurance', updated_at: new Date().toISOString() })
    .eq('workspace_name', workspaceName);

  if (error) {
    console.error('Error adding client to home insurance:', error);
    throw new Error(`Failed to add client to home insurance: ${error.message}`);
  }

  // Note: The materialized view will need to be refreshed
  // This happens automatically during the nightly sync, or can be triggered manually
}

/**
 * Remove a client from the Home Insurance category
 */
export async function removeClientFromHomeInsurance(workspaceName: string): Promise<void> {
  const { error } = await supabase
    .from('client_registry')
    .update({ client_type: 'other', updated_at: new Date().toISOString() })
    .eq('workspace_name', workspaceName);

  if (error) {
    console.error('Error removing client from home insurance:', error);
    throw new Error(`Failed to remove client from home insurance: ${error.message}`);
  }

  // Note: The materialized view will need to be refreshed
}

/**
 * Refresh the home insurance materialized view
 * (Requires service_role permissions - call from Edge Function)
 */
export async function refreshHomeInsuranceView(): Promise<void> {
  try {
    const { error } = await supabase.rpc('refresh_home_insurance_view');

    if (error) {
      console.error('Error refreshing home insurance view:', error);
      throw error;
    }
  } catch (err) {
    console.warn('Could not refresh materialized view. It will refresh on next scheduled sync.');
    // Don't throw - this is a nice-to-have, not critical
  }
}

/**
 * Calculate aggregate statistics for Home Insurance accounts
 */
export function calculateHomeInsuranceStats(
  accounts: HomeInsuranceEmailAccount[]
): HomeInsuranceStats {
  const totalAccounts = accounts.length;
  const uniqueClients = new Set(accounts.map(a => a.workspace_name)).size;

  const totalSent = accounts.reduce((sum, a) => sum + (a.emails_sent_count || 0), 0);
  const totalReplies = accounts.reduce((sum, a) => sum + (a.total_replied_count || 0), 0);
  const totalBounces = accounts.reduce((sum, a) => sum + (a.bounced_count || 0), 0);

  const avgReplyRate = totalSent > 0 ? (totalReplies / totalSent) * 100 : 0;
  const avgBounceRate = totalSent > 0 ? (totalBounces / totalSent) * 100 : 0;

  const disconnectedCount = accounts.filter(a => a.status === 'Disconnected' || a.status === 'Not connected').length;
  const connectedCount = accounts.filter(a => a.status === 'Connected').length;
  const failedCount = accounts.filter(a => a.status === 'Failed').length;

  // Simple health score: 100 - (bounce rate * 10 + disconnected %)
  const disconnectedPercent = totalAccounts > 0 ? (disconnectedCount / totalAccounts) * 100 : 0;
  const healthScore = Math.max(0, Math.min(100, 100 - (avgBounceRate * 10 + disconnectedPercent)));

  return {
    totalAccounts,
    totalClients: uniqueClients,
    totalSent,
    totalReplies,
    totalBounces,
    avgReplyRate: parseFloat(avgReplyRate.toFixed(2)),
    avgBounceRate: parseFloat(avgBounceRate.toFixed(2)),
    disconnectedCount,
    connectedCount,
    failedCount,
    healthScore: Math.round(healthScore),
  };
}

/**
 * Calculate performance metrics for each client
 */
export function calculateClientPerformanceMetrics(
  accounts: HomeInsuranceEmailAccount[]
): ClientPerformanceMetrics[] {
  const clientGroups = new Map<string, HomeInsuranceEmailAccount[]>();

  // Group accounts by workspace
  accounts.forEach(account => {
    const existing = clientGroups.get(account.workspace_name) || [];
    clientGroups.set(account.workspace_name, [...existing, account]);
  });

  // Calculate metrics for each client
  return Array.from(clientGroups.entries()).map(([workspace_name, clientAccounts]) => {
    const totalSent = clientAccounts.reduce((sum, a) => sum + (a.emails_sent_count || 0), 0);
    const totalReplies = clientAccounts.reduce((sum, a) => sum + (a.total_replied_count || 0), 0);
    const totalBounces = clientAccounts.reduce((sum, a) => sum + (a.bounced_count || 0), 0);

    const replyRate = totalSent > 0 ? (totalReplies / totalSent) * 100 : 0;
    const bounceRate = totalSent > 0 ? (totalBounces / totalSent) * 100 : 0;

    // Calculate average bounce rate per account (for comparison)
    const bounceRateSum = clientAccounts.reduce((sum, a) => {
      const sent = a.emails_sent_count || 0;
      const bounced = a.bounced_count || 0;
      return sum + (sent > 0 ? (bounced / sent) * 100 : 0);
    }, 0);
    const avgBounceRatePerAccount = clientAccounts.length > 0 ? bounceRateSum / clientAccounts.length : 0;

    const connectedCount = clientAccounts.filter(a => a.status === 'Connected').length;
    const disconnectedCount = clientAccounts.filter(a => a.status === 'Disconnected' || a.status === 'Not connected').length;
    const failedCount = clientAccounts.filter(a => a.status === 'Failed').length;

    return {
      workspace_name,
      display_name: clientAccounts[0]?.client_display_name || null,
      accountCount: clientAccounts.length,
      totalSent,
      totalReplies,
      replyRate: parseFloat(replyRate.toFixed(2)),
      totalBounces,
      bounceRate: parseFloat(bounceRate.toFixed(2)),
      avgBounceRatePerAccount: parseFloat(avgBounceRatePerAccount.toFixed(2)),
      connectedCount,
      disconnectedCount,
      failedCount,
    };
  }).sort((a, b) => {
    // Sort by account count descending
    return b.accountCount - a.accountCount;
  });
}

/**
 * Identify problem accounts that need attention
 */
export function identifyProblemAccounts(
  accounts: HomeInsuranceEmailAccount[]
): ProblemAccount[] {
  const problems: ProblemAccount[] = [];

  accounts.forEach(account => {
    const sent = account.emails_sent_count || 0;
    const bounced = account.bounced_count || 0;
    const replies = account.total_replied_count || 0;
    const bounceRate = sent > 0 ? (bounced / sent) * 100 : 0;
    const replyRate = sent > 0 ? (replies / sent) * 100 : 0;

    // Disconnected accounts
    if (account.status === 'Disconnected' || account.status === 'Not connected') {
      problems.push({
        email_address: account.email_address,
        workspace_name: account.workspace_name,
        issue: 'disconnected',
        severity: 'critical',
        details: `Account is ${account.status.toLowerCase()} and not sending emails`,
        emailsSent: sent,
      });
    }

    // High bounce rate (>5%)
    if (sent >= 50 && bounceRate > 5) {
      problems.push({
        email_address: account.email_address,
        workspace_name: account.workspace_name,
        issue: 'high_bounce',
        severity: bounceRate > 10 ? 'critical' : 'warning',
        details: `Bounce rate of ${bounceRate.toFixed(1)}% is too high`,
        emailsSent: sent,
        bounceRate: parseFloat(bounceRate.toFixed(2)),
      });
    }

    // Zero replies with 100+ sent
    if (sent >= 100 && replies === 0) {
      problems.push({
        email_address: account.email_address,
        workspace_name: account.workspace_name,
        issue: 'zero_replies',
        severity: 'warning',
        details: `${sent} emails sent but zero replies received`,
        emailsSent: sent,
        replyRate: 0,
      });
    }

    // Low reply rate (<3%) with 100+ sent
    if (sent >= 100 && replyRate < 3 && replyRate > 0) {
      problems.push({
        email_address: account.email_address,
        workspace_name: account.workspace_name,
        issue: 'low_reply_rate',
        severity: 'warning',
        details: `Reply rate of ${replyRate.toFixed(1)}% is below healthy threshold`,
        emailsSent: sent,
        replyRate: parseFloat(replyRate.toFixed(2)),
      });
    }
  });

  // Sort by severity (critical first), then by emails sent (highest first)
  return problems.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'critical' ? -1 : 1;
    }
    return b.emailsSent - a.emailsSent;
  });
}

/**
 * Filter accounts by workspace name
 */
export function filterAccountsByClient(
  accounts: HomeInsuranceEmailAccount[],
  workspaceName: string | null
): HomeInsuranceEmailAccount[] {
  if (!workspaceName) {
    return accounts;
  }
  return accounts.filter(a => a.workspace_name === workspaceName);
}
