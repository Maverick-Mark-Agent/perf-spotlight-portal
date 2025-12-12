-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Trigger immediate sync of email accounts
SELECT extensions.http_post(
  url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/hybrid-email-accounts-v2',
  headers := jsonb_build_object(
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
) AS sync_response;

-- Display success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE '⏳ EMAIL SYNC TRIGGERED!';
  RAISE NOTICE '═══════════════════════════════════════════';
  RAISE NOTICE 'The sync is now running in the background.';
  RAISE NOTICE 'This will take 2-5 minutes for 5000+ accounts.';
  RAISE NOTICE '';
  RAISE NOTICE 'Wait 3-5 minutes, then check the dashboard!';
  RAISE NOTICE '═══════════════════════════════════════════';
END $$;
