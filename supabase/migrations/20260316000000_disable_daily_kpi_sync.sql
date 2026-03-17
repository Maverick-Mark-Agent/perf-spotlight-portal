-- =====================================================
-- DISABLE DAILY KPI METRICS SYNC CRON JOB
-- =====================================================
-- Purpose: Remove the nightly sync-daily-kpi-metrics cron job
-- Reason: The nightly sync from Bison stats API was causing lead count
--         drift between dashboards. We now use client_leads table
--         (populated by webhooks) as the single source of truth for
--         interested lead counts across all dashboards.
--
-- Note: The webhook increment_metric calls for emails_sent_mtd,
--       replies_mtd, bounces_mtd, and unsubscribes_mtd continue
--       working for the volume dashboard.
-- =====================================================

SELECT cron.unschedule('daily-kpi-metrics-sync');
