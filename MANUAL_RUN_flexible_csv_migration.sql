-- =====================================================
-- ADD FLEXIBLE CSV SUPPORT
-- =====================================================
-- This migration adds support for ANY CSV format by:
-- 1. Adding a JSONB column to store extra/unmapped fields
-- 2. Adding a column to store the original CSV headers
-- 3. Relaxing the email constraint (not all CSVs require email)
-- =====================================================

-- Add JSONB column for extra fields
ALTER TABLE public.raw_contacts
ADD COLUMN IF NOT EXISTS extra_fields JSONB DEFAULT '{}'::jsonb;

-- Add column to store original CSV column mapping
ALTER TABLE public.raw_contacts
ADD COLUMN IF NOT EXISTS csv_column_mapping JSONB;

-- Relax email constraint (make it nullable, validate only if present)
ALTER TABLE public.raw_contacts
DROP CONSTRAINT IF EXISTS valid_email;

-- Add new constraint that validates email only if it's not null
ALTER TABLE public.raw_contacts
ADD CONSTRAINT valid_email_if_present
CHECK (email IS NULL OR email ~ '^[^@]+@[^@]+\.[^@]+$');

-- Add index on extra_fields for faster JSON queries
CREATE INDEX IF NOT EXISTS idx_raw_contacts_extra_fields
ON public.raw_contacts USING GIN (extra_fields);

COMMENT ON COLUMN public.raw_contacts.extra_fields
IS 'JSONB storage for any CSV columns that don''t map to standard fields (e.g., Phone, DNC, Race, Net Worth, etc.)';

COMMENT ON COLUMN public.raw_contacts.csv_column_mapping
IS 'Maps original CSV column names to database fields for audit trail';

-- Same changes for verified_contacts
ALTER TABLE public.verified_contacts
ADD COLUMN IF NOT EXISTS extra_fields JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_verified_contacts_extra_fields
ON public.verified_contacts USING GIN (extra_fields);

COMMENT ON COLUMN public.verified_contacts.extra_fields
IS 'JSONB storage for extra CSV fields carried forward from raw_contacts';
