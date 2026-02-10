-- ============================================
-- POPULATE CLIENT COSTS - October 2025
-- ============================================
-- Purpose: Populate infrastructure costs for all active clients
-- Month: 2025-10
--
-- Instructions:
-- 1. Fill in the cost values for each client below
-- 2. Cost Categories:
--    - email_account_costs: Cost of email accounts/domains for this client
--    - labor_costs: Labor costs allocated to this client
--    - other_costs: Any other infrastructure costs (software, tools, etc.)
-- 3. Run this SQL in Supabase SQL Editor or via psql
--
-- Note: total_costs is calculated automatically (no need to set it)
-- ============================================

-- Clear any existing October 2025 data (optional - remove if you want to keep existing)
-- DELETE FROM public.client_costs WHERE month_year = '2025-10';

-- ============================================
-- ACTIVE CLIENTS - OCTOBER 2025
-- ============================================

-- ATI
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('ATI', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- Boring Book Keeping
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('Boring Book Keeping', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- Danny Schwartz
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('Danny Schwartz', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- David Amiri
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('David Amiri', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- Devin Hodo
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('Devin Hodo', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- Gregg Blanchard
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('Gregg Blanchard', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- Jason Binyon
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('Jason Binyon', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- Jeff Schroder
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('Jeff Schroder', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- John Roberts
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('John Roberts', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- Kim Wallace
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('Kim Wallace', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- Kirk Hodgson
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('Kirk Hodgson', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- Koppa Analytics
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('Koppa Analytics', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- Littlegiant
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('Littlegiant', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- LongRun
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('LongRun', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- Maverick In-house
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('Maverick In-house', '2025-10', 0, 0, 0, 'Internal - no costs')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- Nick Sakha
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('Nick Sakha', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- Ozment Media
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('Ozment Media', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- Radiant Energy
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('Radiant Energy', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- Rob Russell
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('Rob Russell', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- Shane Miller
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('Shane Miller', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- SMA Insurance
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('SMA Insurance', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- StreetSmart Commercial
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('StreetSmart Commercial', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- StreetSmart P&C
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('StreetSmart P&C', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- StreetSmart Trucking
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('StreetSmart Trucking', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- Tony Schmitz
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('Tony Schmitz', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- Workspark
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES ('Workspark', '2025-10', 0, 0, 0, 'UPDATE COSTS')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check how many records were created
SELECT
  COUNT(*) as total_clients,
  month_year,
  SUM(total_costs) as total_monthly_costs
FROM public.client_costs
WHERE month_year = '2025-10'
GROUP BY month_year;

-- Show all client costs for October 2025
SELECT
  workspace_name,
  email_account_costs,
  labor_costs,
  other_costs,
  total_costs,
  notes
FROM public.client_costs
WHERE month_year = '2025-10'
ORDER BY workspace_name;
