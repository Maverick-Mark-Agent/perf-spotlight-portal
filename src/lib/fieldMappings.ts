/**
 * Field Mappings: Edge Functions → Database Tables
 *
 * This file maps the field names returned by Edge Functions to the actual
 * database column names in Supabase tables. This ensures we can migrate
 * from Edge Functions to direct database queries without breaking the frontend.
 *
 * @file src/lib/fieldMappings.ts
 * @created 2025-10-09
 */

// ============= KPI Dashboard Mappings =============

/**
 * Maps KPI Dashboard field names to database columns
 *
 * Frontend expects: KPIClient interface (from dataValidation.ts)
 * Database source: client_metrics + client_registry (JOIN)
 */
export const KPI_FIELD_MAP = {
  // Edge Function field → Database column
  'leadsGenerated': 'positive_replies_mtd',
  'projectedReplies': 'projection_positive_replies_eom',
  'leadsTarget': 'positive_replies_mtd', // compared against monthlyKPI
  'repliesTarget': 'projection_positive_replies_eom', // compared against monthlyKPI
  'monthlyKPI': 'monthly_kpi_target', // from client_registry
  'currentProgress': 'mtd_leads_progress',
  'repliesProgress': 'projection_replies_progress',
  'positiveRepliesLast30Days': 'positive_replies_last_30_days',
  'positiveRepliesLast7Days': 'positive_replies_last_7_days',
  'positiveRepliesLast14Days': 'positive_replies_last_14_days',
  'positiveRepliesCurrentMonth': 'positive_replies_current_month',
  'positiveRepliesLastMonth': 'positive_replies_last_month',
  'lastWeekVsWeekBeforeProgress': 'last_week_vs_week_before_progress',
  'positiveRepliesLastVsThisMonth': null, // Calculated: (current - last) / last * 100
} as const;

/**
 * Transform database row to KPIClient interface
 */
export function transformToKPIClient(dbRow: any): any {
  return {
    id: dbRow.workspace_name,
    name: dbRow.client_registry?.display_name || dbRow.workspace_name,
    leadsGenerated: dbRow.positive_replies_mtd || 0,
    projectedReplies: dbRow.projection_positive_replies_eom || 0,
    leadsTarget: dbRow.client_registry?.monthly_kpi_target || 0,
    repliesTarget: dbRow.client_registry?.monthly_kpi_target || 0,
    monthlyKPI: dbRow.client_registry?.monthly_kpi_target || 0,
    currentProgress: (dbRow.mtd_leads_progress || 0) / 100, // Convert percentage to decimal (0-1)
    repliesProgress: (dbRow.projection_replies_progress || 0) / 100, // Convert percentage to decimal (0-1)
    positiveRepliesLast30Days: dbRow.positive_replies_last_30_days || 0,
    positiveRepliesLast7Days: dbRow.positive_replies_last_7_days || 0,
    positiveRepliesLast14Days: dbRow.positive_replies_last_14_days || 0,
    positiveRepliesCurrentMonth: dbRow.positive_replies_current_month || 0,
    positiveRepliesLastMonth: dbRow.positive_replies_last_month || 0,
    lastWeekVsWeekBeforeProgress: dbRow.last_week_vs_week_before_progress || 0,
    positiveRepliesLastVsThisMonth:
      dbRow.positive_replies_last_month > 0
        ? ((dbRow.positive_replies_current_month - dbRow.positive_replies_last_month) /
           dbRow.positive_replies_last_month * 100)
        : 0,
  };
}

// ============= Volume Dashboard Mappings =============

/**
 * Maps Volume Dashboard field names to database columns
 *
 * Frontend expects: VolumeClient interface
 * Database source: client_metrics + client_registry (JOIN)
 */
export const VOLUME_FIELD_MAP = {
  'name': 'workspace_name',
  'emails': 'emails_sent_mtd',
  'emailsToday': null, // Need to calculate from today's data
  'emailsLast7Days': 'emails_sent', // Need to sum last 7 days
  'emailsLast14Days': 'emails_sent', // Need to sum last 14 days
  'emailsLast30Days': 'emails_sent', // Need to sum last 30 days
  'target': 'monthly_sending_target', // from client_registry
  'projection': 'projection_emails_eom',
  'targetPercentage': null, // Calculated: (emails / target) * 100
  'projectedPercentage': null, // Calculated: (projection / target) * 100
  'isAboveTarget': null, // Calculated: emails >= target
  'isProjectedAboveTarget': null, // Calculated: projection >= target
  'variance': null, // Calculated: emails - target
  'projectedVariance': null, // Calculated: projection - target
  'dailyQuota': null, // Calculated: target / days_in_month
  'expectedByNow': null, // Calculated: dailyQuota * days_elapsed
  'isOnTrack': null, // Calculated: emails >= expectedByNow
  'dailyAverage': null, // Calculated: emails / days_elapsed
  'distanceToTarget': null, // Calculated: Math.abs(emails - target)
  'rank': null, // Calculated after sorting
} as const;

/**
 * Transform database row to VolumeClient interface
 */
export function transformToVolumeClient(dbRow: any, rank: number, daysInMonth: number, daysElapsed: number): any {
  const emails = dbRow.emails_sent_mtd || 0;
  const target = dbRow.client_registry?.monthly_sending_target || 0;
  const projection = dbRow.projection_emails_eom || 0;
  const dailySendingTarget = dbRow.client_registry?.daily_sending_target || 0;

  const dailyQuota = target / daysInMonth;
  const expectedByNow = dailyQuota * daysElapsed;
  const dailyAverage = emails / daysElapsed;

  return {
    name: dbRow.client_registry?.display_name || dbRow.workspace_name,
    emails,
    emailsToday: dbRow.emails_scheduled_today || 0, // Scheduled emails for today
    emailsLast7Days: dbRow.emails_sent_last_7_days || 0,
    emailsLast14Days: dbRow.emails_sent_last_14_days || 0,
    emailsLast30Days: dbRow.emails_sent_last_30_days || 0,
    target,
    projection,
    targetPercentage: target > 0 ? (emails / target) * 100 : 0,
    projectedPercentage: target > 0 ? (projection / target) * 100 : 0,
    isAboveTarget: emails >= target,
    isProjectedAboveTarget: projection >= target,
    variance: emails - target,
    projectedVariance: projection - target,
    dailyQuota,
    dailySendingTarget,
    expectedByNow,
    isOnTrack: emails >= expectedByNow,
    dailyAverage,
    distanceToTarget: Math.abs(emails - target),
    rank,
  };
}

// ============= Email Infrastructure Mappings =============

/**
 * Maps Email Infrastructure field names to database columns
 *
 * Frontend expects: EmailAccount interface with nested fields object
 * Database source: sender_emails_cache
 */
export const EMAIL_ACCOUNT_FIELD_MAP = {
  'Email': 'email_address',
  'Name': 'account_name',
  'Status': 'status',
  'Total Sent': 'emails_sent_count',
  'Total Replied': 'total_replied_count',
  'Unique Replied': 'unique_replied_count',
  'Bounced': 'bounced_count',
  'Unsubscribed': 'unsubscribed_count',
  'Interested Leads': 'interested_leads_count',
  'Tag - Email Provider': 'email_provider',
  'Tag - Reseller': 'reseller',
  'Client Name (from Client)': 'workspace_name',
  'Daily Limit': 'daily_limit',
  'Domain': 'domain',
  'Price': 'price',
  'Bison Instance': 'bison_instance',
  'Reply Rate Per Account %': 'reply_rate_percentage',
} as const;

/**
 * Transform database row to EmailAccount interface
 *
 * Frontend expects nested structure:
 * {
 *   id: string,
 *   fields: {
 *     'Email': 'test@example.com',
 *     'Status': 'active',
 *     ...
 *   }
 * }
 */
export function transformToEmailAccount(dbRow: any): any {
  return {
    id: dbRow.id,
    email: dbRow.email_address, // For convenience
    workspace_name: dbRow.workspace_name, // For filtering
    status: dbRow.status, // For filtering
    provider: dbRow.email_provider || undefined, // Convert null to undefined for Zod validation
    fields: {
      'Email': dbRow.email_address,
      'Name': dbRow.account_name || '',
      'Status': dbRow.status,
      'Total Sent': dbRow.emails_sent_count || 0,
      'Total Replied': dbRow.total_replied_count || 0,
      'Unique Replied': dbRow.unique_replied_count || 0,
      'Bounced': dbRow.bounced_count || 0,
      'Unsubscribed': dbRow.unsubscribed_count || 0,
      'Interested Leads': dbRow.interested_leads_count || 0,
      'Tag - Email Provider': dbRow.email_provider || '',
      'Tag - Reseller': dbRow.reseller || '',
      'Client': [dbRow.workspace_name], // CRITICAL: UI expects 'Client' field as array
      'Client Name (from Client)': [dbRow.workspace_name], // Array for compatibility
      'Daily Limit': dbRow.daily_limit || 0,
      'Domain': dbRow.domain || '',
      'Price': dbRow.price || 0,
      'Bison Instance': dbRow.bison_instance || 'maverick',
      'Reply Rate Per Account %': dbRow.reply_rate_percentage || 0,
      'Volume Per Account': dbRow.volume_per_account || 0,
      'Account Type': dbRow.account_type || '',
    },
  };
}

// ============= Client Portal Mappings =============

/**
 * Client Portal already queries client_leads directly
 * No transformation needed - fields match 1:1
 */
export const CLIENT_PORTAL_FIELD_MAP = {
  'lead_email': 'lead_email',
  'workspace_name': 'workspace_name',
  'interested': 'interested',
  'conversation_url': 'conversation_url',
  'pipeline_stage': 'pipeline_stage',
  'date_received': 'date_received',
  'lead_name': 'lead_name',
  'lead_company': 'lead_company',
  'notes': 'notes',
} as const;

// ============= Helper Functions =============

/**
 * Calculate current date information for dashboard queries
 */
export function getCurrentDateInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // Get days in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Get days elapsed (including today)
  const daysElapsed = now.getDate();

  // Get first and last day of month
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Get date strings
  const todayStr = now.toISOString().split('T')[0];
  const firstDayStr = firstDayOfMonth.toISOString().split('T')[0];
  const lastDayStr = lastDayOfMonth.toISOString().split('T')[0];

  return {
    now,
    year,
    month: month + 1, // 1-indexed for display
    daysInMonth,
    daysElapsed,
    todayStr,
    firstDayStr,
    lastDayStr,
  };
}

/**
 * Calculate MTD (Month-To-Date) date range
 */
export function getMTDDateRange() {
  const { firstDayStr, todayStr } = getCurrentDateInfo();
  return { startDate: firstDayStr, endDate: todayStr };
}

/**
 * Calculate last N days date range
 */
export function getLastNDaysRange(days: number) {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0],
  };
}
