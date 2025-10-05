#!/usr/bin/env node

const ACCESS_TOKEN = 'sbp_765c83453a7d30be808b30e47cc230e0e9686015';
const PROJECT_REF = 'gjqbbgrfhijescaouqkx';

console.log('============================================');
console.log('  Running Migrations via Management API');
console.log('============================================\n');

const sql = `
ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS interested BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_client_leads_interested ON public.client_leads(interested) WHERE interested = true;
ALTER TABLE public.client_leads ALTER COLUMN airtable_id DROP NOT NULL;
ALTER TABLE public.client_leads DROP CONSTRAINT IF EXISTS unique_lead_per_workspace;
ALTER TABLE public.client_leads ADD CONSTRAINT unique_lead_per_workspace UNIQUE (lead_email, workspace_name);
`.trim();

try {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ API Error:', data);
    process.exit(1);
  }

  console.log('✅ Migration completed!');
  console.log(JSON.stringify(data, null, 2));
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
