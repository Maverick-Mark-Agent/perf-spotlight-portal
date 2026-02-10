-- ===================================================================
-- VERIFY SYNC COMPLETED - Run this to check if sync worked
-- ===================================================================
-- INSTRUCTIONS:
-- 1. Wait 3-5 minutes after running TRIGGER_IMMEDIATE_SYNC.sql
-- 2. Open: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new
-- 3. Copy this script
-- 4. Paste and click "RUN"
-- ===================================================================

SELECT
  '✅ VERIFICATION RESULTS' as status,
  MAX(last_synced_at) as most_recent_sync,
  COUNT(*) as total_accounts,
  ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(last_synced_at)))/60, 1) as minutes_old
FROM sender_emails_cache
WHERE last_synced_at IS NOT NULL;

-- Check if sync was successful
DO $$
DECLARE
  minutes_old NUMERIC;
  total_accounts INTEGER;
  recent_sync TIMESTAMP;
BEGIN
  SELECT
    EXTRACT(EPOCH FROM (NOW() - MAX(last_synced_at)))/60,
    COUNT(*),
    MAX(last_synced_at)
  INTO minutes_old, total_accounts, recent_sync
  FROM sender_emails_cache
  WHERE last_synced_at IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════════';

  IF minutes_old < 10 THEN
    RAISE NOTICE '🎉 SUCCESS! EMAIL SYNC COMPLETED!';
    RAISE NOTICE '══════════════════════════════════════════════════════════';
    RAISE NOTICE 'Total Accounts: %', total_accounts;
    RAISE NOTICE 'Last Synced: %', recent_sync;
    RAISE NOTICE 'Age: % minutes old', ROUND(minutes_old, 1);
    RAISE NOTICE '';
    RAISE NOTICE '✅ FINAL STEPS:';
    RAISE NOTICE '1. Go to: https://www.maverickmarketingllc.com/email-accounts';
    RAISE NOTICE '2. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)';
    RAISE NOTICE '3. Check "Last synced" shows recent time';
    RAISE NOTICE '4. Look for "Burnt Mailboxes" alert in Action Items';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Automatic syncing enabled (every 30 minutes)';
  ELSIF minutes_old < 60 THEN
    RAISE NOTICE '⏳ SYNC IN PROGRESS (% minutes old)', ROUND(minutes_old, 1);
    RAISE NOTICE '══════════════════════════════════════════════════════════';
    RAISE NOTICE 'Wait 2-3 more minutes and run this script again.';
  ELSE
    RAISE NOTICE '❌ SYNC MAY HAVE FAILED (% minutes old)', ROUND(minutes_old, 1);
    RAISE NOTICE '══════════════════════════════════════════════════════════';
    RAISE NOTICE 'Data is still old. Check Edge Function logs:';
    RAISE NOTICE 'https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions/hybrid-email-accounts-v2/logs';
    RAISE NOTICE '';
    RAISE NOTICE 'Or try running TRIGGER_IMMEDIATE_SYNC.sql again';
  END IF;

  RAISE NOTICE '══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
