create table if not exists public.client_zipcodes (
  id bigserial primary key,
  client_name text not null,
  workspace_name text,
  month text not null,
  zip text not null,
  source text default 'csv',
  pulled_at timestamptz default now(),
  inserted_at timestamptz default now()
);

create index if not exists client_zipcodes_ws_month_idx on public.client_zipcodes (workspace_name, month);
create index if not exists client_zipcodes_client_month_idx on public.client_zipcodes (client_name, month);
create index if not exists client_zipcodes_zip_idx on public.client_zipcodes (zip);


