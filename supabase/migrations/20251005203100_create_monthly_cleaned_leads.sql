create table if not exists public.monthly_cleaned_leads (
  id bigserial primary key,
  client_name text not null,
  workspace_name text,
  month text not null,
  cleaned_count integer not null,
  source text default 'clay',
  noted_at timestamptz default now()
);

create unique index if not exists monthly_cleaned_leads_ws_month_uidx
  on public.monthly_cleaned_leads (coalesce(workspace_name, client_name), month);


