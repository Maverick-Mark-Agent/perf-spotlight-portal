/**
 * Home Insurance Types
 *
 * TypeScript interfaces for Home Insurance features in the Email Infrastructure Dashboard
 * Created: 2025-10-27
 */

/**
 * Home Insurance Client from client_registry table
 */
export interface HomeInsuranceClient {
  workspace_id: number;
  workspace_name: string;
  display_name: string | null;
  is_active: boolean;
  client_type: 'home_insurance' | 'other';
  lead_tier: string | null;
  sending_tier: string | null;
  is_agency: boolean | null;
  created_at: string;
  updated_at: string;
}

/**
 * Aggregate statistics for Home Insurance accounts
 */
export interface HomeInsuranceStats {
  totalAccounts: number;
  totalClients: number;
  totalSent: number;
  totalReplies: number;
  totalBounces: number;
  avgReplyRate: number;
  avgBounceRate: number;
  disconnectedCount: number;
  connectedCount: number;
  failedCount: number;
  healthScore: number;
}

/**
 * Home Insurance Email Account (extends base email account with client info)
 */
export interface HomeInsuranceEmailAccount {
  id: string;
  bison_account_id: number;
  email_address: string;
  workspace_name: string;
  workspace_id: number;
  bison_instance: string;
  status: string;
  account_type: string | null;
  emails_sent_count: number;
  total_replied_count: number;
  unique_replied_count: number;
  bounced_count: number;
  unsubscribed_count: number;
  interested_leads_count: number;
  total_opened_count: number;
  unique_opened_count: number;
  total_leads_contacted_count: number;
  daily_limit: number;
  warmup_enabled: boolean;
  reply_rate_percentage: number;
  email_provider: string | null;
  reseller: string | null;
  domain: string | null;
  price: number;
  price_source: string | null;
  pricing_needs_review: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_synced_at: string;
  // Client info from join
  client_type: 'home_insurance' | 'other';
  client_display_name: string | null;
  client_is_active: boolean;
  lead_tier: string | null;
  sending_tier: string | null;
}

/**
 * Client type update payload
 */
export interface ClientTypeUpdate {
  workspace_name: string;
  client_type: 'home_insurance' | 'other';
}

/**
 * Performance metrics for a single client
 */
export interface ClientPerformanceMetrics {
  workspace_name: string;
  display_name: string | null;
  accountCount: number;
  totalSent: number;
  totalReplies: number;
  replyRate: number;
  totalBounces: number;
  bounceRate: number;
  avgBounceRatePerAccount: number;
  connectedCount: number;
  disconnectedCount: number;
  failedCount: number;
}

/**
 * Problem account identification
 */
export interface ProblemAccount {
  email_address: string;
  workspace_name: string;
  issue: 'disconnected' | 'high_bounce' | 'zero_replies' | 'low_reply_rate';
  severity: 'critical' | 'warning';
  details: string;
  emailsSent: number;
  bounceRate?: number;
  replyRate?: number;
}

/**
 * Filter state for Home Insurance tab
 */
export interface HomeInsuranceFilters {
  selectedClient: string | null; // null = all clients
  showOnlyIssues: boolean;
  minSent: number;
  statusFilter: string[]; // ['Connected', 'Disconnected', 'Failed']
  resellerFilter: string[];
  espFilter: string[];
}
