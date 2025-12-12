-- ===================================================================
-- TRIGGER IMMEDIATE SYNC - Run this AFTER the setup script
-- ===================================================================
-- INSTRUCTIONS:
-- 1. Make sure you ran FINAL_SYNC_FIX.sql first
-- 2. Open: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new
-- 3. Copy this script
-- 4. Paste and click "RUN"
-- 5. Wait 2-5 minutes for sync to complete
-- ===================================================================

SELECT extensions.http_post(
  url := current_setting('app.settings.supabase_url', true) || '/functions/v1/hybrid-email-accounts-v2',
  headers := json_build_object(
    'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
    'Content-Type', 'application/json',
    'x-triggered-by', 'manual'
  )::jsonb,
  body := '{}'::jsonb
) AS sync_response;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════════';
  RAISE NOTICE '⏳ SYNC TRIGGERED!';
  RAISE NOTICE '══════════════════════════════════════════════════════════';
  RAISE NOTICE 'The sync is now running in the background.';
  RAISE NOTICE 'Processing 5000+ email accounts from Email Bison API.';
  RAISE NOTICE '';
  RAISE NOTICE 'ESTIMATED TIME: 2-5 minutes';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Wait 3-5 minutes';
  RAISE NOTICE '2. Run VERIFY_SYNC.sql to check if complete';
  RAISE NOTICE '══════════════════════════════════════════════════════════';
END $$;
