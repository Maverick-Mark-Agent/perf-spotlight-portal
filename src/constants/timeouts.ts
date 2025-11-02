/**
 * Timeout Configuration Constants
 * 
 * Centralized timeout values for consistent behavior across the app.
 * All values in milliseconds.
 * 
 * Standardization Strategy:
 * - Short operations: 5-10 seconds
 * - Medium operations: 15-30 seconds
 * - Long operations: 60-180 seconds
 * - Very long operations: 30-60 minutes
 * 
 * @file src/constants/timeouts.ts
 */

// ============= API Request Timeouts =============

export const API_TIMEOUTS = {
  /** Standard API request timeout - 30 seconds */
  DEFAULT: 30_000,
  
  /** Short API request timeout - 10 seconds */
  SHORT: 10_000,
  
  /** Extended timeout for large dataset queries - 3 minutes */
  LARGE_DATASET: 180_000,
  
  /** Quick health check or ping - 5 seconds */
  HEALTH_CHECK: 5_000,
} as const;

// ============= Browser Automation Timeouts =============

export const BROWSER_TIMEOUTS = {
  /** Default browser operation timeout - 30 seconds */
  DEFAULT: 30_000,
  
  /** Login/authentication operations - 15 seconds */
  LOGIN: 15_000,
  
  /** Waiting for selector to appear - 10 seconds */
  SELECTOR_WAIT: 10_000,
  
  /** Waiting for success indicator - 5 seconds */
  SUCCESS_INDICATOR: 5_000,
  
  /** Waiting for result count after search - 30 seconds */
  RESULT_COUNT: 30_000,
  
  /** Waiting for file upload import completion - 60 seconds */
  IMPORT_COMPLETE: 60_000,
} as const;

// ============= Data Processing Timeouts =============

export const DATA_TIMEOUTS = {
  /** Clay enrichment completion - 1 hour */
  ENRICHMENT_COMPLETE: 3_600_000,
  
  /** Enrichment status check interval - 30 seconds */
  ENRICHMENT_CHECK_INTERVAL: 30_000,
  
  /** Data validation timeout - 5 seconds */
  VALIDATION: 5_000,
} as const;

// ============= UI Interaction Delays =============

/**
 * Delays for UI interactions and wait operations
 * Use these for page.waitForTimeout() calls
 */
export const UI_DELAYS = {
  /** Very short delay - 500ms */
  VERY_SHORT: 500,
  
  /** Short delay - 1 second */
  SHORT: 1_000,
  
  /** Medium delay - 2 seconds */
  MEDIUM: 2_000,
  
  /** Long delay - 3 seconds */
  LONG: 3_000,
  
  /** AI generation wait time - 3 seconds */
  AI_GENERATION: 3_000,
} as const;

// ============= Toast & Notification Timeouts =============

export const TOAST_TIMEOUTS = {
  /** Toast visibility duration - extended for readability */
  REMOVE_DELAY: 1_000_000,
  
  /** Maximum number of toasts to show */
  LIMIT: 1,
} as const;

// ============= Cache & Refresh Intervals =============

export const CACHE_INTERVALS = {
  /** Minimum time between manual refreshes - 30 seconds */
  MIN_REFRESH: 30_000,
  
  /** Update check interval - 100ms */
  UPDATE_CHECK: 100,
} as const;

// ============= Cookie Expiration =============

export const COOKIE_EXPIRATION = {
  /** Sidebar state cookie - 7 days */
  SIDEBAR_STATE: 60 * 60 * 24 * 7,
} as const;

// ============= Helper Functions =============

/**
 * Create a timeout promise that rejects after specified milliseconds
 * Useful for Promise.race() scenarios
 */
export const createTimeoutPromise = (ms: number, message = 'Operation timeout') => {
  return new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(message)), ms)
  );
};

/**
 * Sleep/delay utility
 * @param ms - Milliseconds to sleep
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// ============= Timeout Mapping Guide =============

/**
 * STANDARDIZATION NOTES:
 * 
 * Old inconsistent values found and their new mappings:
 * 
 * Browser Operations:
 * - { timeout: 10000 } → BROWSER_TIMEOUTS.SELECTOR_WAIT (10s)
 * - { timeout: 15000 } → BROWSER_TIMEOUTS.LOGIN (15s)
 * - { timeout: 5000 } → BROWSER_TIMEOUTS.SUCCESS_INDICATOR (5s)
 * - { timeout: 30000 } → BROWSER_TIMEOUTS.DEFAULT or BROWSER_TIMEOUTS.RESULT_COUNT (30s)
 * - timeout: 60000 → BROWSER_TIMEOUTS.IMPORT_COMPLETE (60s)
 * 
 * API Requests:
 * - REQUEST_TIMEOUT = 180000 → API_TIMEOUTS.LARGE_DATASET (180s)
 * - timeout: 30000 → API_TIMEOUTS.DEFAULT (30s)
 * 
 * Wait/Delay Operations:
 * - waitForTimeout(500) → UI_DELAYS.VERY_SHORT
 * - waitForTimeout(1000) → UI_DELAYS.SHORT
 * - waitForTimeout(2000) → UI_DELAYS.MEDIUM
 * - waitForTimeout(3000) → UI_DELAYS.LONG or UI_DELAYS.AI_GENERATION
 * - waitForTimeout(30000) → DATA_TIMEOUTS.ENRICHMENT_CHECK_INTERVAL
 * 
 * Data Processing:
 * - timeoutMs = 3600000 → DATA_TIMEOUTS.ENRICHMENT_COMPLETE (1 hour)
 */
