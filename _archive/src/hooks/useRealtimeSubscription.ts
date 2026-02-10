/**
 * Real-Time Subscription Hooks
 *
 * Subscribes to Supabase Realtime for instant database updates.
 * Updates dashboards automatically when webhooks fire.
 *
 * @file src/hooks/useRealtimeSubscription.ts
 * @created 2025-10-09
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

// ============= Client Metrics Subscription =============

/**
 * Subscribe to client_metrics table changes (KPI + Volume dashboards)
 *
 * Usage:
 * ```typescript
 * const { data, loading, error } = useRealtimeClientMetrics();
 * ```
 */
export function useRealtimeClientMetrics(workspaceName?: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    console.log('[Realtime] Subscribing to client_metrics changes...');

    // Subscribe to postgres changes
    const channel = supabase
      .channel('client-metrics-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'client_metrics',
          filter: workspaceName ? `workspace_name=eq.${workspaceName}` : undefined,
        },
        (payload) => {
          console.log('[Realtime] client_metrics update:', payload);

          // Handle different event types
          if (payload.eventType === 'INSERT') {
            setData((current) => [...current, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setData((current) =>
              current.map((row) =>
                row.workspace_name === payload.new.workspace_name ? payload.new : row
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setData((current) =>
              current.filter((row) => row.workspace_name !== payload.old.workspace_name)
            );
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setLoading(false);
        }
        if (status === 'CHANNEL_ERROR') {
          setError('Failed to subscribe to real-time updates');
          setLoading(false);
        }
      });

    channelRef.current = channel;

    // Cleanup subscription on unmount
    return () => {
      console.log('[Realtime] Unsubscribing from client_metrics...');
      supabase.removeChannel(channel);
    };
  }, [workspaceName]);

  return { data, loading, error };
}

// ============= Sender Emails Subscription =============

/**
 * Subscribe to sender_emails_cache table changes (Email Infrastructure dashboard)
 *
 * Usage:
 * ```typescript
 * const { data, loading } = useRealtimeSenderEmails();
 * ```
 */
export function useRealtimeSenderEmails() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Debounce updates to avoid excessive re-renders
  const updateDataDebounced = useCallback((newData: any) => {
    const updateId = setTimeout(() => {
      setData((current) => {
        const existing = current.find((row) => row.id === newData.id);
        if (existing) {
          return current.map((row) => (row.id === newData.id ? newData : row));
        } else {
          return [...current, newData];
        }
      });
      setLastUpdate(new Date());
    }, 500); // 500ms debounce

    return () => clearTimeout(updateId);
  }, []);

  useEffect(() => {
    console.log('[Realtime] Subscribing to sender_emails_cache changes...');

    const channel = supabase
      .channel('sender-emails-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sender_emails_cache',
        },
        (payload) => {
          console.log('[Realtime] sender_emails_cache update:', payload.eventType);

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            updateDataDebounced(payload.new);
          } else if (payload.eventType === 'DELETE') {
            setData((current) => current.filter((row) => row.id !== payload.old.id));
            setLastUpdate(new Date());
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setLoading(false);
        }
        if (status === 'CHANNEL_ERROR') {
          setError('Failed to subscribe to real-time updates');
          setLoading(false);
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[Realtime] Unsubscribing from sender_emails_cache...');
      supabase.removeChannel(channel);
    };
  }, [updateDataDebounced]);

  return { data, loading, error, lastUpdate };
}

// ============= Client Leads Subscription =============

/**
 * Subscribe to client_leads table changes (Client Portal)
 *
 * Usage:
 * ```typescript
 * const { data: newLeads, loading } = useRealtimeLeads('John Roberts');
 * ```
 */
export function useRealtimeLeads(workspaceName: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newLeadCount, setNewLeadCount] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!workspaceName) {
      setLoading(false);
      return;
    }

    console.log(`[Realtime] Subscribing to client_leads for workspace: ${workspaceName}`);

    const channel = supabase
      .channel(`client-leads-${workspaceName}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'client_leads',
          filter: `workspace_name=eq.${workspaceName}`,
        },
        (payload) => {
          console.log('[Realtime] New lead received:', payload.new);

          // Only add interested leads
          if (payload.new.interested) {
            setData((current) => [payload.new, ...current]);
            setNewLeadCount((count) => count + 1);

            // Show notification (optional)
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('New Lead!', {
                body: `${payload.new.lead_email} is interested`,
                icon: '/favicon.ico',
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'client_leads',
          filter: `workspace_name=eq.${workspaceName}`,
        },
        (payload) => {
          console.log('[Realtime] Lead updated:', payload.new);

          setData((current) =>
            current.map((lead) =>
              lead.id === payload.new.id ? payload.new : lead
            )
          );
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setLoading(false);
        }
        if (status === 'CHANNEL_ERROR') {
          setError('Failed to subscribe to real-time updates');
          setLoading(false);
        }
      });

    channelRef.current = channel;

    return () => {
      console.log(`[Realtime] Unsubscribing from client_leads for ${workspaceName}...`);
      supabase.removeChannel(channel);
    };
  }, [workspaceName]);

  // Request notification permission if not already granted
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const clearNewLeadCount = useCallback(() => {
    setNewLeadCount(0);
  }, []);

  return { data, loading, error, newLeadCount, clearNewLeadCount };
}

// ============= Generic Table Subscription =============

/**
 * Generic subscription hook for any table
 *
 * Usage:
 * ```typescript
 * const { data, loading } = useRealtimeTable('webhook_delivery_log');
 * ```
 */
export function useRealtimeTable(tableName: string, filter?: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    console.log(`[Realtime] Subscribing to ${tableName} changes...`);

    const channel = supabase
      .channel(`${tableName}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter,
        },
        (payload) => {
          console.log(`[Realtime] ${tableName} update:`, payload);

          if (payload.eventType === 'INSERT') {
            setData((current) => [payload.new, ...current]);
          } else if (payload.eventType === 'UPDATE') {
            setData((current) =>
              current.map((row) =>
                row.id === payload.new.id ? payload.new : row
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setData((current) => current.filter((row) => row.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setLoading(false);
        }
        if (status === 'CHANNEL_ERROR') {
          setError('Failed to subscribe to real-time updates');
          setLoading(false);
        }
      });

    channelRef.current = channel;

    return () => {
      console.log(`[Realtime] Unsubscribing from ${tableName}...`);
      supabase.removeChannel(channel);
    };
  }, [tableName, filter]);

  return { data, loading, error };
}

// ============= System Health Subscription =============

/**
 * Subscribe to webhook_health table for system status
 */
export function useSystemHealth() {
  const [health, setHealth] = useState({
    webhookStatus: 'unknown' as 'healthy' | 'degraded' | 'down' | 'unknown',
    pollingStatus: 'unknown' as 'healthy' | 'degraded' | 'down' | 'unknown',
    lastWebhook: null as Date | null,
    lastPolling: null as Date | null,
  });

  useEffect(() => {
    // Initial health check
    checkHealth();

    // Subscribe to webhook_health updates
    const channel = supabase
      .channel('webhook-health-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'webhook_health',
        },
        (payload) => {
          console.log('[Realtime] Webhook health update:', payload);
          checkHealth();
        }
      )
      .subscribe();

    // Poll health every minute
    const interval = setInterval(checkHealth, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const checkHealth = async () => {
    try {
      // Check latest webhook
      const { data: latestWebhook } = await supabase
        .from('webhook_delivery_log')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Check latest polling
      const { data: latestPolling } = await supabase
        .from('sender_emails_cache')
        .select('last_synced_at')
        .order('last_synced_at', { ascending: false })
        .limit(1)
        .single();

      const webhookAge = latestWebhook
        ? (Date.now() - new Date(latestWebhook.created_at).getTime()) / 1000 / 60
        : 999;

      const pollingAge = latestPolling
        ? (Date.now() - new Date(latestPolling.last_synced_at).getTime()) / 1000 / 60
        : 999;

      setHealth({
        webhookStatus: webhookAge < 60 ? 'healthy' : webhookAge < 180 ? 'degraded' : 'down',
        pollingStatus: pollingAge < 10 ? 'healthy' : pollingAge < 30 ? 'degraded' : 'down',
        lastWebhook: latestWebhook ? new Date(latestWebhook.created_at) : null,
        lastPolling: latestPolling ? new Date(latestPolling.last_synced_at) : null,
      });
    } catch (error) {
      console.error('[Health Check] Error:', error);
    }
  };

  return health;
}
