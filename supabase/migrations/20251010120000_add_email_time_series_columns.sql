-- Add email time-series columns to client_metrics table
-- These columns store email sending volume for different time periods
-- Needed for Volume Dashboard rolling windows

ALTER TABLE public.client_metrics
  ADD COLUMN IF NOT EXISTS emails_sent_today INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emails_sent_last_7_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emails_sent_last_14_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emails_sent_last_30_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emails_scheduled_today INTEGER DEFAULT 0;

COMMENT ON COLUMN public.client_metrics.emails_sent_today IS 'Emails sent today (from midnight to now)';
COMMENT ON COLUMN public.client_metrics.emails_sent_last_7_days IS 'Total emails sent in last 7 days';
COMMENT ON COLUMN public.client_metrics.emails_sent_last_14_days IS 'Total emails sent in last 14 days';
COMMENT ON COLUMN public.client_metrics.emails_sent_last_30_days IS 'Total emails sent in last 30 days';
COMMENT ON COLUMN public.client_metrics.emails_scheduled_today IS 'Emails scheduled to be sent today (future)';
