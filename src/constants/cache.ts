/**
 * Cache Configuration Constants
 * 
 * All cache durations (TTL) and cache keys used throughout the application.
 * 
 * @file src/constants/cache.ts
 */

// ============= Cache Durations (TTL) =============

/**
 * Time-to-Live (TTL) values for different data types
 * All values in milliseconds
 */
export const CACHE_TTL = {
  /** KPI dashboard data - 2 minutes (high-priority data) */
  KPI: 2 * 60 * 1000,
  
  /** Volume dashboard data - 30 seconds (real-time updates) */
  VOLUME: 30 * 1000,
  
  /** Revenue data - 10 seconds (very fresh data needed) */
  REVENUE: 10 * 1000,
  
  /** Infrastructure/email accounts - 10 minutes (less frequently changing) */
  INFRASTRUCTURE: 10 * 60 * 1000,
  
  /** General dashboard cache - 2 minutes */
  DASHBOARD: 2 * 60 * 1000,
} as const;

// ============= Cache Keys =============

/**
 * Standardized cache key names for localStorage and other storage mechanisms
 */
export const CACHE_KEYS = {
  // KPI Dashboard
  KPI_DATA: 'kpi-dashboard-data',
  KPI_TIMESTAMP: 'kpi-dashboard-timestamp',
  KPI_SELECTED_CLIENT: 'kpi-selected-client',
  KPI_VIEW_MODE: 'kpi-view-mode',
  
  // Volume Dashboard
  VOLUME_DATA: 'volume-dashboard-data',
  VOLUME_TIMESTAMP: 'volume-dashboard-timestamp',
  
  // Revenue Dashboard
  REVENUE_DATA: 'revenue-dashboard-data',
  REVENUE_TIMESTAMP: 'revenue-dashboard-timestamp',
  
  // Infrastructure
  INFRASTRUCTURE_DATA: 'infrastructure-dashboard-data',
  INFRASTRUCTURE_TIMESTAMP: 'infrastructure-dashboard-timestamp',
} as const;

// ============= Retry Configuration =============

/**
 * Configuration for retry logic with exponential backoff
 */
export const RETRY_CONFIG = {
  /** Maximum number of retry attempts */
  maxRetries: 3,
  
  /** Initial delay before first retry - 1 second */
  initialDelayMs: 1000,
  
  /** Exponential backoff multiplier */
  backoffMultiplier: 2,
  
  /** Maximum delay between retries - 10 seconds */
  maxDelayMs: 10000,
} as const;

// ============= Feature Flags =============

/**
 * Feature flags for real-time data migration
 * Set to false to rollback to Edge Functions
 */
export const FEATURE_FLAGS = {
  /** Use real-time infrastructure data from sender_emails_cache (1-2s vs 30-60s) */
  useRealtimeInfrastructure: true,
  
  /** Use real-time KPI data (5-10s → <500ms) */
  useRealtimeKPI: true,
  
  /** Use real-time volume data (3-5s → <300ms) */
  useRealtimeVolume: true,
} as const;
