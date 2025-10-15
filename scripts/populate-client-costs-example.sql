-- ============================================
-- POPULATE CLIENT COSTS - October 2025 (WITH EXAMPLE VALUES)
-- ============================================
-- Purpose: Example of populated costs showing realistic values
-- Month: 2025-10
--
-- Cost Guidelines:
-- - Small clients (0-50 leads/month): $50-150 email costs, $200-500 labor
-- - Medium clients (50-100 leads/month): $150-300 email costs, $500-1000 labor
-- - Large clients (100+ leads/month): $300-500 email costs, $1000-2000 labor
-- - Retainer clients: Higher labor costs due to dedicated support
-- ============================================

-- Delete existing October 2025 data (if any)
DELETE FROM public.client_costs WHERE month_year = '2025-10';

-- High Revenue Clients (Retainers + Top Per-Lead)
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES
  ('Shane Miller', '2025-10', 200.00, 500.00, 50.00, 'Retainer - dedicated support'),
  ('SMA Insurance', '2025-10', 180.00, 600.00, 40.00, 'Retainer - 13 leads MTD'),
  ('StreetSmart Commercial', '2025-10', 150.00, 450.00, 30.00, 'Retainer - 20 leads MTD'),
  ('Kirk Hodgson', '2025-10', 150.00, 400.00, 25.00, 'Retainer - 7 leads MTD'),
  ('StreetSmart Trucking', '2025-10', 120.00, 350.00, 20.00, 'Retainer - low volume'),
  ('David Amiri', '2025-10', 180.00, 450.00, 35.00, 'Per-Lead - 32 leads MTD - High volume'),
  ('Danny Schwartz', '2025-10', 160.00, 400.00, 30.00, 'Per-Lead - 26 leads MTD'),
  ('Devin Hodo', '2025-10', 150.00, 380.00, 28.00, 'Per-Lead - 23 leads MTD'),

  -- Medium Revenue Clients
  ('Nick Sakha', '2025-10', 140.00, 350.00, 25.00, 'Per-Lead - 19 leads MTD'),
  ('Kim Wallace', '2025-10', 150.00, 380.00, 30.00, 'Per-Lead - 21 leads MTD'),
  ('Jason Binyon', '2025-10', 140.00, 370.00, 28.00, 'Per-Lead - 21 leads MTD'),
  ('John Roberts', '2025-10', 120.00, 300.00, 20.00, 'Per-Lead - 12 leads MTD'),
  ('Rob Russell', '2025-10', 110.00, 280.00, 18.00, 'Per-Lead - 11 leads MTD'),

  -- Lower Volume / New Clients
  ('StreetSmart P&C', '2025-10', 100.00, 250.00, 15.00, 'Per-Lead - 1 lead MTD - new client'),
  ('Gregg Blanchard', '2025-10', 80.00, 200.00, 12.00, 'Per-Lead - 0 leads MTD - new setup'),
  ('Tony Schmitz', '2025-10', 90.00, 220.00, 15.00, 'Per-Lead - 0 leads MTD - ramping up'),
  ('Jeff Schroder', '2025-10', 85.00, 210.00, 13.00, 'Retainer - 1 lead MTD'),

  -- Inactive/Testing Accounts
  ('Koppa Analytics', '2025-10', 50.00, 100.00, 5.00, 'API error - minimal activity'),
  ('Littlegiant', '2025-10', 50.00, 100.00, 5.00, 'API error - minimal activity'),
  ('Ozment Media', '2025-10', 50.00, 100.00, 5.00, 'API error - minimal activity'),
  ('Radiant Energy', '2025-10', 50.00, 100.00, 5.00, 'API error - minimal activity'),
  ('ATI', '2025-10', 50.00, 100.00, 5.00, 'API error - minimal activity'),
  ('Boring Book Keeping', '2025-10', 50.00, 100.00, 5.00, 'API error - minimal activity'),
  ('LongRun', '2025-10', 50.00, 100.00, 5.00, 'API error - minimal activity'),

  -- Internal / Special Accounts
  ('Maverick In-house', '2025-10', 0.00, 0.00, 0.00, 'Internal testing - no costs allocated'),
  ('Workspark', '2025-10', 75.00, 180.00, 10.00, 'Special client - reduced rates');

-- ============================================
-- VERIFICATION
-- ============================================

-- Check summary stats
SELECT
  COUNT(*) as total_clients,
  month_year,
  SUM(email_account_costs) as total_email_costs,
  SUM(labor_costs) as total_labor_costs,
  SUM(other_costs) as total_other_costs,
  SUM(total_costs) as total_monthly_costs,
  ROUND(AVG(total_costs), 2) as avg_cost_per_client
FROM public.client_costs
WHERE month_year = '2025-10'
GROUP BY month_year;

-- Show all client costs for October 2025 sorted by total cost
SELECT
  workspace_name,
  email_account_costs,
  labor_costs,
  other_costs,
  total_costs,
  notes
FROM public.client_costs
WHERE month_year = '2025-10'
ORDER BY total_costs DESC;

-- Show impact on profitability (if we could join with revenue data)
SELECT
  'Example: Shane Miller' as client,
  2175.00 as revenue,
  (SELECT total_costs FROM client_costs WHERE workspace_name = 'Shane Miller' AND month_year = '2025-10') as costs,
  2175.00 - (SELECT total_costs FROM client_costs WHERE workspace_name = 'Shane Miller' AND month_year = '2025-10') as profit,
  ROUND(((2175.00 - (SELECT total_costs FROM client_costs WHERE workspace_name = 'Shane Miller' AND month_year = '2025-10')) / 2175.00) * 100, 1) as profit_margin;
