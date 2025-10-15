import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://gjqbbgrfhijescaouqkx.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createTable() {
  console.log('📊 Creating polling_job_status table...\n');

  const sql = `
-- Create table to track email polling job status
CREATE TABLE IF NOT EXISTS public.polling_job_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'partial', 'failed')),
  total_workspaces integer NOT NULL DEFAULT 0,
  workspaces_processed integer NOT NULL DEFAULT 0,
  workspaces_skipped integer NOT NULL DEFAULT 0,
  total_accounts_synced integer NOT NULL DEFAULT 0,
  duration_ms integer,
  error_message text,
  warnings text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_polling_job_status_job_name ON public.polling_job_status(job_name);
CREATE INDEX IF NOT EXISTS idx_polling_job_status_started_at ON public.polling_job_status(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_polling_job_status_status ON public.polling_job_status(status);

-- Enable RLS
ALTER TABLE public.polling_job_status ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role full access on polling_job_status" ON public.polling_job_status;
DROP POLICY IF EXISTS "Public read access on polling_job_status" ON public.polling_job_status;

-- Create policies
CREATE POLICY "Service role full access on polling_job_status"
ON public.polling_job_status FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Public read access on polling_job_status"
ON public.polling_job_status FOR SELECT TO anon USING (true);
  `;

  try {
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('❌ Error creating table:', error);
      process.exit(1);
    }

    console.log('✅ polling_job_status table created successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createTable();
