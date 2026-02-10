/**
 * Hook for fetching historical KPI data from client_metrics
 * 
 * When a past month is selected, queries the last available metric_date
 * for that month where metric_type='mtd' to get final month numbers.
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { transformToKPIClient } from '@/lib/fieldMappings';

interface HistoricalKPIState {
  clients: any[];
  loading: boolean;
  error: string | null;
  metricDate: string | null;
}

export function useHistoricalKPI() {
  const [state, setState] = useState<HistoricalKPIState>({
    clients: [],
    loading: false,
    error: null,
    metricDate: null,
  });

  const fetchHistoricalMonth = useCallback(async (year: number, month: number) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Build date range for the selected month
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      // Find the last available metric_date in that month
      const { data: lastDateRow, error: dateError } = await supabase
        .from('client_metrics')
        .select('metric_date')
        .eq('metric_type', 'mtd')
        .gte('metric_date', startDate)
        .lte('metric_date', endDate)
        .order('metric_date', { ascending: false })
        .limit(1)
        .single();

      if (dateError || !lastDateRow) {
        setState({
          clients: [],
          loading: false,
          error: 'No data available for this month',
          metricDate: null,
        });
        return;
      }

      const targetDate = lastDateRow.metric_date;

      // Fetch all client metrics for that date
      const { data: metrics, error: metricsError } = await supabase
        .from('client_metrics')
        .select(`
          *,
          client_registry!inner(
            workspace_name,
            display_name,
            monthly_kpi_target,
            monthly_sending_target,
            price_per_lead,
            is_active,
            kpi_dashboard_enabled
          )
        `)
        .eq('metric_type', 'mtd')
        .eq('metric_date', targetDate)
        .eq('client_registry.is_active', true)
        .eq('client_registry.kpi_dashboard_enabled', true)
        .order('positive_replies_mtd', { ascending: false });

      if (metricsError) throw metricsError;

      const transformedData = (metrics || []).map(row => transformToKPIClient(row));

      setState({
        clients: transformedData,
        loading: false,
        error: null,
        metricDate: targetDate,
      });
    } catch (error: any) {
      console.error('[Historical KPI] Error:', error);
      setState({
        clients: [],
        loading: false,
        error: error.message || 'Failed to fetch historical data',
        metricDate: null,
      });
    }
  }, []);

  return { ...state, fetchHistoricalMonth };
}
