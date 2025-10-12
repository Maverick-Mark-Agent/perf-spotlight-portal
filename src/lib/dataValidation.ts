import { z } from 'zod';

// ============= Validation Schemas =============

/**
 * KPI Client Data Schema
 * Validates data from hybrid-workspace-analytics Edge Function
 */
export const KPIClientSchema = z.object({
  id: z.string().min(1, "Client ID is required"),
  name: z.string().min(1, "Client name is required"),
  leadsGenerated: z.number().int().nonnegative(),
  projectedReplies: z.number().int().nonnegative(),
  leadsTarget: z.number().int().nonnegative(),
  repliesTarget: z.number().int().nonnegative(),
  monthlyKPI: z.number().int().nonnegative(),
  currentProgress: z.number().min(0).max(10), // Allow >100% progress
  repliesProgress: z.number().min(0).max(10),
  positiveRepliesLast30Days: z.number().int().nonnegative(),
  positiveRepliesLast7Days: z.number().int().nonnegative(),
  positiveRepliesLast14Days: z.number().int().nonnegative(),
  positiveRepliesCurrentMonth: z.number().int().nonnegative(),
  positiveRepliesLastMonth: z.number().int().nonnegative(),
  lastWeekVsWeekBeforeProgress: z.number(),
  positiveRepliesLastVsThisMonth: z.number(),
});

/**
 * Volume Client Data Schema
 * Validates data from volume-dashboard-data Edge Function
 */
export const VolumeClientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  emails: z.number().int().nonnegative(),
  emailsToday: z.number().int().nonnegative(),
  emailsLast7Days: z.number().int().nonnegative(),
  emailsLast14Days: z.number().int().nonnegative(),
  emailsLast30Days: z.number().int().nonnegative(),
  target: z.number().int().nonnegative(),
  projection: z.number().int().nonnegative(),
  targetPercentage: z.number().nonnegative(),
  projectedPercentage: z.number().nonnegative(),
  isAboveTarget: z.boolean(),
  isProjectedAboveTarget: z.boolean(),
  variance: z.number(),
  projectedVariance: z.number(),
  dailyQuota: z.number().nonnegative(),
  expectedByNow: z.number().nonnegative(),
  isOnTrack: z.boolean(),
  dailyAverage: z.number().nonnegative(),
  distanceToTarget: z.number().nonnegative(),
  rank: z.number().int().positive(),
});

/**
 * Revenue Client Data Schema (MTD-focused)
 * Validates data from revenue-billing-unified Edge Function
 */
export const RevenueClientSchema = z.object({
  workspace_name: z.string().min(1, "Workspace name is required"),
  billing_type: z.enum(['per_lead', 'retainer']),
  // MTD Metrics
  current_month_leads: z.number().int().nonnegative(),
  current_month_revenue: z.number().nonnegative(),
  current_month_costs: z.number().nonnegative(),
  current_month_profit: z.number(),
  // Profitability
  profit_margin: z.number(),
  price_per_lead: z.number().nonnegative().nullable(),
  retainer_amount: z.number().nonnegative().nullable(),
  // KPI Metrics
  monthly_kpi: z.number().nonnegative(),
  kpi_progress: z.number(),
  leads_remaining: z.number().int().nonnegative(),
  // Email Performance Metrics
  emails_sent_mtd: z.number().int().nonnegative(),
  replies_mtd: z.number().int().nonnegative(),
  interested_mtd: z.number().int().nonnegative(),
  bounces_mtd: z.number().int().nonnegative(),
  unsubscribes_mtd: z.number().int().nonnegative(),
  reply_rate: z.number(),
  interested_rate: z.number(),
  rank: z.number().int().positive().optional(),
});

/**
 * Email Account Data Schema
 * Validates data from hybrid-email-accounts-v2 Edge Function
 */
export const EmailAccountSchema = z.object({
  email: z.string().email("Invalid email format"),
  workspace_name: z.string().min(1, "Workspace name is required"),
  status: z.string().min(1, "Status is required"),
  provider: z.string().optional(),
  warmup_enabled: z.boolean().optional(),
  daily_limit: z.number().int().nonnegative().optional(),
  // Additional fields are optional as they vary by account
}).passthrough(); // Allow additional fields

// ============= Array Schemas =============

export const KPIClientsArraySchema = z.array(KPIClientSchema);
export const VolumeClientsArraySchema = z.array(VolumeClientSchema);
export const RevenueClientsArraySchema = z.array(RevenueClientSchema);
export const EmailAccountsArraySchema = z.array(EmailAccountSchema);

// ============= Type Exports =============

export type KPIClient = z.infer<typeof KPIClientSchema>;
export type VolumeClient = z.infer<typeof VolumeClientSchema>;
export type RevenueClient = z.infer<typeof RevenueClientSchema>;
export type EmailAccount = z.infer<typeof EmailAccountSchema>;

// ============= Validation Results =============

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: {
    field: string;
    message: string;
    value: any;
  }[];
  warnings?: string[];
}

// ============= Validation Functions =============

/**
 * Validates KPI client data with detailed error reporting
 */
export function validateKPIClients(data: unknown): ValidationResult<KPIClient[]> {
  try {
    const result = KPIClientsArraySchema.safeParse(data);

    if (result.success) {
      // Check for warnings (valid but suspicious data)
      const warnings: string[] = [];
      result.data.forEach((client, index) => {
        if (client.monthlyKPI === 0) {
          warnings.push(`Client "${client.name}" has no KPI target set`);
        }
        if (client.leadsGenerated > 1000) {
          warnings.push(`Client "${client.name}" has unusually high leads: ${client.leadsGenerated}`);
        }
      });

      return {
        success: true,
        data: result.data,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    // Parse validation errors
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      value: issue.code,
    }));

    return {
      success: false,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      errors: [{
        field: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown validation error',
        value: null,
      }],
    };
  }
}

/**
 * Validates Volume client data with detailed error reporting
 */
export function validateVolumeClients(data: unknown): ValidationResult<VolumeClient[]> {
  try {
    const result = VolumeClientsArraySchema.safeParse(data);

    if (result.success) {
      const warnings: string[] = [];
      result.data.forEach(client => {
        if (client.emails === 0 && client.target > 0) {
          warnings.push(`Client "${client.name}" has zero emails sent but has a target`);
        }
        if (client.targetPercentage > 200) {
          warnings.push(`Client "${client.name}" is at ${client.targetPercentage.toFixed(0)}% of target`);
        }
      });

      return {
        success: true,
        data: result.data,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      value: issue.code,
    }));

    return {
      success: false,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      errors: [{
        field: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown validation error',
        value: null,
      }],
    };
  }
}

/**
 * Validates Revenue client data with detailed error reporting
 */
export function validateRevenueClients(data: unknown): ValidationResult<RevenueClient[]> {
  try {
    const result = RevenueClientsArraySchema.safeParse(data);

    if (result.success) {
      const warnings: string[] = [];
      result.data.forEach(client => {
        if (client.profit_margin < 0) {
          warnings.push(`Client "${client.workspace_name}" has negative profit margin: ${client.profit_margin.toFixed(1)}%`);
        }
        if (client.profit_margin < 20 && client.profit_margin > 0) {
          warnings.push(`Client "${client.workspace_name}" has low profit margin: ${client.profit_margin.toFixed(1)}%`);
        }
      });

      return {
        success: true,
        data: result.data,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      value: issue.code,
    }));

    return {
      success: false,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      errors: [{
        field: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown validation error',
        value: null,
      }],
    };
  }
}

/**
 * Validates Email Account data with detailed error reporting
 */
export function validateEmailAccounts(data: unknown): ValidationResult<EmailAccount[]> {
  try {
    const result = EmailAccountsArraySchema.safeParse(data);

    if (result.success) {
      const warnings: string[] = [];
      result.data.forEach(account => {
        if (account.status === 'error' || account.status === 'disabled') {
          warnings.push(`Email account "${account.email}" has status: ${account.status}`);
        }
      });

      return {
        success: true,
        data: result.data,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      value: issue.code,
    }));

    return {
      success: false,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      errors: [{
        field: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown validation error',
        value: null,
      }],
    };
  }
}

/**
 * Generic validator for any data with custom schema
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): ValidationResult<T> {
  try {
    const result = schema.safeParse(data);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: `${context ? `[${context}] ` : ''}${issue.message}`,
      value: issue.code,
    }));

    return {
      success: false,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      errors: [{
        field: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown validation error',
        value: null,
      }],
    };
  }
}

/**
 * Log validation errors to console and optionally to Supabase
 */
export function logValidationErrors(
  source: string,
  errors: ValidationResult<any>['errors'],
  logToSupabase: boolean = false
): void {
  if (!errors || errors.length === 0) return;

  console.error(`[Data Validation Error] Source: ${source}`);
  errors.forEach(error => {
    console.error(`  - Field: ${error.field}, Message: ${error.message}`);
  });

  // TODO: Phase 2 - Log to Supabase data_validation_errors table
  if (logToSupabase) {
    // Will be implemented in Phase 2
  }
}
