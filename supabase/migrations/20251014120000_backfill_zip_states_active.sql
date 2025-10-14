-- =====================================================
-- Backfill missing states for ZIPs in staging area
-- =====================================================
-- This migration uses the ZIP prefix mapping to populate
-- the state field for all ZIPs with month='active'
-- =====================================================

DO $$
DECLARE
  zip_record RECORD;
  zip_prefix TEXT;
  mapped_state TEXT;
  updated_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting state backfill for staging ZIPs...';

  -- Loop through all ZIPs without states in staging
  FOR zip_record IN
    SELECT id, zip
    FROM public.client_zipcodes
    WHERE month = 'active' AND state IS NULL
  LOOP
    -- Get 3-digit prefix
    zip_prefix := SUBSTRING(zip_record.zip FROM 1 FOR 3);

    -- Map to state (Texas ZIPs: 750-799, 885)
    mapped_state := CASE
      -- Texas
      WHEN zip_prefix BETWEEN '750' AND '799' THEN 'TX'
      WHEN zip_prefix = '885' THEN 'TX'
      -- California
      WHEN zip_prefix BETWEEN '900' AND '961' THEN 'CA'
      -- Illinois
      WHEN zip_prefix BETWEEN '600' AND '629' THEN 'IL'
      -- Add other states as needed based on zipStateMapping.ts
      ELSE NULL
    END;

    -- Update if we found a mapping
    IF mapped_state IS NOT NULL THEN
      UPDATE public.client_zipcodes
      SET state = mapped_state
      WHERE id = zip_record.id;

      updated_count := updated_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill complete: Updated % ZIPs with states', updated_count;
END $$;

-- Verify results
DO $$
DECLARE
  total_count INTEGER;
  with_state_count INTEGER;
  without_state_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count
  FROM public.client_zipcodes
  WHERE month = 'active';

  SELECT COUNT(*) INTO with_state_count
  FROM public.client_zipcodes
  WHERE month = 'active' AND state IS NOT NULL;

  SELECT COUNT(*) INTO without_state_count
  FROM public.client_zipcodes
  WHERE month = 'active' AND state IS NULL;

  RAISE NOTICE 'Verification:';
  RAISE NOTICE '  Total staging ZIPs: %', total_count;
  RAISE NOTICE '  With state: %', with_state_count;
  RAISE NOTICE '  Without state: %', without_state_count;
END $$;
