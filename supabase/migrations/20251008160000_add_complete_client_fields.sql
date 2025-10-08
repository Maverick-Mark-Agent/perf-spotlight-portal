-- =====================================================
-- Add Complete Client Configuration Fields
-- =====================================================
-- This migration adds all missing fields needed by dashboards
-- to make client_registry the single source of truth
-- =====================================================

-- Add Lead Generation fields
ALTER TABLE public.client_registry
ADD COLUMN IF NOT EXISTS lead_tier TEXT CHECK (lead_tier IN ('100_leads', '200_leads', 'custom')),
ADD COLUMN IF NOT EXISTS kpi_calculation_method TEXT CHECK (kpi_calculation_method IN ('positive_replies', 'all_leads')) DEFAULT 'positive_replies';

-- Add Email Sending fields
ALTER TABLE public.client_registry
ADD COLUMN IF NOT EXISTS daily_sending_target INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sending_tier TEXT CHECK (sending_tier IN ('low', 'medium', 'high', 'enterprise')),
ADD COLUMN IF NOT EXISTS warmup_phase BOOLEAN DEFAULT false;

-- Add Billing fields (payout may already exist from other migration)
ALTER TABLE public.client_registry
ADD COLUMN IF NOT EXISTS payout DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS cost_per_lead DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS labor_cost_allocation DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS email_account_costs DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS billing_contact_email TEXT,
ADD COLUMN IF NOT EXISTS billing_frequency TEXT CHECK (billing_frequency IN ('monthly', 'quarterly', 'annual')) DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS auto_billing_enabled BOOLEAN DEFAULT false;

-- Add Contact Pipeline fields
ALTER TABLE public.client_registry
ADD COLUMN IF NOT EXISTS weekly_batch_schedule INTEGER CHECK (weekly_batch_schedule BETWEEN 1 AND 4),
ADD COLUMN IF NOT EXISTS debounce_credits_allocated INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_campaign_name TEXT,
ADD COLUMN IF NOT EXISTS hnw_enabled BOOLEAN DEFAULT false;

-- Add Territory fields
ALTER TABLE public.client_registry
ADD COLUMN IF NOT EXISTS territory_states TEXT[],
ADD COLUMN IF NOT EXISTS zip_assignment_type TEXT CHECK (zip_assignment_type IN ('exclusive', 'shared')),
ADD COLUMN IF NOT EXISTS agency_color TEXT,
ADD COLUMN IF NOT EXISTS is_agency BOOLEAN DEFAULT false;

-- Add Portal fields
ALTER TABLE public.client_registry
ADD COLUMN IF NOT EXISTS portal_access_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS default_commission_rate DECIMAL(5,2) DEFAULT 10.00,
ADD COLUMN IF NOT EXISTS portal_custom_branding JSONB;

-- Add ROI defaults (optional)
ALTER TABLE public.client_registry
ADD COLUMN IF NOT EXISTS default_conversion_rate DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS default_avg_deal_size DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS default_customer_ltv DECIMAL(10,2);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_registry_lead_tier ON public.client_registry(lead_tier);
CREATE INDEX IF NOT EXISTS idx_client_registry_sending_tier ON public.client_registry(sending_tier);
CREATE INDEX IF NOT EXISTS idx_client_registry_portal_access ON public.client_registry(portal_access_enabled);
CREATE INDEX IF NOT EXISTS idx_client_registry_agency ON public.client_registry(is_agency);

-- Add comments for documentation
COMMENT ON COLUMN public.client_registry.payout IS 'Actual monthly payout amount (from Airtable Payout field)';
COMMENT ON COLUMN public.client_registry.lead_tier IS 'Lead generation tier: 100_leads, 200_leads, or custom';
COMMENT ON COLUMN public.client_registry.daily_sending_target IS 'Daily email sending quota for Volume Dashboard';
COMMENT ON COLUMN public.client_registry.sending_tier IS 'Email volume tier: low, medium, high, enterprise';
COMMENT ON COLUMN public.client_registry.warmup_phase IS 'True if client is in email warmup period';
COMMENT ON COLUMN public.client_registry.cost_per_lead IS 'Internal cost to generate each lead';
COMMENT ON COLUMN public.client_registry.labor_cost_allocation IS 'Percentage of labor costs allocated to this client';
COMMENT ON COLUMN public.client_registry.email_account_costs IS 'Monthly email infrastructure costs for this client';
COMMENT ON COLUMN public.client_registry.weekly_batch_schedule IS 'Which Monday of month to upload (1-4)';
COMMENT ON COLUMN public.client_registry.debounce_credits_allocated IS 'Monthly Debounce API credit budget';
COMMENT ON COLUMN public.client_registry.target_campaign_name IS 'Default Email Bison campaign name for contact uploads';
COMMENT ON COLUMN public.client_registry.hnw_enabled IS 'High Net Worth routing enabled for this client';
COMMENT ON COLUMN public.client_registry.territory_states IS 'Array of state codes this client/agency covers';
COMMENT ON COLUMN public.client_registry.zip_assignment_type IS 'Exclusive or shared territory assignment';
COMMENT ON COLUMN public.client_registry.agency_color IS 'Hex color code for ZIP Dashboard map visualization';
COMMENT ON COLUMN public.client_registry.is_agency IS 'True if this is an agency vs direct client';
COMMENT ON COLUMN public.client_registry.portal_access_enabled IS 'Client has access to client portal';
COMMENT ON COLUMN public.client_registry.default_commission_rate IS 'Default commission rate for ROI calculations';
COMMENT ON COLUMN public.client_registry.portal_custom_branding IS 'JSON configuration for white-label portal branding';

-- Migrate data from client_settings if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_settings') THEN
    UPDATE public.client_registry cr
    SET cost_per_lead = COALESCE(cr.cost_per_lead, cs.cost_per_lead),
        default_commission_rate = COALESCE(cr.default_commission_rate, cs.default_commission_rate)
    FROM public.client_settings cs
    WHERE cr.workspace_name = cs.workspace_name;
  END IF;
END $$;

-- Set lead_tier based on monthly_kpi_target for existing records
UPDATE public.client_registry
SET lead_tier = CASE
  WHEN monthly_kpi_target <= 100 THEN '100_leads'
  WHEN monthly_kpi_target <= 200 THEN '200_leads'
  ELSE 'custom'
END
WHERE lead_tier IS NULL AND monthly_kpi_target > 0;

-- Generate random agency colors for existing records without one
UPDATE public.client_registry
SET agency_color = '#' || LPAD(TO_HEX((RANDOM() * 16777215)::INTEGER), 6, '0')
WHERE agency_color IS NULL;

-- Set default sending tier based on monthly_sending_target
UPDATE public.client_registry
SET sending_tier = CASE
  WHEN monthly_sending_target <= 15000 THEN 'low'
  WHEN monthly_sending_target <= 30000 THEN 'medium'
  WHEN monthly_sending_target <= 60000 THEN 'high'
  ELSE 'enterprise'
END
WHERE sending_tier IS NULL AND monthly_sending_target > 0;
