-- ═══════════════════════════════════════════════════════════
-- SIMPLE SYNC: Clear and reload sender_emails_cache
-- ═══════════════════════════════════════════════════════════

-- Step 1: Check current data
SELECT 'BEFORE SYNC' as status,
  'sender_emails_cache' as table_name,
  COUNT(*) as total_rows,
  MAX(last_synced_at) as most_recent_sync,
  ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(last_synced_at)))/3600, 1) as hours_old
FROM sender_emails_cache

UNION ALL

SELECT 'BEFORE SYNC' as status,
  'email_accounts_raw' as table_name,
  COUNT(*) as total_rows,
  MAX(last_synced_at) as most_recent_sync,
  ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(last_synced_at)))/3600, 1) as hours_old
FROM email_accounts_raw;

-- Step 2: Delete old data from sender_emails_cache
DELETE FROM sender_emails_cache;

-- Step 3: Insert fresh data from email_accounts_raw
INSERT INTO sender_emails_cache (
  email_address,
  workspace_name,
  bison_workspace_id,
  bison_instance,
  emails_sent_count,
  total_replied_count,
  unique_replied_count,
  bounced_count,
  unsubscribed_count,
  interested_leads_count,
  total_leads_contacted_count,
  status,
  daily_limit,
  account_type,
  email_provider,
  reseller,
  domain,
  price,
  volume_per_account,
  last_synced_at
)
SELECT
  email_address,
  workspace_name,
  workspace_id as bison_workspace_id,
  bison_instance,
  emails_sent_count,
  total_replied_count,
  unique_replied_count,
  bounced_count,
  unsubscribed_count,
  interested_leads_count,
  total_leads_contacted_count,
  status,
  daily_limit,
  account_type,
  email_provider,
  reseller,
  domain,
  price,
  volume_per_account,
  NOW() as last_synced_at
FROM email_accounts_raw
WHERE deleted_at IS NULL;

-- Step 4: Verify the sync
SELECT 'AFTER SYNC' as status,
  COUNT(*) as total_accounts,
  MAX(last_synced_at) as most_recent_sync,
  ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(last_synced_at)))/60, 1) as minutes_old
FROM sender_emails_cache;

-- Step 5: Preview burnt mailboxes (< 0.4% reply rate with 200+ sent)
SELECT
  'BURNT MAILBOXES PREVIEW' as category,
  COUNT(*) as burnt_accounts_count
FROM sender_emails_cache
WHERE emails_sent_count >= 200
  AND reply_rate_percentage < 0.4;

-- Step 6: Show sample burnt mailboxes
SELECT
  email_address,
  workspace_name,
  emails_sent_count,
  total_replied_count,
  reply_rate_percentage,
  status
FROM sender_emails_cache
WHERE emails_sent_count >= 200
  AND reply_rate_percentage < 0.4
ORDER BY emails_sent_count DESC
LIMIT 10;

-- Step 7: Success message
DO $$
DECLARE
  total_count INTEGER;
  burnt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM sender_emails_cache;
  SELECT COUNT(*) INTO burnt_count FROM sender_emails_cache
    WHERE emails_sent_count >= 200 AND reply_rate_percentage < 0.4;

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ EMAIL SYNC COMPLETE!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Results:';
  RAISE NOTICE '   Total accounts synced: %', total_count;
  RAISE NOTICE '   Burnt mailboxes found: %', burnt_count;
  RAISE NOTICE '';
  RAISE NOTICE '📋 NEXT STEPS:';
  RAISE NOTICE '1. Go to: https://www.maverickmarketingllc.com/email-accounts';
  RAISE NOTICE '2. Hard refresh: Cmd+Shift+R';
  RAISE NOTICE '3. Check burnt mailbox alert appears';
  RAISE NOTICE '4. Test CSV export';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;
