-- =====================================================
-- Update Client Monthly Sending Targets
-- Date: 2025-10-12
-- =====================================================
-- Changes per user request:
--   - Maverick In-house: 30,000 → 0
--   - Gregg Blanchard: 45,000 → 30,000
--   - Koppa Analytics: 45,000 → 0
--   - Littlegiant: 45,000 → 0
--   - Ozment Media: 45,000 → 0
--   - ATI: 45,000 → 0
--   - Boring Book Keeping: 45,000 → 0
--
-- Impact: Total monthly target reduced from 1,260,000 to 990,000
-- =====================================================

-- Update 6 clients to 0
UPDATE client_registry
SET monthly_sending_target = 0,
    updated_at = NOW()
WHERE workspace_name IN (
  'Maverick In-house',
  'Koppa Analytics',
  'Littlegiant',
  'Ozment Media',
  'ATI',
  'Boring Book Keeping'
);

-- Update Gregg Blanchard to 30,000
UPDATE client_registry
SET monthly_sending_target = 30000,
    updated_at = NOW()
WHERE workspace_name = 'Gregg Blanchard';

-- Verify changes
SELECT
  workspace_name,
  monthly_sending_target as new_target,
  updated_at
FROM client_registry
WHERE workspace_name IN (
  'Maverick In-house',
  'Gregg Blanchard',
  'Koppa Analytics',
  'Littlegiant',
  'Ozment Media',
  'ATI',
  'Boring Book Keeping'
)
ORDER BY workspace_name;
