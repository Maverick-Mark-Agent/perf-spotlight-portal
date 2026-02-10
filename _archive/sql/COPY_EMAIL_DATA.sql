-- ═══════════════════════════════════════════════════════════
-- COPY DATA FROM email_accounts_raw TO sender_emails_cache
-- ═══════════════════════════════════════════════════════════
-- This will sync the data between the two tables
-- ═══════════════════════════════════════════════════════════

-- Check what data exists in email_accounts_raw
SELECT
  COUNT(*) as total_accounts,
  MAX(updated_at) as most_recent_update,
  EXTRACT(EPOCH FROM (NOW() - MAX(updated_at)))/3600 as hours_old
FROM email_accounts_raw;

-- If email_accounts_raw has fresh data, copy it to sender_emails_cache
INSERT INTO sender_emails_cache (
  email_address,
  workspace_name,
  emails_sent_count,
  total_replied_count,
  total_connected_count,
  total_interested_count,
  total_not_interested_count,
  total_do_not_contact_count,
  total_unsubscribed_count,
  total_email_bounced_count,
  total_wrong_person_count,
  disconnected_count,
  is_disconnected,
  last_synced_at
)
SELECT
  email_address,
  workspace_name,
  emails_sent_count,
  total_replied_count,
  total_connected_count,
  total_interested_count,
  total_not_interested_count,
  total_do_not_contact_count,
  total_unsubscribed_count,
  total_email_bounced_count,
  total_wrong_person_count,
  disconnected_count,
  is_disconnected,
  NOW() as last_synced_at
FROM email_accounts_raw
ON CONFLICT (email_address)
DO UPDATE SET
  workspace_name = EXCLUDED.workspace_name,
  emails_sent_count = EXCLUDED.emails_sent_count,
  total_replied_count = EXCLUDED.total_replied_count,
  total_connected_count = EXCLUDED.total_connected_count,
  total_interested_count = EXCLUDED.total_interested_count,
  total_not_interested_count = EXCLUDED.total_not_interested_count,
  total_do_not_contact_count = EXCLUDED.total_do_not_contact_count,
  total_unsubscribed_count = EXCLUDED.total_unsubscribed_count,
  total_email_bounced_count = EXCLUDED.total_email_bounced_count,
  total_wrong_person_count = EXCLUDED.total_wrong_person_count,
  disconnected_count = EXCLUDED.disconnected_count,
  is_disconnected = EXCLUDED.is_disconnected,
  last_synced_at = NOW();

-- Verify the copy worked
SELECT
  COUNT(*) as total_accounts,
  MAX(last_synced_at) as most_recent_sync,
  EXTRACT(EPOCH FROM (NOW() - MAX(last_synced_at)))/60 as minutes_old
FROM sender_emails_cache;
