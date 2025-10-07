create table if not exists public.monthly_cleaned_leads (
  id bigserial primary key,
  client_name text not null,
  workspace_name text,
  month text not null,
  cleaned_count integer not null default 0,
  target_count integer,
  gap integer generated always as (coalesce(target_count, 0) - cleaned_count) stored,
  source text default 'clay',
  noted_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists monthly_cleaned_leads_ws_month_uidx
  on public.monthly_cleaned_leads (coalesce(workspace_name, client_name), month);

create index if not exists monthly_cleaned_leads_client_idx on public.monthly_cleaned_leads (client_name);
create index if not exists monthly_cleaned_leads_workspace_idx on public.monthly_cleaned_leads (workspace_name);
create index if not exists monthly_cleaned_leads_month_idx on public.monthly_cleaned_leads (month);

-- Create trigger for updated_at (uses function from agent_tables migration)
CREATE TRIGGER update_monthly_cleaned_leads_updated_at BEFORE UPDATE ON public.monthly_cleaned_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.monthly_cleaned_leads ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access monthly_cleaned_leads" ON public.monthly_cleaned_leads FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read
CREATE POLICY "Authenticated read monthly_cleaned_leads" ON public.monthly_cleaned_leads FOR SELECT USING (auth.role() = 'authenticated');



