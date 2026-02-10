-- Check what columns are in email_accounts_view
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'email_accounts_view'
AND column_name IN ('email_provider', 'reseller')
ORDER BY ordinal_position;
