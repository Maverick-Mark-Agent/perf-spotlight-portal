-- ═══════════════════════════════════════════════════════════
-- SYNC DATA FROM email_accounts_raw TO sender_emails_cache
-- ═══════════════════════════════════════════════════════════

-- Step 1: Check current data freshness
SELECT 'sender_emails_cache' as table_name,
  COUNT(*) as total_rows,
  MAX(last_synced_at) as most_recent_sync,
  EXTRACT(EPOCH FROM (NOW() - MAX(last_synced_at)))/3600 as hours_old
FROM sender_emails_cache

UNION ALL

SELECT 'email_accounts_raw' as table_name,
  COUNT(*) as total_rows,
  MAX(last_synced_at) as most_recent_sync,
  EXTRACT(EPOCH FROM (NOW() - MAX(last_synced_at)))/3600 as hours_old
FROM email_accounts_raw;

-- Step 2: Copy matching data from email_accounts_raw to sender_emails_cache
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
  reply_rate_percentage,
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
  reply_rate_percentage,
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
WHERE deleted_at IS NULL  -- Only copy active accounts
ON CONFLICT (email_address)
DO UPDATE SET
  workspace_name = EXCLUDED.workspace_name,
  bison_workspace_id = EXCLUDED.bison_workspace_id,
  bison_instance = EXCLUDED.bison_instance,
  emails_sent_count = EXCLUDED.emails_sent_count,
  total_replied_count = EXCLUDED.total_replied_count,
  unique_replied_count = EXCLUDED.unique_replied_count,
  bounced_count = EXCLUDED.bounced_count,
  unsubscribed_count = EXCLUDED.unsubscribed_count,
  interested_leads_count = EXCLUDED.interested_leads_count,
  total_leads_contacted_count = EXCLUDED.total_leads_contacted_count,
  reply_rate_percentage = EXCLUDED.reply_rate_percentage,
  status = EXCLUDED.status,
  daily_limit = EXCLUDED.daily_limit,
  account_type = EXCLUDED.account_type,
  email_provider = EXCLUDED.email_provider,
  reseller = EXCLUDED.reseller,
  domain = EXCLUDED.domain,
  price = EXCLUDED.price,
  volume_per_account = EXCLUDED.volume_per_account,
  last_synced_at = NOW(),
  updated_at = NOW();

-- Step 3: Verify the sync worked
SELECT
  COUNT(*) as total_accounts,
  MAX(last_synced_at) as most_recent_sync,
  EXTRACT(EPOCH FROM (NOW() - MAX(last_synced_at)))/60 as minutes_old,
  MIN(last_synced_at) as oldest_sync
FROM sender_emails_cache;

-- Step 4: Show sample of fresh data
SELECT
  email_address,
  workspace_name,
  emails_sent_count,
  total_replied_count,
  CASE
    WHEN emails_sent_count > 0
    THEN ROUND((total_replied_count::numeric / emails_sent_count::numeric * 100), 2)
    ELSE 0
  END as calculated_reply_rate,
  last_synced_at
FROM sender_emails_cache
ORDER BY last_synced_at DESC
LIMIT 10;
