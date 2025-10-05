-- Run this SQL in Supabase Dashboard: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new

-- Create email_account_metadata table
create table if not exists public.email_account_metadata (
  id uuid default gen_random_uuid() primary key,
  email_address text not null unique,
  price decimal(10,2) default 0,
  notes text,
  custom_tags jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add indexes
create index if not exists idx_email_account_metadata_email
  on public.email_account_metadata(email_address);

create index if not exists idx_email_account_metadata_price
  on public.email_account_metadata(price);

-- Enable RLS
alter table public.email_account_metadata enable row level security;

-- Create policy
create policy if not exists "Allow all operations on email_account_metadata"
  on public.email_account_metadata
  for all
  using (true)
  with check (true);

-- Create function for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create trigger
drop trigger if exists set_updated_at on public.email_account_metadata;
create trigger set_updated_at
  before update on public.email_account_metadata
  for each row
  execute function public.handle_updated_at();

-- Verify table was created
select 'Table created successfully!' as status;
select count(*) as initial_record_count from public.email_account_metadata;
