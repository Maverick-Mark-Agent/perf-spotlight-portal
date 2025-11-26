-- =============================================
-- EXPENSE TRACKING SYSTEM
-- Comprehensive expense management to replace QuickBooks
-- =============================================

-- 1. Expense Categories
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES public.expense_categories(id),
  icon TEXT,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  is_tax_deductible BOOLEAN DEFAULT true,
  tax_category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Vendors Registry
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  website TEXT,
  email TEXT,
  phone TEXT,
  category_id UUID REFERENCES public.expense_categories(id),
  default_payment_method TEXT CHECK (default_payment_method IN ('credit_card', 'bank_transfer', 'check', 'paypal', 'cash', 'other')),
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'annual', 'quarterly', 'one_time', 'variable')),
  typical_amount DECIMAL(10,2),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Recurring Expense Templates (must be created before expenses table due to FK)
CREATE TABLE IF NOT EXISTS public.recurring_expense_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  category_id UUID NOT NULL REFERENCES public.expense_categories(id),
  vendor_id UUID REFERENCES public.vendors(id),
  frequency TEXT DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'annual')),
  day_of_month INTEGER DEFAULT 1 CHECK (day_of_month >= 1 AND day_of_month <= 31),
  start_date DATE NOT NULL,
  end_date DATE,
  next_occurrence DATE,
  workspace_name TEXT,  -- NULL = overhead (split equally across clients)
  is_active BOOLEAN DEFAULT true,
  last_generated_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Core Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'USD',
  expense_date DATE NOT NULL,
  month_year TEXT GENERATED ALWAYS AS (TO_CHAR(expense_date, 'YYYY-MM')) STORED,
  category_id UUID NOT NULL REFERENCES public.expense_categories(id),
  vendor_id UUID REFERENCES public.vendors(id),
  payment_method TEXT CHECK (payment_method IN ('credit_card', 'bank_transfer', 'check', 'paypal', 'cash', 'other')),
  payment_reference TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurring_frequency TEXT CHECK (recurring_frequency IN ('weekly', 'monthly', 'quarterly', 'annual')),
  recurring_template_id UUID REFERENCES public.recurring_expense_templates(id),
  is_tax_deductible BOOLEAN DEFAULT true,
  tax_category TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
  has_receipt BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Expense Allocations (client or overhead)
CREATE TABLE IF NOT EXISTS public.expense_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  workspace_name TEXT,
  is_overhead BOOLEAN DEFAULT false,
  allocation_percentage DECIMAL(5,2) NOT NULL CHECK (allocation_percentage > 0 AND allocation_percentage <= 100),
  allocated_amount DECIMAL(10,2) NOT NULL,
  allocation_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_allocation_target CHECK (
    (workspace_name IS NOT NULL AND is_overhead = false) OR
    (workspace_name IS NULL AND is_overhead = true)
  )
);

-- 6. Expense Receipts (file storage references)
CREATE TABLE IF NOT EXISTS public.expense_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  storage_path TEXT NOT NULL,
  storage_bucket TEXT DEFAULT 'expense-receipts',
  uploaded_by UUID,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Budget Targets
CREATE TABLE IF NOT EXISTS public.budget_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month_year TEXT NOT NULL,
  category_id UUID REFERENCES public.expense_categories(id),
  budget_amount DECIMAL(10,2) NOT NULL CHECK (budget_amount >= 0),
  warning_threshold INTEGER DEFAULT 80 CHECK (warning_threshold > 0 AND warning_threshold <= 100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(month_year, category_id)
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_month ON public.expenses(month_year);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_vendor ON public.expenses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_has_receipt ON public.expenses(has_receipt);

CREATE INDEX IF NOT EXISTS idx_allocations_expense ON public.expense_allocations(expense_id);
CREATE INDEX IF NOT EXISTS idx_allocations_workspace ON public.expense_allocations(workspace_name);
CREATE INDEX IF NOT EXISTS idx_allocations_overhead ON public.expense_allocations(is_overhead);

CREATE INDEX IF NOT EXISTS idx_receipts_expense ON public.expense_receipts(expense_id);

CREATE INDEX IF NOT EXISTS idx_recurring_next ON public.recurring_expense_templates(next_occurrence) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_vendors_name ON public.vendors(name);
CREATE INDEX IF NOT EXISTS idx_vendors_active ON public.vendors(is_active);

CREATE INDEX IF NOT EXISTS idx_budget_month ON public.budget_targets(month_year);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expense_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_targets ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users and anon to read/write (admin dashboard)
CREATE POLICY "Allow all access to expense_categories" ON public.expense_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to vendors" ON public.vendors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to expense_allocations" ON public.expense_allocations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to expense_receipts" ON public.expense_receipts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to recurring_expense_templates" ON public.recurring_expense_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to budget_targets" ON public.budget_targets FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- TRIGGERS FOR updated_at
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_expense_categories_updated_at ON public.expense_categories;
CREATE TRIGGER update_expense_categories_updated_at BEFORE UPDATE ON public.expense_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendors_updated_at ON public.vendors;
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON public.expenses;
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recurring_templates_updated_at ON public.recurring_expense_templates;
CREATE TRIGGER update_recurring_templates_updated_at BEFORE UPDATE ON public.recurring_expense_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_budget_targets_updated_at ON public.budget_targets;
CREATE TRIGGER update_budget_targets_updated_at BEFORE UPDATE ON public.budget_targets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- TRIGGER: Auto-update has_receipt and status
-- =============================================

CREATE OR REPLACE FUNCTION update_expense_receipt_status()
RETURNS TRIGGER AS $$
BEGIN
    -- When a receipt is added, update the expense
    UPDATE public.expenses
    SET has_receipt = true,
        status = CASE WHEN status = 'pending' THEN 'approved' ELSE status END,
        approved_at = CASE WHEN status = 'pending' THEN NOW() ELSE approved_at END
    WHERE id = NEW.expense_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS on_receipt_upload ON public.expense_receipts;
CREATE TRIGGER on_receipt_upload AFTER INSERT ON public.expense_receipts
    FOR EACH ROW EXECUTE FUNCTION update_expense_receipt_status();

-- =============================================
-- SEED DATA: Categories
-- =============================================

INSERT INTO public.expense_categories (name, slug, icon, color, tax_category, sort_order) VALUES
  ('Software & SaaS', 'software-saas', 'Cloud', '#3b82f6', 'software', 1),
  ('Data & Lead Sources', 'data-sources', 'Database', '#8b5cf6', 'data_services', 2),
  ('Email Infrastructure', 'email-infrastructure', 'Mail', '#06b6d4', 'software', 3),
  ('Labor & Contractors', 'labor-contractors', 'Users', '#f59e0b', 'labor', 4),
  ('Marketing & Advertising', 'marketing', 'Megaphone', '#ec4899', 'advertising', 5),
  ('Office & Administrative', 'office-admin', 'Building2', '#6366f1', 'office', 6),
  ('Professional Services', 'professional-services', 'Briefcase', '#14b8a6', 'professional_services', 7),
  ('Travel & Entertainment', 'travel-entertainment', 'Plane', '#f97316', 'travel', 8),
  ('Utilities & Communications', 'utilities-comms', 'Phone', '#84cc16', 'utilities', 9),
  ('Insurance & Benefits', 'insurance-benefits', 'Shield', '#ef4444', 'insurance', 10),
  ('Equipment & Hardware', 'equipment-hardware', 'Monitor', '#a855f7', 'equipment', 11),
  ('Miscellaneous', 'miscellaneous', 'MoreHorizontal', '#64748b', 'other', 99)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- SEED DATA: Known Vendors
-- =============================================

INSERT INTO public.vendors (name, display_name, billing_cycle, notes) VALUES
  ('Cole X Dates', 'Cole X Dates', 'monthly', 'Homeowner data source'),
  ('Clay', 'Clay.com', 'monthly', 'Data enrichment platform'),
  ('Zapier', 'Zapier', 'monthly', 'Workflow automation'),
  ('Slack', 'Slack', 'monthly', 'Team communication'),
  ('Email Bison', 'Email Bison', 'monthly', 'Email marketing platform'),
  ('Supabase', 'Supabase', 'monthly', 'Database and backend'),
  ('Vercel', 'Vercel', 'monthly', 'Hosting platform'),
  ('OpenAI', 'OpenAI', 'monthly', 'AI services'),
  ('Anthropic', 'Anthropic', 'monthly', 'AI services (Claude)'),
  ('Google Workspace', 'Google Workspace', 'monthly', 'Business email and productivity'),
  ('Debounce', 'Debounce', 'variable', 'Email validation'),
  ('EZLynx', 'EZLynx', 'monthly', 'Insurance CRM')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- VIEWS: Expense Analytics
-- =============================================

-- Monthly expense summary by category
CREATE OR REPLACE VIEW public.monthly_expense_summary AS
SELECT
  e.month_year,
  ec.name as category_name,
  ec.slug as category_slug,
  ec.color as category_color,
  COUNT(e.id) as expense_count,
  SUM(e.amount) as total_amount,
  SUM(CASE WHEN e.status = 'approved' THEN e.amount ELSE 0 END) as approved_amount,
  SUM(CASE WHEN e.status = 'pending' THEN e.amount ELSE 0 END) as pending_amount,
  COUNT(CASE WHEN e.has_receipt = false THEN 1 END) as missing_receipts
FROM public.expenses e
JOIN public.expense_categories ec ON e.category_id = ec.id
GROUP BY e.month_year, ec.name, ec.slug, ec.color
ORDER BY e.month_year DESC, ec.sort_order;

-- Client expense allocation summary
CREATE OR REPLACE VIEW public.client_expense_summary AS
SELECT
  ea.workspace_name,
  e.month_year,
  SUM(ea.allocated_amount) as total_direct_costs,
  COUNT(DISTINCT e.id) as expense_count
FROM public.expense_allocations ea
JOIN public.expenses e ON ea.expense_id = e.id
WHERE ea.is_overhead = false
  AND ea.workspace_name IS NOT NULL
  AND e.status = 'approved'
GROUP BY ea.workspace_name, e.month_year
ORDER BY e.month_year DESC, ea.workspace_name;

-- Overhead expense summary (to be split equally)
CREATE OR REPLACE VIEW public.overhead_expense_summary AS
SELECT
  e.month_year,
  SUM(ea.allocated_amount) as total_overhead,
  COUNT(DISTINCT e.id) as expense_count
FROM public.expense_allocations ea
JOIN public.expenses e ON ea.expense_id = e.id
WHERE ea.is_overhead = true
  AND e.status = 'approved'
GROUP BY e.month_year
ORDER BY e.month_year DESC;

-- =============================================
-- FUNCTION: Get client profitability with expenses
-- =============================================

CREATE OR REPLACE FUNCTION get_client_expense_allocation(
  p_workspace_name TEXT,
  p_month_year TEXT
)
RETURNS TABLE (
  direct_costs DECIMAL(10,2),
  allocated_overhead DECIMAL(10,2),
  total_costs DECIMAL(10,2)
) AS $$
DECLARE
  v_direct_costs DECIMAL(10,2);
  v_total_overhead DECIMAL(10,2);
  v_active_client_count INTEGER;
  v_allocated_overhead DECIMAL(10,2);
BEGIN
  -- Get direct costs for this client
  SELECT COALESCE(SUM(ea.allocated_amount), 0)
  INTO v_direct_costs
  FROM expense_allocations ea
  JOIN expenses e ON ea.expense_id = e.id
  WHERE ea.workspace_name = p_workspace_name
    AND e.month_year = p_month_year
    AND e.status = 'approved'
    AND ea.is_overhead = false;

  -- Get total overhead for this month
  SELECT COALESCE(SUM(ea.allocated_amount), 0)
  INTO v_total_overhead
  FROM expense_allocations ea
  JOIN expenses e ON ea.expense_id = e.id
  WHERE e.month_year = p_month_year
    AND e.status = 'approved'
    AND ea.is_overhead = true;

  -- Get active client count for equal split
  SELECT COUNT(DISTINCT workspace_name)
  INTO v_active_client_count
  FROM client_registry
  WHERE is_active = true;

  -- Calculate allocated overhead (equal split)
  IF v_active_client_count > 0 THEN
    v_allocated_overhead := v_total_overhead / v_active_client_count;
  ELSE
    v_allocated_overhead := 0;
  END IF;

  RETURN QUERY SELECT
    v_direct_costs,
    v_allocated_overhead,
    v_direct_costs + v_allocated_overhead;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- STORAGE BUCKET (run via Supabase dashboard or CLI)
-- =============================================
-- Note: Storage bucket creation should be done via:
-- 1. Supabase Dashboard > Storage > New bucket > "expense-receipts" (private)
-- 2. Or via CLI: supabase storage create expense-receipts --public=false
