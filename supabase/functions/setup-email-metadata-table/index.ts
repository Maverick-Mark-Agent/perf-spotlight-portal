import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Creating email_account_metadata table...');

    // Execute the SQL to create the table
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
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
        drop policy if exists "Allow all operations on email_account_metadata" on public.email_account_metadata;
        create policy "Allow all operations on email_account_metadata"
          on public.email_account_metadata
          for all
          using (true)
          with check (true);

        -- Create updated_at function
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
      `
    });

    if (error) {
      // Table might already exist or RPC might not be available
      // Let's try direct table creation instead
      console.log('RPC not available, trying direct creation...');

      const { error: createError } = await supabase.from('email_account_metadata').select('id').limit(1);

      if (createError && createError.message.includes('does not exist')) {
        throw new Error('Please run the migration SQL manually in Supabase dashboard');
      }

      console.log('Table already exists or was created successfully');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Table setup complete or already exists',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error setting up table:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        instructions: 'Please run the SQL migration manually from supabase/migrations/20251003000000_create_email_account_metadata.sql'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
