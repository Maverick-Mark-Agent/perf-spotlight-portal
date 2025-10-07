create table if not exists public.client_zipcodes (
  id bigserial primary key,
  client_name text not null,
  workspace_name text,
  month text not null,
  zip text not null,
  state text,
  source text default 'csv',
  pulled_at timestamptz default now(),
  agent_run_id uuid references public.agent_runs(run_id) on delete set null,
  inserted_at timestamptz default now()
);

create index if not exists client_zipcodes_client_month_idx on public.client_zipcodes (client_name, month);
create index if not exists client_zipcodes_ws_month_idx on public.client_zipcodes (workspace_name, month);
create index if not exists client_zipcodes_zip_idx on public.client_zipcodes (zip);
create index if not exists client_zipcodes_state_idx on public.client_zipcodes (state);
create unique index if not exists client_zipcodes_unique on public.client_zipcodes (coalesce(workspace_name, client_name), month, zip);

-- Enable RLS
ALTER TABLE public.client_zipcodes ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access client_zipcodes" ON public.client_zipcodes FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read
CREATE POLICY "Authenticated read client_zipcodes" ON public.client_zipcodes FOR SELECT USING (auth.role() = 'authenticated');



