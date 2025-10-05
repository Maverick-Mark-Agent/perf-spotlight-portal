-- Create email_account_metadata table
-- This stores metadata for email accounts that's not available in Email Bison API
-- Primary use case: Pricing information for cost analysis

create table if not exists public.email_account_metadata (
  id uuid default gen_random_uuid() primary key,
  email_address text not null unique,
  price decimal(10,2) default 0,
  notes text,
  custom_tags jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add index on email_address for fast lookups
create index if not exists idx_email_account_metadata_email
  on public.email_account_metadata(email_address);

-- Add index on price for cost analysis queries
create index if not exists idx_email_account_metadata_price
  on public.email_account_metadata(price);

-- Enable Row Level Security
alter table public.email_account_metadata enable row level security;

-- Create policy to allow all operations (adjust based on your auth requirements)
-- For now, allowing all since this is an internal admin dashboard
create policy "Allow all operations on email_account_metadata"
  on public.email_account_metadata
  for all
  using (true)
  with check (true);

-- Create function to automatically update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at
create trigger set_updated_at
  before update on public.email_account_metadata
  for each row
  execute function public.handle_updated_at();

-- Add comments for documentation
comment on table public.email_account_metadata is 'Metadata for email accounts not available in Email Bison API (pricing, custom tags, notes)';
comment on column public.email_account_metadata.email_address is 'Email address - must match Email Bison sender email exactly';
comment on column public.email_account_metadata.price is 'Monthly cost for this email account in USD';
comment on column public.email_account_metadata.notes is 'Internal notes about this account';
comment on column public.email_account_metadata.custom_tags is 'Custom tags for categorization (JSON array)';
