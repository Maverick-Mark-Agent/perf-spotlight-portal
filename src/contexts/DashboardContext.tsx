import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchKPIData,
  fetchVolumeData,
  fetchRevenueData,
  fetchInfrastructureData,
  clearAllCache,
  clearDashboardCache,
  type DataFetchResult,
} from '@/services/dataService';

// ============= TypeScript Interfaces =============

interface ClientData {
  id: string;
  name: string;
  leadsGenerated: number;
  projectedReplies: number;
  leadsTarget: number;
  repliesTarget: number;
  monthlyKPI: number;
  currentProgress: number;
  repliesProgress: number;
  positiveRepliesLast30Days: number;
  positiveRepliesLast7Days: number;
  positiveRepliesLast14Days: number;
  positiveRepliesCurrentMonth: number;
  positiveRepliesLastMonth: number;
  lastWeekVsWeekBeforeProgress: number;
  positiveRepliesLastVsThisMonth: number;
}

interface VolumeClientData {
  name: string;
  emails: number;
  emailsToday: number;
  emailsLast7Days: number;
  emailsLast14Days: number;
  emailsLast30Days: number;
  target: number;
  projection: number;
  targetPercentage: number;
  projectedPercentage: number;
  isAboveTarget: boolean;
  isProjectedAboveTarget: boolean;
  variance: number;
  projectedVariance: number;
  dailyQuota: number;
  dailySendingTarget: number;
  expectedByNow: number;
  isOnTrack: boolean;
  dailyAverage: number;
  distanceToTarget: number;
  rank: number;
}

interface InfrastructureFilters {
  selectedAnalysis: string;
  selectedProviderView: string;
  selectedClientForSending: string;
  clientAccountFilter: string | null;
}

interface RevenueClientData {
  workspace_name: string;
  billing_type: 'per_lead' | 'retainer';
  // MTD Metrics
  current_month_leads: number;
  current_month_revenue: number;
  current_month_costs: number;
  current_month_profit: number;
  // Profitability
  profit_margin: number;
  price_per_lead: number;
  retainer_amount: number;
  // KPI Metrics
  monthly_kpi: number;
  kpi_progress: number;
  leads_remaining: number;
  // Cost Details (NEW)
  cost_source?: 'manual' | 'calculated';
  email_account_costs?: number;
  labor_costs?: number;
  other_costs?: number;
  // Email Performance Metrics
  emails_sent_mtd?: number;
  replies_mtd?: number;
  interested_mtd?: number;
  bounces_mtd?: number;
  unsubscribes_mtd?: number;
  reply_rate?: number;
  interested_rate?: number;
  rank: number;
}

interface RevenueTotals {
  total_mtd_revenue: number;
  total_mtd_costs: number;
  total_mtd_profit: number;
  total_mtd_leads: number;
  total_per_lead_revenue: number;
  total_retainer_revenue: number;
  per_lead_count: number;
  retainer_count: number;
  overall_profit_margin: number;
  // NEW: Daily Average & Projections
  daily_average_revenue?: number;
  projected_eom_revenue?: number;
  total_possible_revenue?: number;
  revenue_gap?: number;
  total_kpi_target?: number;
  // NEW: Revenue Forecast (ALL revenue including retainers)
  forecast?: {
    linear: number;
    velocity_adjusted: number;
    conservative: number;
    optimistic: number;
    confidence: 'high' | 'medium' | 'low';
    avg_kpi_progress: number;
    days_elapsed: number;
    days_remaining: number;
  };
  // NEW: Billable Leads Only Metrics
  total_possible_billable_revenue?: number; // Per-lead clients only, 100% KPI
  daily_billable_revenue_target?: number; // Daily target pace for billable revenue
  total_mtd_billable_revenue?: number; // Actual MTD billable revenue (per-lead only)
  daily_billable_revenue?: Array<{
    day: number;
    date: string;
    daily_revenue: number;
    cumulative_revenue: number;
    lead_count: number;
  }>;
  // NEW: Billable Leads Only Forecast
  billable_forecast?: {
    conservative: number;
    linear: number;
    optimistic: number;
    confidence: 'high' | 'medium' | 'low';
    avg_kpi_progress: number;
    daily_average: number;
    days_elapsed: number;
    days_remaining: number;
  };
  // Email Performance Totals
  total_emails_sent?: number;
  total_replies?: number;
  total_interested?: number;
  total_bounces?: number;
  total_unsubscribes?: number;
  overall_reply_rate?: number;
  overall_interested_rate?: number;
}

interface RevenueDashboardState {
  clients: RevenueClientData[];
  totals: RevenueTotals;
  lastUpdated: Date | null;
  loading: boolean;
  isUsingCache: boolean;
  isFresh: boolean;
  error: string | null;
  warnings: string[];
  fetchDurationMs?: number;
}

interface KPIDashboardState {
  clients: ClientData[];
  selectedClient: string | null;
  viewMode: 'overview' | 'detail';
  lastUpdated: Date | null;
  loading: boolean;
  isUsingCache: boolean;
  isFresh: boolean;
  error: string | null;
  warnings: string[];
  fetchDurationMs?: number;
}

interface VolumeDashboardState {
  clients: VolumeClientData[];
  lastUpdated: Date | null;
  loading: boolean;
  isUsingCache: boolean;
  isFresh: boolean;
  error: string | null;
  warnings: string[];
  fetchDurationMs?: number;
}

interface InfrastructureDashboardState {
  emailAccounts: any[];
  filters: InfrastructureFilters;
  expandedAccountTypes: Set<string>;
  expandedStatuses: Set<string>;
  selectedClient: any;
  isClientModalOpen: boolean;
  lastUpdated: Date | null;
  loading: boolean;
  isUsingCache: boolean;
  isFresh: boolean;
  error: string | null;
  warnings: string[];
  fetchDurationMs?: number;
}

interface DashboardContextType {
  // KPI Dashboard
  kpiDashboard: KPIDashboardState;
  setKPISelectedClient: (id: string | null) => void;
  setKPIViewMode: (mode: 'overview' | 'detail') => void;
  refreshKPIDashboard: (force?: boolean) => Promise<void>;

  // Volume Dashboard
  volumeDashboard: VolumeDashboardState;
  refreshVolumeDashboard: (force?: boolean) => Promise<void>;

  // Infrastructure Dashboard
  infrastructureDashboard: InfrastructureDashboardState;
  setInfrastructureFilter: (key: keyof InfrastructureFilters, value: any) => void;
  setInfrastructureExpandedAccountTypes: (types: Set<string>) => void;
  setInfrastructureExpandedStatuses: (statuses: Set<string>) => void;
  setInfrastructureSelectedClient: (client: any) => void;
  setInfrastructureModalOpen: (open: boolean) => void;
  refreshInfrastructure: (force?: boolean) => Promise<void>;

  // Revenue Dashboard
  revenueDashboard: RevenueDashboardState;
  refreshRevenueDashboard: (force?: boolean) => Promise<void>;

  // Global
  refreshAll: () => Promise<void>;
  canRefresh: () => boolean;
  getTimeUntilNextRefresh: () => number;
}

// ============= Cache Configuration =============

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes in milliseconds (reduced for fresher data)
const MIN_REFRESH_INTERVAL = 30 * 1000; // 30 seconds minimum between manual refreshes

const CACHE_KEYS = {
  KPI_DATA: 'kpi-dashboard-data',
  KPI_TIMESTAMP: 'kpi-dashboard-timestamp',
  KPI_SELECTED_CLIENT: 'kpi-selected-client',
  KPI_VIEW_MODE: 'kpi-view-mode',
  VOLUME_DATA: 'volume-dashboard-data',
  VOLUME_TIMESTAMP: 'volume-dashboard-timestamp',
  REVENUE_DATA: 'revenue-dashboard-data',
  REVENUE_TIMESTAMP: 'revenue-dashboard-timestamp',
  // Infrastructure doesn't use localStorage cache due to quota limits (4000+ accounts)
};

// ============= Context Creation =============

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboardContext = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  return context;
};

// ============= Provider Component =============

export const DashboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // ============= Refresh Rate Limiting =============
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);

  // ============= KPI Dashboard State =============
  const [kpiDashboard, setKPIDashboard] = useState<KPIDashboardState>({
    clients: [],
    selectedClient: null,
    viewMode: 'overview',
    lastUpdated: null,
    loading: true,
    isUsingCache: false,
    isFresh: false,
    error: null,
    warnings: [],
  });

  // ============= Volume Dashboard State =============
  const [volumeDashboard, setVolumeDashboard] = useState<VolumeDashboardState>({
    clients: [],
    lastUpdated: null,
    loading: true,
    isUsingCache: false,
    isFresh: false,
    error: null,
    warnings: [],
  });

  // ============= Infrastructure Dashboard State =============
  const [infrastructureDashboard, setInfrastructureDashboard] = useState<InfrastructureDashboardState>({
    emailAccounts: [],
    filters: {
      selectedAnalysis: 'Email Provider',
      selectedProviderView: 'Total Email Sent',
      selectedClientForSending: 'All Clients',
      clientAccountFilter: null,
    },
    expandedAccountTypes: new Set(),
    expandedStatuses: new Set(),
    selectedClient: null,
    isClientModalOpen: false,
    lastUpdated: null,
    loading: true,
    isUsingCache: false,
    isFresh: false,
    error: null,
    warnings: [],
  });

  // ============= Revenue Dashboard State =============
  const [revenueDashboard, setRevenueDashboard] = useState<RevenueDashboardState>({
    clients: [],
    totals: {
      total_mtd_revenue: 0,
      total_mtd_costs: 0,
      total_mtd_profit: 0,
      total_mtd_leads: 0,
      total_per_lead_revenue: 0,
      total_retainer_revenue: 0,
      per_lead_count: 0,
      retainer_count: 0,
      overall_profit_margin: 0,
      daily_average_revenue: 0,
      projected_eom_revenue: 0,
      total_possible_revenue: 0,
      revenue_gap: 0,
      total_kpi_target: 0,
    },
    lastUpdated: null,
    loading: true,
    isUsingCache: false,
    isFresh: false,
    error: null,
    warnings: [],
  });

  // ============= Helper Functions =============

  const isCacheValid = (timestamp: string | null): boolean => {
    if (!timestamp) return false;
    const cacheTime = new Date(timestamp).getTime();
    const now = Date.now();
    return (now - cacheTime) < CACHE_DURATION;
  };

  const loadFromCache = <T,>(dataKey: string, timestampKey: string): { data: T | null; timestamp: Date | null } => {
    try {
      const cachedData = localStorage.getItem(dataKey);
      const cachedTimestamp = localStorage.getItem(timestampKey);

      if (cachedData && cachedTimestamp && isCacheValid(cachedTimestamp)) {
        return {
          data: JSON.parse(cachedData) as T,
          timestamp: new Date(cachedTimestamp),
        };
      }
    } catch (error) {
      console.error(`Error loading cache for ${dataKey}:`, error);
    }
    return { data: null, timestamp: null };
  };

  const saveToCache = <T,>(dataKey: string, timestampKey: string, data: T, timestamp: Date) => {
    try {
      localStorage.setItem(dataKey, JSON.stringify(data));
      localStorage.setItem(timestampKey, timestamp.toISOString());
    } catch (error) {
      console.error(`Error saving cache for ${dataKey}:`, error);
    }
  };

  // ============= KPI Dashboard Functions =============

  const fetchKPIDataInternal = useCallback(async (force: boolean = false) => {
    try {
      // Don't show loading if we have cached data and not forcing refresh
      if (!force && kpiDashboard.clients.length > 0) {
        // Silent background refresh
      } else {
        setKPIDashboard(prev => ({ ...prev, loading: true, error: null }));
      }

      // Use new dataService with validation
      const result = await fetchKPIData(force);

      if (result.success && result.data) {
        setKPIDashboard(prev => ({
          ...prev,
          clients: (result.data! as ClientData[]).filter(client => !!client.id),
          lastUpdated: result.timestamp,
          loading: false,
          isUsingCache: result.cached,
          isFresh: result.fresh,
          error: null,
          warnings: result.warnings || [],
          fetchDurationMs: result.fetchDurationMs,
        }));
      } else {
        // Handle error case - may still have stale data
        setKPIDashboard(prev => ({
          ...prev,
          clients: (result.data ? (result.data as ClientData[]).filter(client => !!client.id) : prev.clients),
          lastUpdated: result.timestamp,
          loading: false,
          isUsingCache: result.cached,
          isFresh: result.fresh,
          error: result.error || 'Failed to fetch KPI data',
          warnings: result.warnings || [],
        }));
      }
    } catch (error) {
      console.error('Error fetching KPI data:', error);
      setKPIDashboard(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [kpiDashboard.clients.length]);

  const setKPISelectedClient = useCallback((id: string | null) => {
    setKPIDashboard(prev => ({ ...prev, selectedClient: id }));
    if (id) {
      localStorage.setItem(CACHE_KEYS.KPI_SELECTED_CLIENT, id);
    } else {
      localStorage.removeItem(CACHE_KEYS.KPI_SELECTED_CLIENT);
    }
  }, []);

  const setKPIViewMode = useCallback((mode: 'overview' | 'detail') => {
    setKPIDashboard(prev => ({ ...prev, viewMode: mode }));
    localStorage.setItem(CACHE_KEYS.KPI_VIEW_MODE, mode);
  }, []);

  const refreshKPIDashboard = useCallback(async (force: boolean = true) => {
    // Rate limiting check
    const now = Date.now();
    if (!force && (now - lastRefreshTime) < MIN_REFRESH_INTERVAL) {
      console.log('[Refresh] Rate limited - too soon since last refresh');
      return;
    }
    setLastRefreshTime(now);
    await fetchKPIDataInternal(force);
  }, [fetchKPIDataInternal, lastRefreshTime]);

  // ============= Volume Dashboard Functions =============

  const fetchVolumeDataInternal = useCallback(async (force: boolean = false) => {
    try {
      if (!force && volumeDashboard.clients.length > 0) {
        // Silent background refresh
      } else {
        setVolumeDashboard(prev => ({ ...prev, loading: true, error: null }));
      }

      // Use new dataService with validation
      const result = await fetchVolumeData(force);

      if (result.success && result.data) {
        setVolumeDashboard({
          clients: (result.data as VolumeClientData[]).filter(client => !!client.name),
          lastUpdated: result.timestamp,
          loading: false,
          isUsingCache: result.cached,
          isFresh: result.fresh,
          error: null,
          warnings: result.warnings || [],
          fetchDurationMs: result.fetchDurationMs,
        });
      } else {
        setVolumeDashboard(prev => ({
          ...prev,
          clients: (result.data ? (result.data as VolumeClientData[]).filter(client => !!client.name) : prev.clients),
          lastUpdated: result.timestamp,
          loading: false,
          isUsingCache: result.cached,
          isFresh: result.fresh,
          error: result.error || 'Failed to fetch volume data',
          warnings: result.warnings || [],
        }));
      }
    } catch (error) {
      console.error('Error fetching Volume data:', error);
      setVolumeDashboard(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [volumeDashboard.clients.length]);

  const refreshVolumeDashboard = useCallback(async (force: boolean = true) => {
    // Rate limiting check
    const now = Date.now();
    if (!force && (now - lastRefreshTime) < MIN_REFRESH_INTERVAL) {
      console.log('[Refresh] Rate limited - too soon since last refresh');
      return;
    }
    setLastRefreshTime(now);
    await fetchVolumeDataInternal(force);
  }, [fetchVolumeDataInternal, lastRefreshTime]);

  // ============= Infrastructure Dashboard Functions =============

  const fetchInfrastructureDataInternal = useCallback(async (force: boolean = false) => {
    try {
      // Check if we have recent data (< 10 minutes old) and skip refresh
      const now = Date.now();
      const lastUpdate = infrastructureDashboard.lastUpdated?.getTime() || 0;
      const age = now - lastUpdate;
      const TEN_MINUTES = 10 * 60 * 1000;

      if (!force && age < TEN_MINUTES && infrastructureDashboard.emailAccounts.length > 0) {
        console.log(`[Infrastructure] Skipping fetch - data is only ${Math.round(age / 1000 / 60)} minutes old`);
        return; // Use existing cached data
      }

      if (!force && infrastructureDashboard.emailAccounts.length > 0) {
        // Silent background refresh
      } else {
        setInfrastructureDashboard(prev => ({ ...prev, loading: true, error: null }));
      }

      // Use new dataService with validation
      const result = await fetchInfrastructureData(force);

      if (result.success && result.data) {
        setInfrastructureDashboard(prev => ({
          ...prev,
          emailAccounts: result.data!,
          lastUpdated: result.timestamp,
          loading: false,
          isUsingCache: result.cached,
          isFresh: result.fresh,
          error: null,
          warnings: result.warnings || [],
          fetchDurationMs: result.fetchDurationMs,
        }));
      } else {
        setInfrastructureDashboard(prev => ({
          ...prev,
          emailAccounts: result.data || prev.emailAccounts,
          lastUpdated: result.timestamp,
          loading: false,
          isUsingCache: result.cached,
          isFresh: result.fresh,
          error: result.error || 'Failed to fetch infrastructure data',
          warnings: result.warnings || [],
        }));
      }
    } catch (error) {
      console.error('Error fetching Infrastructure data:', error);
      setInfrastructureDashboard(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [infrastructureDashboard.emailAccounts.length]);

  const setInfrastructureFilter = useCallback((key: keyof InfrastructureFilters, value: any) => {
    setInfrastructureDashboard(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [key]: value,
      },
    }));
  }, []);

  const setInfrastructureExpandedAccountTypes = useCallback((types: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setInfrastructureDashboard(prev => ({
      ...prev,
      expandedAccountTypes: typeof types === 'function' ? types(prev.expandedAccountTypes) : types
    }));
  }, []);

  const setInfrastructureExpandedStatuses = useCallback((statuses: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setInfrastructureDashboard(prev => ({
      ...prev,
      expandedStatuses: typeof statuses === 'function' ? statuses(prev.expandedStatuses) : statuses
    }));
  }, []);

  const setInfrastructureSelectedClient = useCallback((client: any) => {
    setInfrastructureDashboard(prev => ({ ...prev, selectedClient: client }));
  }, []);

  const setInfrastructureModalOpen = useCallback((open: boolean) => {
    setInfrastructureDashboard(prev => ({ ...prev, isClientModalOpen: open }));
  }, []);

  const refreshInfrastructure = useCallback(async (force: boolean = true) => {
    // Rate limiting check
    const now = Date.now();
    if (!force && (now - lastRefreshTime) < MIN_REFRESH_INTERVAL) {
      console.log('[Refresh] Rate limited - too soon since last refresh');
      return;
    }

    // When forcing refresh, clear cache first to ensure fresh data
    if (force) {
      console.log('[Infrastructure] Forcing refresh - clearing cache first');
      clearDashboardCache('infrastructure');
    }

    setLastRefreshTime(now);
    await fetchInfrastructureDataInternal(force);
  }, [fetchInfrastructureDataInternal, lastRefreshTime]);

  // ============= Revenue Dashboard Functions =============

  const fetchRevenueDataInternal = useCallback(async (force: boolean = false) => {
    try {
      if (!force && revenueDashboard.clients.length > 0) {
        // Silent background refresh
      } else {
        setRevenueDashboard(prev => ({ ...prev, loading: true, error: null }));
      }

      // Use new dataService with validation
      const result = await fetchRevenueData(force);

      if (result.success && result.data) {
        setRevenueDashboard({
          clients: result.data.clients as RevenueClientData[],
          totals: result.data.totals as RevenueTotals,
          lastUpdated: result.timestamp,
          loading: false,
          isUsingCache: result.cached,
          isFresh: result.fresh,
          error: null,
          warnings: result.warnings || [],
          fetchDurationMs: result.fetchDurationMs,
        });
      } else {
        setRevenueDashboard(prev => {
          // Ensure we assign correctly-typed values to state
          const clients: RevenueClientData[] = result.data?.clients
            ? (result.data.clients as RevenueClientData[]).filter(c => !!c.workspace_name)
            : prev.clients;
          const totals: RevenueTotals = result.data?.totals
            ? (result.data.totals as RevenueTotals)
            : prev.totals;

          return {
            ...prev,
            clients,
            totals,
            lastUpdated: result.timestamp,
            loading: false,
            isUsingCache: result.cached,
            isFresh: result.fresh,
            error: result.error || 'Failed to fetch revenue data',
            warnings: result.warnings || [],
          };
        });
      }
    } catch (error) {
      console.error('Error fetching Revenue data:', error);
      setRevenueDashboard(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [revenueDashboard.clients.length]);

  const refreshRevenueDashboard = useCallback(async (force: boolean = true) => {
    // Rate limiting check
    const now = Date.now();
    if (!force && (now - lastRefreshTime) < MIN_REFRESH_INTERVAL) {
      console.log('[Refresh] Rate limited - too soon since last refresh');
      return;
    }
    setLastRefreshTime(now);
    await fetchRevenueDataInternal(force);
  }, [fetchRevenueDataInternal, lastRefreshTime]);

  // ============= Global Functions =============

  const refreshAll = useCallback(async () => {
    // Rate limiting check
    const now = Date.now();
    if ((now - lastRefreshTime) < MIN_REFRESH_INTERVAL) {
      console.log('[Refresh] Rate limited - too soon since last refresh');
      return;
    }
    setLastRefreshTime(now);
    await Promise.all([
      fetchKPIDataInternal(true),
      fetchVolumeDataInternal(true),
      fetchInfrastructureDataInternal(true),
      fetchRevenueDataInternal(true),
    ]);
  }, [fetchKPIDataInternal, fetchVolumeDataInternal, fetchInfrastructureDataInternal, fetchRevenueDataInternal, lastRefreshTime]);

  // Helper functions for refresh rate limiting
  const canRefresh = useCallback(() => {
    const now = Date.now();
    return (now - lastRefreshTime) >= MIN_REFRESH_INTERVAL;
  }, [lastRefreshTime]);

  const getTimeUntilNextRefresh = useCallback(() => {
    const now = Date.now();
    const timeElapsed = now - lastRefreshTime;
    const timeRemaining = MIN_REFRESH_INTERVAL - timeElapsed;
    return Math.max(0, Math.ceil(timeRemaining / 1000)); // Return seconds
  }, [lastRefreshTime]);

  // ============= Initial Load & Hydration =============

  useEffect(() => {
    // Load KPI Dashboard from cache
    const kpiCache = loadFromCache<ClientData[]>(CACHE_KEYS.KPI_DATA, CACHE_KEYS.KPI_TIMESTAMP);
    const cachedSelectedClient = localStorage.getItem(CACHE_KEYS.KPI_SELECTED_CLIENT);
    const cachedViewMode = localStorage.getItem(CACHE_KEYS.KPI_VIEW_MODE) as 'overview' | 'detail' || 'overview';

    // Load Volume & Revenue caches
    const volumeCache = loadFromCache<VolumeClientData[]>(CACHE_KEYS.VOLUME_DATA, CACHE_KEYS.VOLUME_TIMESTAMP);
    const revenueCache = loadFromCache<{ clients: RevenueClientData[]; totals: RevenueTotals }>(
      CACHE_KEYS.REVENUE_DATA,
      CACHE_KEYS.REVENUE_TIMESTAMP
    );

    if (kpiCache.data) {
      setKPIDashboard({
        clients: kpiCache.data,
        selectedClient: cachedSelectedClient,
        viewMode: cachedViewMode,
        lastUpdated: kpiCache.timestamp,
        loading: false,
        isUsingCache: true,
        isFresh: false,
        error: null,
        warnings: [],
      });
      console.log('Loaded KPI dashboard from cache:', kpiCache.timestamp);
    }
    if (volumeCache.data) {
      setVolumeDashboard({
        clients: volumeCache.data,
        lastUpdated: volumeCache.timestamp,
        loading: false,
        isUsingCache: true,
        isFresh: false,
        error: null,
        warnings: [],
      });
      console.log('Loaded Volume dashboard from cache:', volumeCache.timestamp);
    }
    if (revenueCache.data) {
      setRevenueDashboard({
        clients: revenueCache.data.clients,
        totals: revenueCache.data.totals,
        lastUpdated: revenueCache.timestamp,
        loading: false,
        isUsingCache: true,
        isFresh: false,
        error: null,
        warnings: [],
      });
      console.log('Loaded Revenue dashboard from cache:', revenueCache.timestamp);
    }

    // Fetch fresh data in background
    fetchKPIDataInternal(false);
    fetchVolumeDataInternal(false);
    fetchInfrastructureDataInternal(false);
    fetchRevenueDataInternal(false);

    // Auto-refresh disabled - users can manually refresh using the Refresh button
    // This prevents constant dashboard refreshing that makes analysis difficult
    // Data is kept fresh via:
    // 1. Webhooks (real-time KPI updates)
    // 2. Nightly cron jobs (sync-daily-kpi-metrics runs at midnight)
    // 3. Manual refresh button on each dashboard
  }, []); // Only run once on mount

  // ============= Context Value =============

  const contextValue: DashboardContextType = {
    kpiDashboard,
    setKPISelectedClient,
    setKPIViewMode,
    refreshKPIDashboard,
    volumeDashboard,
    refreshVolumeDashboard,
    infrastructureDashboard,
    setInfrastructureFilter,
    setInfrastructureExpandedAccountTypes,
    setInfrastructureExpandedStatuses,
    setInfrastructureSelectedClient,
    setInfrastructureModalOpen,
    refreshInfrastructure,
    revenueDashboard,
    refreshRevenueDashboard,
    refreshAll,
    canRefresh,
    getTimeUntilNextRefresh,
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
};
