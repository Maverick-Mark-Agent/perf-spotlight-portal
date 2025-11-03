/**
 * Pipeline & Status Constants
 * 
 * Lead pipeline stages and status definitions with colors.
 * 
 * @file src/constants/pipeline.ts
 */

// ============= Pipeline Stages =============

/**
 * Lead pipeline stages with labels and color styling
 */
export const PIPELINE_STAGES = [
  { 
    key: 'interested', 
    label: 'Interested', 
    color: 'bg-pink-500/20 border-pink-500/40' 
  },
  { 
    key: 'quoting', 
    label: 'Quoting', 
    color: 'bg-purple-500/20 border-purple-500/40' 
  },
  { 
    key: 'follow-up', 
    label: 'Follow Up', 
    color: 'bg-yellow-500/20 border-yellow-500/40' 
  },
  { 
    key: 'won', 
    label: 'Won', 
    color: 'bg-green-500/20 border-green-500/40' 
  },
  { 
    key: 'lost', 
    label: 'Lost', 
    color: 'bg-red-500/20 border-red-500/40' 
  },
] as const;

// ============= Email Account Status =============

/**
 * Possible email account connection statuses
 */
export const EMAIL_ACCOUNT_STATUS = {
  CONNECTED: 'Connected',
  DISCONNECTED: 'Disconnected',
  NOT_CONNECTED: 'Not connected',
  FAILED: 'Failed',
} as const;

export type EmailAccountStatus = typeof EMAIL_ACCOUNT_STATUS[keyof typeof EMAIL_ACCOUNT_STATUS];

// ============= API Health Status =============

/**
 * API health status values for workspace integrations
 */
export const API_HEALTH_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  FAILING: 'failing',
  NO_KEY: 'no_key',
} as const;

export type ApiHealthStatus = typeof API_HEALTH_STATUS[keyof typeof API_HEALTH_STATUS];

// ============= API Key Status =============

/**
 * Status values for Bison API keys
 */
export const API_KEY_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  EXPIRED: 'expired',
} as const;

export type ApiKeyStatus = typeof API_KEY_STATUS[keyof typeof API_KEY_STATUS];

// ============= Upload/Batch Status =============

/**
 * CSV upload and batch processing status values
 */
export const UPLOAD_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

// ============= Rollout Phase Status =============

/**
 * Phase status for rollout progress tracking
 */
export const PHASE_STATUS = {
  COMPLETED: 'completed',
  IN_PROGRESS: 'in_progress',
  PENDING: 'pending',
} as const;

export type PhaseStatus = typeof PHASE_STATUS[keyof typeof PHASE_STATUS];

// ============= Rollout Milestones =============

/**
 * Milestone categories for rollout phases
 */
export const ROLLOUT_MILESTONES = [
  'Foundation',
  'Data Pipeline',
  'Workflow Automation',
  'Production Readiness',
] as const;

export type RolloutMilestone = typeof ROLLOUT_MILESTONES[number];
