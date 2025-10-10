-- =====================================================
-- Update Daily Sending Targets for All Clients
-- =====================================================
-- Formula: 1,750 emails/day per 100 leads/month
-- Based on monthly_kpi_target
-- =====================================================

-- Kim Wallace: 200 leads/month = 3,500 emails/day
UPDATE client_registry SET daily_sending_target = 3500 WHERE workspace_name = 'Kim Wallace';

-- Jason Binyon: 200 leads/month = 3,500 emails/day
UPDATE client_registry SET daily_sending_target = 3500 WHERE workspace_name = 'Jason Binyon';

-- Nicholas Sakha: 300 leads/month = 5,250 emails/day
UPDATE client_registry SET daily_sending_target = 5250 WHERE workspace_name = 'Nick Sakha';

-- Jeff Schroder: 100 leads/month = 1,750 emails/day
UPDATE client_registry SET daily_sending_target = 1750 WHERE workspace_name = 'Jeff Schroder';

-- Rob Russell: 100 leads/month = 1,750 emails/day
UPDATE client_registry SET daily_sending_target = 1750 WHERE workspace_name = 'Rob Russell';

-- StreetSmart P&C: 100 leads/month = 1,750 emails/day
UPDATE client_registry SET daily_sending_target = 1750 WHERE workspace_name = 'StreetSmart P&C';

-- StreetSmart Trucking: 100 leads/month = 1,750 emails/day
UPDATE client_registry SET daily_sending_target = 1750 WHERE workspace_name = 'StreetSmart Trucking';

-- Kirk Hodgson: 50 leads/month = 875 emails/day
UPDATE client_registry SET daily_sending_target = 875 WHERE workspace_name = 'Kirk Hodgson';

-- SMA Insurance Services: 50 leads/month = 875 emails/day
UPDATE client_registry SET daily_sending_target = 875 WHERE workspace_name = 'SMA Insurance';

-- StreetSmart Commercial: 50 leads/month = 875 emails/day
UPDATE client_registry SET daily_sending_target = 875 WHERE workspace_name = 'StreetSmart Commercial';

-- Verify the updates
SELECT
  workspace_name,
  display_name,
  monthly_kpi_target,
  daily_sending_target,
  CASE
    WHEN monthly_kpi_target > 0 THEN (monthly_kpi_target / 100.0 * 1750)::INTEGER
    ELSE 0
  END as expected_daily_target,
  CASE
    WHEN daily_sending_target = (monthly_kpi_target / 100.0 * 1750)::INTEGER THEN '✓'
    ELSE '✗'
  END as correct
FROM client_registry
WHERE is_active = true
ORDER BY display_name;
