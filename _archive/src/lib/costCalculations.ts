/**
 * Cost Calculation Utilities
 *
 * Provides reusable functions for calculating client costs from infrastructure data.
 * Used by both backend Edge Functions and frontend components.
 *
 * @file src/lib/costCalculations.ts
 * @created 2025-10-14
 */

export interface EmailAccount {
  workspace_name: string;
  status: string;
  price: number;
}

export interface ClientCostBreakdown {
  workspace_name: string;
  month_year: string;
  email_account_costs: number;
  labor_costs: number;
  other_costs: number;
  total_costs: number;
  cost_source: 'manual' | 'calculated';
  calculation_details?: {
    account_count: number;
    connected_account_count: number;
    mtd_leads: number;
    labor_formula: string;
  };
}

/**
 * Estimate labor costs based on account count and MTD leads
 *
 * Formula:
 * - Base: $10 per email account per month (account management)
 * - Lead management: $5 per billable lead (processing, follow-up)
 * - Minimum: $200/month (baseline support cost)
 *
 * @param accountCount - Total number of email accounts for client
 * @param mtdLeads - Month-to-date billable leads generated
 * @returns Estimated monthly labor cost
 */
export function estimateLaborCosts(accountCount: number, mtdLeads: number): number {
  // Base labor: $10 per email account per month
  const accountLabor = accountCount * 10;

  // Lead management: $5 per lead
  const leadLabor = mtdLeads * 5;

  // Minimum labor cost: $200/month (even for small clients)
  return Math.max(200, accountLabor + leadLabor);
}

/**
 * Calculate total email account costs from infrastructure data
 *
 * Sums up the price of all connected email accounts for a client.
 * Only counts accounts with 'Connected' status.
 *
 * @param emailAccounts - Array of email account records
 * @param workspaceName - Client workspace name to filter by
 * @returns Total monthly email account costs
 */
export function calculateEmailAccountCosts(
  emailAccounts: EmailAccount[],
  workspaceName: string
): number {
  return emailAccounts
    .filter(acc =>
      acc.workspace_name === workspaceName &&
      acc.status === 'Connected'
    )
    .reduce((sum, acc) => sum + (acc.price || 0), 0);
}

/**
 * Calculate other fixed costs per client
 *
 * Includes:
 * - Software/tools overhead: $25/month
 * - Future: Could add domain costs, API fees, etc.
 *
 * @returns Fixed monthly other costs
 */
export function calculateOtherCosts(): number {
  // Fixed overhead for tools/software per client
  return 25;
}

/**
 * Calculate complete cost breakdown for a client
 *
 * Combines email account costs, labor costs, and other costs.
 * Provides full breakdown for transparency.
 *
 * @param workspaceName - Client workspace name
 * @param monthYear - Month in YYYY-MM format
 * @param emailAccounts - Array of email account records
 * @param mtdLeads - Month-to-date billable leads
 * @returns Complete cost breakdown
 */
export function calculateClientCosts(
  workspaceName: string,
  monthYear: string,
  emailAccounts: EmailAccount[],
  mtdLeads: number
): ClientCostBreakdown {
  // Calculate email account costs
  const emailCosts = calculateEmailAccountCosts(emailAccounts, workspaceName);

  // Count accounts for labor estimation
  const accountCount = emailAccounts.filter(
    acc => acc.workspace_name === workspaceName
  ).length;
  const connectedCount = emailAccounts.filter(
    acc => acc.workspace_name === workspaceName && acc.status === 'Connected'
  ).length;

  // Calculate labor costs
  const laborCosts = estimateLaborCosts(accountCount, mtdLeads);

  // Calculate other costs
  const otherCosts = calculateOtherCosts();

  // Total costs
  const totalCosts = emailCosts + laborCosts + otherCosts;

  return {
    workspace_name: workspaceName,
    month_year: monthYear,
    email_account_costs: emailCosts,
    labor_costs: laborCosts,
    other_costs: otherCosts,
    total_costs: totalCosts,
    cost_source: 'calculated',
    calculation_details: {
      account_count: accountCount,
      connected_account_count: connectedCount,
      mtd_leads: mtdLeads,
      labor_formula: `max(200, ${accountCount} accounts × $10 + ${mtdLeads} leads × $5)`,
    },
  };
}

/**
 * Merge manual override costs with calculated costs
 *
 * If manual costs exist, use them (allows for overrides).
 * Otherwise, use calculated costs from infrastructure.
 *
 * @param manualCosts - Costs from client_costs table (if exists)
 * @param calculatedCosts - Costs calculated from infrastructure
 * @returns Final cost breakdown with source indicator
 */
export function mergeManualAndCalculatedCosts(
  manualCosts: ClientCostBreakdown | null,
  calculatedCosts: ClientCostBreakdown
): ClientCostBreakdown {
  if (manualCosts && manualCosts.total_costs > 0) {
    return {
      ...manualCosts,
      cost_source: 'manual',
    };
  }

  return calculatedCosts;
}

/**
 * Validate cost calculation results
 *
 * Ensures costs are within reasonable ranges.
 * Flags suspicious values for review.
 *
 * @param costs - Cost breakdown to validate
 * @returns Validation result with warnings
 */
export function validateCosts(costs: ClientCostBreakdown): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check for negative costs
  if (costs.email_account_costs < 0) {
    warnings.push('Email account costs cannot be negative');
  }
  if (costs.labor_costs < 0) {
    warnings.push('Labor costs cannot be negative');
  }
  if (costs.other_costs < 0) {
    warnings.push('Other costs cannot be negative');
  }

  // Check for unusually high costs
  if (costs.email_account_costs > 5000) {
    warnings.push('Email account costs are unusually high (>$5000/month)');
  }
  if (costs.labor_costs > 10000) {
    warnings.push('Labor costs are unusually high (>$10000/month)');
  }

  // Check for total costs being zero when it shouldn't be
  if (costs.total_costs === 0 && costs.cost_source === 'calculated') {
    warnings.push('Total costs are $0 - may indicate missing infrastructure data');
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
