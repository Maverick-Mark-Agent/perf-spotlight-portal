/**
 * Email Bison Integration Constants
 * 
 * Constants specific to Email Bison platform integration.
 * Note: API credentials are in src/constants/api.ts
 * 
 * @file src/constants/thirdParty/emailBison.ts
 */

// ============= Email Bison Workspace Types =============

/**
 * Bison instance/workspace type identifiers
 */
export const BISON_INSTANCES = {
  LONG_RUN: 'longrun',
  MAVERICK: 'maverick',
} as const;

export type BisonInstance = typeof BISON_INSTANCES[keyof typeof BISON_INSTANCES];

/**
 * Map display names to instance identifiers
 */
export const BISON_INSTANCE_MAP: Record<string, BisonInstance> = {
  'Long Run': BISON_INSTANCES.LONG_RUN,
  'Maverick': BISON_INSTANCES.MAVERICK,
} as const;

// ============= Email Account Limits =============

/**
 * Default sending limits for email accounts
 */
export const EMAIL_SENDING_LIMITS = {
  /** Maximum emails per day per account */
  MAX_EMAILS_PER_DAY: 50,
  
  /** Maximum new leads per day per account */
  MAX_NEW_LEADS_PER_DAY: 20,
} as const;

// ============= API Endpoints =============

/**
 * Email Bison API endpoint paths (append to base URL)
 */
export const BISON_ENDPOINTS = {
  WORKSPACES: '/workspaces',
  SENDER_EMAILS: '/sender-emails',
  CAMPAIGNS: '/campaigns',
  STATS: '/stats',
} as const;

// ============= Status Values =============

/**
 * Email Bison specific status values
 */
export const BISON_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  DRAFT: 'draft',
} as const;
