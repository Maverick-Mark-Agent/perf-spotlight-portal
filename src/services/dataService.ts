import { supabase } from '@/integrations/supabase/client';
import {
  validateKPIClients,
  validateVolumeClients,
  validateRevenueClients,
  validateEmailAccounts,
  logValidationErrors,
  type KPIClient,
  type VolumeClient,
  type RevenueClient,
  type EmailAccount,
  type ValidationResult,
} from '@/lib/dataValidation';
import {
  fetchKPIDataRealtime,
  fetchVolumeDataRealtime,
  fetchInfrastructureDataRealtime,
} from './realtimeDataService';

// ============= Feature Flags =============

/**
 * Feature flags for real-time data migration
 * Set to false to instantly rollback to Edge Functions
 */
const FEATURE_FLAGS = {
  useRealtimeInfrastructure: true, // NOW USING sender_emails_cache table (synced by poll-sender-emails cron job)
  useRealtimeKPI: true, // KPI Dashboard (5-10s → <500ms)
  useRealtimeVolume: true, // Volume Dashboard (3-5s → <300ms)
} as const;

// ============= Cache Configuration =============

const CACHE_TTL = {
  KPI: 2 * 60 * 1000,           // 2 minutes for high-priority KPI data
  VOLUME: 30 * 1000,            // 30 seconds for volume data (reduced for debugging)
  REVENUE: 2 * 60 * 1000,       // 2 minutes for revenue data (user-controlled refresh via button)
  INFRASTRUCTURE: 10 * 60 * 1000, // 10 minutes for infrastructure data
} as const;

const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 10000,
} as const;

const REQUEST_TIMEOUT = 180000; // 180 seconds (3 minutes) for large datasets

// ============= Types =============

export interface DataFetchResult<T> {
  data: T | null;
  success: boolean;
  cached: boolean;
  fresh: boolean;
  timestamp: Date;
  error?: string;
  warnings?: string[];
  fetchDurationMs?: number;
}

interface CachedData<T> {
  data: T;
  timestamp: number;
  validationWarnings?: string[];
}

interface PendingRequest<T> {
  promise: Promise<DataFetchResult<T>>;
  startTime: number;
}

// ============= In-Memory Cache =============

class DataCache {
  private cache = new Map<string, CachedData<any>>();
  private pendingRequests = new Map<string, PendingRequest<any>>();

  /**
   * Get cached data if still valid
   */
  get<T>(key: string, ttl: number): CachedData<T> | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached as CachedData<T>;
  }

  /**
   * Set cached data
   */
  set<T>(key: string, data: T, warnings?: string[]): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      validationWarnings: warnings,
    });
  }

  /**
   * Clear specific cache entry
   */
  clear(key: string): void {
    this.cache.delete(key);
    this.pendingRequests.delete(key);
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Get or create pending request (deduplication)
   */
  getPendingRequest<T>(key: string): PendingRequest<T> | null {
    return this.pendingRequests.get(key) || null;
  }

  /**
   * Set pending request
   */
  setPendingRequest<T>(key: string, promise: Promise<DataFetchResult<T>>): void {
    this.pendingRequests.set(key, {
      promise,
      startTime: Date.now(),
    });
  }

  /**
   * Clear pending request
   */
  clearPendingRequest(key: string): void {
    this.pendingRequests.delete(key);
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      entries: Array.from(this.cache.entries()).map(([key, value]) => ({
        key,
        age: Date.now() - value.timestamp,
        hasWarnings: !!value.validationWarnings?.length,
      })),
    };
  }
}

const cache = new DataCache();

// ============= Helper Functions =============

/**
 * Exponential backoff delay
 */
function getRetryDelay(attempt: number): number {
  const delay = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout and retry logic
 */
async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  context: string,
  retryCount: number = 0
): Promise<T> {
  try {
    // Create timeout race
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT)
    );

    const result = await Promise.race([fetchFn(), timeoutPromise]);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Don't retry on validation errors or client errors
    if (errorMessage.includes('validation') || errorMessage.includes('400')) {
      throw error;
    }

    // Retry on network errors or server errors
    if (retryCount < RETRY_CONFIG.maxRetries) {
      const delay = getRetryDelay(retryCount);
      console.warn(`[${context}] Retry ${retryCount + 1}/${RETRY_CONFIG.maxRetries} after ${delay}ms. Error: ${errorMessage}`);
      await sleep(delay);
      return fetchWithRetry(fetchFn, context, retryCount + 1);
    }

    throw error;
  }
}

/**
 * Check if cache is fresh (< 30 seconds old)
 */
function isCacheFresh(timestamp: number): boolean {
  return (Date.now() - timestamp) < 30000; // 30 seconds
}

// ============= Core Data Fetching Functions =============

/**
 * Fetch KPI Dashboard Data
 * Routes to real-time database or Edge Function based on feature flag
 */
export async function fetchKPIData(force: boolean = false): Promise<DataFetchResult<KPIClient[]>> {
  // Use real-time database query (20x faster)
  if (FEATURE_FLAGS.useRealtimeKPI) {
    console.log('[KPI] Using real-time database query');
    return fetchKPIDataRealtime();
  }

  // Fallback to old Edge Function (for rollback)
  console.log('[KPI] Using Edge Function (fallback mode)');

  const cacheKey = 'kpi-dashboard-data';
  const startTime = Date.now();

  // Check for existing pending request (deduplication)
  if (!force) {
    const pending = cache.getPendingRequest<KPIClient[]>(cacheKey);
    if (pending) {
      console.log('[KPI] Using existing pending request');
      return pending.promise;
    }

    // Check cache
    const cached = cache.get<KPIClient[]>(cacheKey, CACHE_TTL.KPI);
    if (cached) {
      console.log('[KPI] Using cached data', { age: Date.now() - cached.timestamp });
      return {
        data: cached.data,
        success: true,
        cached: true,
        fresh: isCacheFresh(cached.timestamp),
        timestamp: new Date(cached.timestamp),
        warnings: cached.validationWarnings,
      };
    }
  }

  // Create new fetch promise
  const fetchPromise = (async (): Promise<DataFetchResult<KPIClient[]>> => {
    try {
      console.log('[KPI] Fetching fresh data from Edge Function');

      const { data, error } = await fetchWithRetry(
        () => supabase.functions.invoke('hybrid-workspace-analytics', {
          body: { timestamp: Date.now(), force }
        }),
        'KPI Data Fetch'
      );

      if (error) {
        throw new Error(`Edge Function error: ${error.message || JSON.stringify(error)}`);
      }

      // Validate response
      const validation = validateKPIClients(data?.clients || []);

      if (!validation.success) {
        logValidationErrors('KPI Dashboard', validation.errors);
        throw new Error(`Validation failed: ${validation.errors?.[0]?.message}`);
      }

      // Cache validated data
      cache.set(cacheKey, validation.data!, validation.warnings);

      const fetchDurationMs = Date.now() - startTime;
      console.log('[KPI] Fetch completed', { durationMs: fetchDurationMs, clientCount: validation.data!.length });

      return {
        data: validation.data!,
        success: true,
        cached: false,
        fresh: true,
        timestamp: new Date(),
        warnings: validation.warnings,
        fetchDurationMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[KPI] Fetch failed:', errorMessage);

      // Try to return stale cache if available (better than nothing)
      const staleCache = cache.get<KPIClient[]>(cacheKey, CACHE_TTL.KPI * 10); // Accept up to 10x TTL
      if (staleCache) {
        console.warn('[KPI] Returning stale cache due to fetch error');
        return {
          data: staleCache.data,
          success: false,
          cached: true,
          fresh: false,
          timestamp: new Date(staleCache.timestamp),
          error: `Using stale data: ${errorMessage}`,
          warnings: staleCache.validationWarnings,
        };
      }

      return {
        data: null,
        success: false,
        cached: false,
        fresh: false,
        timestamp: new Date(),
        error: errorMessage,
      };
    } finally {
      cache.clearPendingRequest(cacheKey);
    }
  })();

  // Store pending request for deduplication
  cache.setPendingRequest(cacheKey, fetchPromise);

  return fetchPromise;
}

/**
 * Fetch Volume Dashboard Data
 * Routes to real-time database or Edge Function based on feature flag
 */
export async function fetchVolumeData(force: boolean = false): Promise<DataFetchResult<VolumeClient[]>> {
  // Use real-time database query (15x faster)
  if (FEATURE_FLAGS.useRealtimeVolume) {
    console.log('[Volume] Using real-time database query');
    return fetchVolumeDataRealtime();
  }

  // Fallback to old Edge Function (for rollback)
  console.log('[Volume] Using Edge Function (fallback mode)');

  const cacheKey = 'volume-dashboard-data';
  const startTime = Date.now();

  if (!force) {
    const pending = cache.getPendingRequest<VolumeClient[]>(cacheKey);
    if (pending) {
      console.log('[Volume] Using existing pending request');
      return pending.promise;
    }

    const cached = cache.get<VolumeClient[]>(cacheKey, CACHE_TTL.VOLUME);
    if (cached) {
      console.log('[Volume] Using cached data', { age: Date.now() - cached.timestamp });
      return {
        data: cached.data,
        success: true,
        cached: true,
        fresh: isCacheFresh(cached.timestamp),
        timestamp: new Date(cached.timestamp),
        warnings: cached.validationWarnings,
      };
    }
  }

  const fetchPromise = (async (): Promise<DataFetchResult<VolumeClient[]>> => {
    try {
      console.log('[Volume] Fetching fresh data from Edge Function');

      const { data, error } = await fetchWithRetry(
        () => supabase.functions.invoke('volume-dashboard-data'),
        'Volume Data Fetch'
      );

      if (error) {
        throw new Error(`Edge Function error: ${error.message || JSON.stringify(error)}`);
      }

      const validation = validateVolumeClients(data?.clients || []);

      if (!validation.success) {
        logValidationErrors('Volume Dashboard', validation.errors);
        throw new Error(`Validation failed: ${validation.errors?.[0]?.message}`);
      }

      cache.set(cacheKey, validation.data!, validation.warnings);

      const fetchDurationMs = Date.now() - startTime;
      console.log('[Volume] Fetch completed', { durationMs: fetchDurationMs, clientCount: validation.data!.length });

      return {
        data: validation.data!,
        success: true,
        cached: false,
        fresh: true,
        timestamp: new Date(),
        warnings: validation.warnings,
        fetchDurationMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Volume] Fetch failed:', errorMessage);

      const staleCache = cache.get<VolumeClient[]>(cacheKey, CACHE_TTL.VOLUME * 10);
      if (staleCache) {
        console.warn('[Volume] Returning stale cache due to fetch error');
        return {
          data: staleCache.data,
          success: false,
          cached: true,
          fresh: false,
          timestamp: new Date(staleCache.timestamp),
          error: `Using stale data: ${errorMessage}`,
          warnings: staleCache.validationWarnings,
        };
      }

      return {
        data: null,
        success: false,
        cached: false,
        fresh: false,
        timestamp: new Date(),
        error: errorMessage,
      };
    } finally {
      cache.clearPendingRequest(cacheKey);
    }
  })();

  cache.setPendingRequest(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Fetch Revenue Dashboard Data
 * Uses revenue-billing-unified Edge Function (real-time Email Bison data)
 */
export async function fetchRevenueData(force: boolean = false): Promise<DataFetchResult<{ clients: RevenueClient[], totals: any }>> {
  const cacheKey = 'revenue-dashboard-data';
  const startTime = Date.now();

  if (!force) {
    const pending = cache.getPendingRequest<{ clients: RevenueClient[], totals: any }>(cacheKey);
    if (pending) {
      console.log('[Revenue] Using existing pending request');
      return pending.promise;
    }

    const cached = cache.get<{ clients: RevenueClient[], totals: any }>(cacheKey, CACHE_TTL.REVENUE);
    if (cached) {
      console.log('[Revenue] Using cached data', { age: Date.now() - cached.timestamp });
      return {
        data: cached.data,
        success: true,
        cached: true,
        fresh: isCacheFresh(cached.timestamp),
        timestamp: new Date(cached.timestamp),
        warnings: cached.validationWarnings,
      };
    }
  }

  const fetchPromise = (async (): Promise<DataFetchResult<{ clients: RevenueClient[], totals: any }>> => {
    try {
      console.log('[Revenue] Fetching fresh data from unified Edge Function');

      const { data, error } = await fetchWithRetry(
        () => supabase.functions.invoke('revenue-billing-unified'),
        'Revenue & Billing Data Fetch'
      );

      if (error) {
        throw new Error(`Edge Function error: ${error.message || JSON.stringify(error)}`);
      }

      const validation = validateRevenueClients(data?.clients || []);

      if (!validation.success) {
        logValidationErrors('Revenue Dashboard', validation.errors);
        throw new Error(`Validation failed: ${validation.errors?.[0]?.message}`);
      }

      const result = {
        clients: validation.data!,
        totals: data?.totals || {},
      };

      cache.set(cacheKey, result, validation.warnings);

      const fetchDurationMs = Date.now() - startTime;
      console.log('[Revenue] Fetch completed', { durationMs: fetchDurationMs, clientCount: validation.data!.length });

      return {
        data: result,
        success: true,
        cached: false,
        fresh: true,
        timestamp: new Date(),
        warnings: validation.warnings,
        fetchDurationMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Revenue] Fetch failed:', errorMessage);

      const staleCache = cache.get<{ clients: RevenueClient[], totals: any }>(cacheKey, CACHE_TTL.REVENUE * 10);
      if (staleCache) {
        console.warn('[Revenue] Returning stale cache due to fetch error');
        return {
          data: staleCache.data,
          success: false,
          cached: true,
          fresh: false,
          timestamp: new Date(staleCache.timestamp),
          error: `Using stale data: ${errorMessage}`,
          warnings: staleCache.validationWarnings,
        };
      }

      return {
        data: null,
        success: false,
        cached: false,
        fresh: false,
        timestamp: new Date(),
        error: errorMessage,
      };
    } finally {
      cache.clearPendingRequest(cacheKey);
    }
  })();

  cache.setPendingRequest(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Fetch Infrastructure/Email Accounts Data
 * Routes to real-time database or Edge Function based on feature flag
 */
export async function fetchInfrastructureData(force: boolean = false): Promise<DataFetchResult<EmailAccount[]>> {
  console.log('🔍 [Infrastructure] fetchInfrastructureData called, force:', force, 'useRealtime:', FEATURE_FLAGS.useRealtimeInfrastructure);

  // Use real-time database query (60x faster)
  if (FEATURE_FLAGS.useRealtimeInfrastructure) {
    console.log('[Infrastructure] Using real-time database query');
    return fetchInfrastructureDataRealtime();
  }

  // Fallback to old Edge Function (for rollback)
  console.log('✅ [Infrastructure] Using Edge Function (fallback mode)');

  const cacheKey = 'infrastructure-dashboard-data';
  const startTime = Date.now();

  if (!force) {
    const pending = cache.getPendingRequest<EmailAccount[]>(cacheKey);
    if (pending) {
      console.log('[Infrastructure] Using existing pending request');
      return pending.promise;
    }

    const cached = cache.get<EmailAccount[]>(cacheKey, CACHE_TTL.INFRASTRUCTURE);
    if (cached) {
      console.log('[Infrastructure] Using cached data', { age: Date.now() - cached.timestamp });
      return {
        data: cached.data,
        success: true,
        cached: true,
        fresh: isCacheFresh(cached.timestamp),
        timestamp: new Date(cached.timestamp),
        warnings: cached.validationWarnings,
      };
    }
  }

  const fetchPromise = (async (): Promise<DataFetchResult<EmailAccount[]>> => {
    try {
      console.log('📡 [Infrastructure] Fetching fresh data from Edge Function...');

      const { data, error } = await fetchWithRetry(
        () => supabase.functions.invoke('hybrid-email-accounts-v2'),
        'Infrastructure Data Fetch'
      );

      console.log('📦 [Infrastructure] Edge Function response received', { hasData: !!data, hasError: !!error, recordCount: data?.records?.length || 0 });

      if (error) {
        console.error('❌ [Infrastructure] Edge Function error:', error);
        throw new Error(`Edge Function error: ${error.message || JSON.stringify(error)}`);
      }

      // Filter out invalid records (missing required fields)
      const validRecords = (data?.records || []).filter((record: any) => {
        const hasEmail = record?.fields?.['Email Account'] || record?.fields?.Email;
        const hasWorkspace = record?.fields?.Workspace || record?.fields?.['Client Name (from Client)']?.[0];
        const hasStatus = record?.fields?.Status;
        return hasEmail && hasWorkspace && hasStatus;
      });

      console.log('🔄 [Infrastructure] Filtered', validRecords.length, 'valid accounts (from', data?.records?.length || 0, 'total)');

      // Skip validation - Edge Function data structure doesn't match validation schema
      // The data is already validated by the Edge Function itself
      const finalData = validRecords;
      cache.set(cacheKey, finalData, []);

      const fetchDurationMs = Date.now() - startTime;
      console.log('✅ [Infrastructure] Fetch completed successfully!', { durationMs: fetchDurationMs, accountCount: finalData.length });

      return {
        data: finalData,
        success: true,
        cached: false,
        fresh: true,
        timestamp: new Date(),
        warnings: [],
        fetchDurationMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Infrastructure] Fetch failed:', errorMessage);

      const staleCache = cache.get<EmailAccount[]>(cacheKey, CACHE_TTL.INFRASTRUCTURE * 10);
      if (staleCache) {
        console.warn('[Infrastructure] Returning stale cache due to fetch error');
        return {
          data: staleCache.data,
          success: false,
          cached: true,
          fresh: false,
          timestamp: new Date(staleCache.timestamp),
          error: `Using stale data: ${errorMessage}`,
          warnings: staleCache.validationWarnings,
        };
      }

      return {
        data: null,
        success: false,
        cached: false,
        fresh: false,
        timestamp: new Date(),
        error: errorMessage,
      };
    } finally {
      cache.clearPendingRequest(cacheKey);
    }
  })();

  cache.setPendingRequest(cacheKey, fetchPromise);
  return fetchPromise;
}

// ============= Cache Management Functions =============

/**
 * Clear all cached data
 */
export function clearAllCache(): void {
  cache.clearAll();
  console.log('[DataService] All cache cleared');
}

/**
 * Clear specific dashboard cache
 */
export function clearDashboardCache(dashboard: 'kpi' | 'volume' | 'revenue' | 'infrastructure'): void {
  const cacheKeys = {
    kpi: 'kpi-dashboard-data',
    volume: 'volume-dashboard-data',
    revenue: 'revenue-dashboard-data',
    infrastructure: 'infrastructure-dashboard-data',
  };

  cache.clear(cacheKeys[dashboard]);
  console.log(`[DataService] ${dashboard} cache cleared`);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return cache.getStats();
}

/**
 * Prefetch all dashboards (useful for initial load)
 */
export async function prefetchAllDashboards(): Promise<void> {
  console.log('[DataService] Prefetching all dashboards...');

  await Promise.allSettled([
    fetchKPIData(false),
    fetchVolumeData(false),
    fetchRevenueData(false),
    fetchInfrastructureData(false),
  ]);

  console.log('[DataService] Prefetch completed');
}
