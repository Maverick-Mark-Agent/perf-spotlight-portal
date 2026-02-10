#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: 'aws-0-us-west-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.gjqbbgrfhijescaouqkx',
  password: 'Maverick2024!',
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

console.log('============================================');
console.log('  Running Database Migrations via pg');
console.log('============================================\n');

try {
  console.log('Connecting to database...');
  await client.connect();
  console.log('✅ Connected!\n');

  // Migration 1: Add interested column
  console.log('[1/5] Adding interested column...');
  await client.query('ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS interested BOOLEAN DEFAULT false;');
  console.log('  ✅\n');

  console.log('[2/5] Creating index on interested column...');
  await client.query('CREATE INDEX IF NOT EXISTS idx_client_leads_interested ON public.client_leads(interested) WHERE interested = true;');
  console.log('  ✅\n');

  console.log('[3/5] Adding comment to interested column...');
  await client.query("COMMENT ON COLUMN public.client_leads.interested IS 'Flag indicating if this lead has shown interest (e.g., positive reply)';");
  console.log('  ✅\n');

  // Migration 2: Fix airtable_id
  console.log('[4/5] Making airtable_id nullable...');
  await client.query('ALTER TABLE public.client_leads ALTER COLUMN airtable_id DROP NOT NULL;');
  console.log('  ✅\n');

  console.log('[5/5] Adding unique constraint...');
  await client.query('ALTER TABLE public.client_leads DROP CONSTRAINT IF EXISTS unique_lead_per_workspace;');
  await client.query('ALTER TABLE public.client_leads ADD CONSTRAINT unique_lead_per_workspace UNIQUE (lead_email, workspace_name);');
  console.log('  ✅\n');

  console.log('============================================');
  console.log('✅ All migrations completed successfully!');
  console.log('============================================\n');

  // Test
  console.log('Testing interested column...');
  const result = await client.query('SELECT interested FROM public.client_leads LIMIT 1;');
  console.log('✅ Interested column exists!\n');
  
  console.log('Next step: Run the sync script');
  console.log('  ./scripts/sync-devin-interested-FIXED.sh\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
