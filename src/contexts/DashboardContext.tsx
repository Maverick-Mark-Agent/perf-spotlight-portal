import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  current_month_leads: number;
  current_month_revenue: number;
  current_month_costs: number;
  current_month_profit: number;
  projected_leads: number;
  projected_revenue: number;
  projected_profit: number;
  last_month_leads: number;
  last_month_revenue: number;
  last_month_profit: number;
  mom_revenue_change: number;
  mom_profit_change: number;
  profit_margin: number;
  price_per_lead: number;
  retainer_amount: number;
  rank: number;
}

interface RevenueTotals {
  total_mtd_revenue: number;
  total_mtd_costs: number;
  total_mtd_profit: number;
  total_projected_revenue: number;
  total_per_lead_revenue: number;
  total_retainer_revenue: number;
}

interface RevenueDashboardState {
  clients: RevenueClientData[];
  totals: RevenueTotals;
  lastUpdated: Date | null;
  loading: boolean;
  isUsingCache: boolean;
}

interface KPIDashboardState {
  clients: ClientData[];
  selectedClient: string | null;
  viewMode: 'overview' | 'detail';
  lastUpdated: Date | null;
  loading: boolean;
  isUsingCache: boolean;
}

interface VolumeDashboardState {
  clients: VolumeClientData[];
  lastUpdated: Date | null;
  loading: boolean;
  isUsingCache: boolean;
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
}

// ============= Cache Configuration =============

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

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
  // ============= KPI Dashboard State =============
  const [kpiDashboard, setKPIDashboard] = useState<KPIDashboardState>({
    clients: [],
    selectedClient: null,
    viewMode: 'overview',
    lastUpdated: null,
    loading: true,
    isUsingCache: false,
  });

  // ============= Volume Dashboard State =============
  const [volumeDashboard, setVolumeDashboard] = useState<VolumeDashboardState>({
    clients: [],
    lastUpdated: null,
    loading: true,
    isUsingCache: false,
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
  });

  // ============= Revenue Dashboard State =============
  const [revenueDashboard, setRevenueDashboard] = useState<RevenueDashboardState>({
    clients: [],
    totals: {
      total_mtd_revenue: 0,
      total_mtd_costs: 0,
      total_mtd_profit: 0,
      total_projected_revenue: 0,
      total_per_lead_revenue: 0,
      total_retainer_revenue: 0,
    },
    lastUpdated: null,
    loading: true,
    isUsingCache: false,
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

  const fetchKPIData = useCallback(async (force: boolean = false) => {
    try {
      // Don't show loading if we have cached data and not forcing refresh
      if (!force && kpiDashboard.clients.length > 0) {
        // Silent background refresh
      } else {
        setKPIDashboard(prev => ({ ...prev, loading: true }));
      }

      const { data, error } = await supabase.functions.invoke('hybrid-workspace-analytics', {
        body: { timestamp: Date.now() }
      });

      if (error) throw error;

      if (data?.clients) {
        const timestamp = new Date();

        setKPIDashboard(prev => ({
          ...prev,
          clients: data.clients,
          lastUpdated: timestamp,
          loading: false,
          isUsingCache: false,
        }));

        // Cache the data
        saveToCache(CACHE_KEYS.KPI_DATA, CACHE_KEYS.KPI_TIMESTAMP, data.clients, timestamp);
      }
    } catch (error) {
      console.error('Error fetching KPI data:', error);
      setKPIDashboard(prev => ({ ...prev, loading: false }));
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
    await fetchKPIData(force);
  }, [fetchKPIData]);

  // ============= Volume Dashboard Functions =============

  const fetchVolumeData = useCallback(async (force: boolean = false) => {
    try {
      if (!force && volumeDashboard.clients.length > 0) {
        // Silent background refresh
      } else {
        setVolumeDashboard(prev => ({ ...prev, loading: true }));
      }

      const { data, error } = await supabase.functions.invoke('volume-dashboard-data');

      if (error) throw error;

      const clients = data?.clients || [];
      const timestamp = new Date();

      setVolumeDashboard({
        clients,
        lastUpdated: timestamp,
        loading: false,
        isUsingCache: false,
      });

      // Cache the data
      saveToCache(CACHE_KEYS.VOLUME_DATA, CACHE_KEYS.VOLUME_TIMESTAMP, clients, timestamp);
    } catch (error) {
      console.error('Error fetching Volume data:', error);
      setVolumeDashboard(prev => ({ ...prev, loading: false }));
    }
  }, [volumeDashboard.clients.length]);

  const refreshVolumeDashboard = useCallback(async (force: boolean = true) => {
    await fetchVolumeData(force);
  }, [fetchVolumeData]);

  // ============= Infrastructure Dashboard Functions =============

  const fetchInfrastructureData = useCallback(async (force: boolean = false) => {
    try {
      if (!force && infrastructureDashboard.emailAccounts.length > 0) {
        // Silent background refresh
      } else {
        setInfrastructureDashboard(prev => ({ ...prev, loading: true }));
      }

      const { data, error } = await supabase.functions.invoke('hybrid-email-accounts-v2');

      if (error) throw error;

      const accounts = data?.records || [];
      const timestamp = new Date();

      setInfrastructureDashboard(prev => ({
        ...prev,
        emailAccounts: accounts,
        lastUpdated: timestamp,
        loading: false,
        isUsingCache: false,
      }));

      // Note: Infrastructure doesn't use localStorage cache due to quota limits
    } catch (error) {
      console.error('Error fetching Infrastructure data:', error);
      setInfrastructureDashboard(prev => ({ ...prev, loading: false }));
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

  const setInfrastructureExpandedAccountTypes = useCallback((types: Set<string>) => {
    setInfrastructureDashboard(prev => ({ ...prev, expandedAccountTypes: types }));
  }, []);

  const setInfrastructureExpandedStatuses = useCallback((statuses: Set<string>) => {
    setInfrastructureDashboard(prev => ({ ...prev, expandedStatuses: statuses }));
  }, []);

  const setInfrastructureSelectedClient = useCallback((client: any) => {
    setInfrastructureDashboard(prev => ({ ...prev, selectedClient: client }));
  }, []);

  const setInfrastructureModalOpen = useCallback((open: boolean) => {
    setInfrastructureDashboard(prev => ({ ...prev, isClientModalOpen: open }));
  }, []);

  const refreshInfrastructure = useCallback(async (force: boolean = true) => {
    await fetchInfrastructureData(force);
  }, [fetchInfrastructureData]);

  // ============= Revenue Dashboard Functions =============

  const fetchRevenueData = useCallback(async (force: boolean = false) => {
    try {
      if (!force && revenueDashboard.clients.length > 0) {
        // Silent background refresh
      } else {
        setRevenueDashboard(prev => ({ ...prev, loading: true }));
      }

      const { data, error } = await supabase.functions.invoke('revenue-analytics');

      if (error) throw error;

      const clients = data?.clients || [];
      const totals = data?.totals || {
        total_mtd_revenue: 0,
        total_mtd_costs: 0,
        total_mtd_profit: 0,
        total_projected_revenue: 0,
        total_per_lead_revenue: 0,
        total_retainer_revenue: 0,
      };
      const timestamp = new Date();

      setRevenueDashboard({
        clients,
        totals,
        lastUpdated: timestamp,
        loading: false,
        isUsingCache: false,
      });

      // Cache the data
      saveToCache(CACHE_KEYS.REVENUE_DATA, CACHE_KEYS.REVENUE_TIMESTAMP, { clients, totals }, timestamp);
    } catch (error) {
      console.error('Error fetching Revenue data:', error);
      setRevenueDashboard(prev => ({ ...prev, loading: false }));
    }
  }, [revenueDashboard.clients.length]);

  const refreshRevenueDashboard = useCallback(async (force: boolean = true) => {
    await fetchRevenueData(force);
  }, [fetchRevenueData]);

  // ============= Global Functions =============

  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchKPIData(true),
      fetchVolumeData(true),
      fetchInfrastructureData(true),
      fetchRevenueData(true),
    ]);
  }, [fetchKPIData, fetchVolumeData, fetchInfrastructureData, fetchRevenueData]);

  // ============= Initial Load & Hydration =============

  useEffect(() => {
    // Load KPI Dashboard from cache
    const kpiCache = loadFromCache<ClientData[]>(CACHE_KEYS.KPI_DATA, CACHE_KEYS.KPI_TIMESTAMP);
    const cachedSelectedClient = localStorage.getItem(CACHE_KEYS.KPI_SELECTED_CLIENT);
    const cachedViewMode = localStorage.getItem(CACHE_KEYS.KPI_VIEW_MODE) as 'overview' | 'detail' || 'overview';

    if (kpiCache.data) {
      setKPIDashboard({
        clients: kpiCache.data,
        selectedClient: cachedSelectedClient,
        viewMode: cachedViewMode,
        lastUpdated: kpiCache.timestamp,
        loading: false,
        isUsingCache: true,
      });
      console.log('Loaded KPI dashboard from cache:', kpiCache.timestamp);
    }

    // Load Volume Dashboard from cache
    const volumeCache = loadFromCache<VolumeClientData[]>(CACHE_KEYS.VOLUME_DATA, CACHE_KEYS.VOLUME_TIMESTAMP);
    if (volumeCache.data) {
      setVolumeDashboard({
        clients: volumeCache.data,
        lastUpdated: volumeCache.timestamp,
        loading: false,
        isUsingCache: true,
      });
      console.log('Loaded Volume dashboard from cache:', volumeCache.timestamp);
    }

    // Load Revenue Dashboard from cache
    const revenueCache = loadFromCache<{ clients: RevenueClientData[], totals: RevenueTotals }>(CACHE_KEYS.REVENUE_DATA, CACHE_KEYS.REVENUE_TIMESTAMP);
    if (revenueCache.data) {
      setRevenueDashboard({
        clients: revenueCache.data.clients,
        totals: revenueCache.data.totals,
        lastUpdated: revenueCache.timestamp,
        loading: false,
        isUsingCache: true,
      });
      console.log('Loaded Revenue dashboard from cache:', revenueCache.timestamp);
    }

    // Fetch fresh data in background
    fetchKPIData(false);
    fetchVolumeData(false);
    fetchInfrastructureData(false);
    fetchRevenueData(false);

    // Set up auto-refresh interval (1 hour)
    const intervalId = setInterval(() => {
      console.log('Auto-refreshing all dashboards...');
      refreshAll();
    }, CACHE_DURATION);

    return () => clearInterval(intervalId);
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
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
};
