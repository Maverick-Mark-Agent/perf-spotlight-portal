/**
 * Pricing & Cost Calculation Constants
 * 
 * All business pricing rules and cost calculation constants.
 * 
 * @file src/constants/pricing.ts
 */

// ============= Labor Cost Constants =============

/**
 * Labor cost calculation constants
 * These values are used to estimate monthly labor costs per client
 */
export const LABOR_COSTS = {
  /** Cost per email account per month for account management */
  PER_ACCOUNT: 10,
  
  /** Cost per billable lead for processing and follow-up */
  PER_LEAD: 5,
  
  /** Minimum monthly labor cost (baseline support cost) */
  MINIMUM: 200,
} as const;

// ============= Email Account Pricing =============

/**
 * Email account pricing structure
 * Individual account prices may vary based on provider
 */
export const EMAIL_ACCOUNT_PRICING = {
  /** Standard email account monthly cost */
  STANDARD: 0, // Varies by account, calculated from infrastructure data
  
  /** Placeholder for future tiered pricing */
  PREMIUM: 0,
} as const;

// ============= Default Client Metrics =============

/**
 * Default values for client financial calculations
 */
export const DEFAULT_CLIENT_METRICS = {
  /** Default commission rate percentage */
  COMMISSION_RATE: 10,
  
  /** Default conversion rate percentage */
  CONVERSION_RATE: 20,
  
  /** Default average deal size in dollars */
  AVG_DEAL_SIZE: 5000,
  
  /** Default customer lifetime value in dollars */
  CUSTOMER_LTV: 10000,
  
  /** Default cost per lead in dollars */
  COST_PER_LEAD: 50,
  
  /** Default monthly operating costs */
  MONTHLY_OPERATING_COSTS: 2000,
} as const;

// ============= Cost Calculation Formulas =============

/**
 * Documentation of cost calculation formulas used in the system
 * 
 * Labor Costs Formula:
 * - Base: accountCount * LABOR_COSTS.PER_ACCOUNT
 * - Lead Processing: mtdLeads * LABOR_COSTS.PER_LEAD
 * - Total: Math.max(LABOR_COSTS.MINIMUM, base + leadProcessing)
 * 
 * Total Client Costs:
 * - Email Account Costs: Sum of all connected account prices
 * - Labor Costs: Calculated using formula above
 * - Other Costs: Additional overhead (TODO: define this better)
 * - Total: emailCosts + laborCosts + otherCosts
 */

// ============= Revenue Calculation Constants =============

/**
 * Default ROI calculation constants
 */
export const ROI_DEFAULTS = {
  /** Monthly leads for ROI calculation */
  MONTHLY_LEADS: 100,
  
  /** Cost per lead */
  COST_PER_LEAD: 50,
  
  /** Conversion rate percentage */
  CONVERSION_RATE: 20,
  
  /** Average deal size */
  AVG_DEAL_SIZE: 5000,
  
  /** Customer lifetime value */
  CUSTOMER_LTV: 10000,
  
  /** Monthly operating costs */
  MONTHLY_OPERATING_COSTS: 2000,
} as const;
