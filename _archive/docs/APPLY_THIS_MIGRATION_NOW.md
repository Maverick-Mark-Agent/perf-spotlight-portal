# 🚨 URGENT: Apply This Migration to Enable Kim Wallace Processing

## What This Does
This migration adds support for ANY CSV format by adding flexible JSONB columns to store extra fields that don't map to standard database columns.

## How to Apply

### Step 1: Go to Supabase SQL Editor
Open this URL in your browser:
https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new

### Step 2: Copy and Paste This SQL

```sql
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
```

### Step 3: Click "Run" (or press Cmd+Enter)

You should see: `Success. No rows returned`

## After Migration is Applied

Once you've run this migration, let me know and I'll immediately process Kim Wallace's 43,177 contacts from the CSV file in storage. The system will:

1. ✅ Accept all 23 columns from the CSV
2. ✅ Map standard fields (name, address, email, home value, etc.)
3. ✅ Store extra fields (Phone, DNC, Race, Net Worth, etc.) in JSONB
4. ✅ Route HNW contacts (TX + ≥$900k) to Kirk Hodgson
5. ✅ Keep standard contacts with Kim Wallace

## Why Manual?

The programmatic SQL execution methods aren't working due to authentication restrictions, so manual execution via the Supabase dashboard is the fastest path forward.
