-- Fix unique constraint for email_accounts_raw
-- Issue: bison_account_id is unique per-instance, not globally
-- Some accounts exist in both Maverick and Long Run instances

-- Drop the single-column unique constraint
ALTER TABLE public.email_accounts_raw
  DROP CONSTRAINT IF EXISTS email_accounts_raw_bison_account_id_key;

-- The composite unique constraint already exists from migration 20251009220000
-- It's defined as: CONSTRAINT unique_bison_account UNIQUE (bison_account_id, bison_instance)
-- So we're good - just needed to remove the conflicting single-column constraint

-- Verify the correct constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'unique_bison_account'
    AND conrelid = 'public.email_accounts_raw'::regclass
  ) THEN
    RAISE EXCEPTION 'Composite unique constraint missing - check migration 20251009220000';
  END IF;
END $$;
