#!/usr/bin/env node

// Direct SQL execution using Supabase service role key
const https = require('https');

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = 'gjqbbgrfhijescaouqkx';

if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

// SQL migration
const SQL = `
-- Make airtable_id nullable
ALTER TABLE public.client_leads
ALTER COLUMN airtable_id DROP NOT NULL;

-- Drop the unique constraint on airtable_id
ALTER TABLE public.client_leads
DROP CONSTRAINT IF EXISTS client_leads_airtable_id_key;

-- Create proper unique constraint for Email Bison leads
ALTER TABLE public.client_leads
DROP CONSTRAINT IF EXISTS unique_lead_per_workspace;

ALTER TABLE public.client_leads
ADD CONSTRAINT unique_lead_per_workspace
UNIQUE (lead_email, workspace_name);

-- Keep airtable_id unique when it exists
DROP INDEX IF EXISTS idx_client_leads_airtable_unique;

CREATE UNIQUE INDEX idx_client_leads_airtable_unique
  ON public.client_leads(airtable_id)
  WHERE airtable_id IS NOT NULL;

SELECT 'Migration completed' as status;
`.trim();

console.log('============================================');
console.log('  Executing Migration via Supabase API');
console.log('============================================\n');

// Execute each SQL statement separately
const statements = SQL.split(';').map(s => s.trim()).filter(s => s.length > 0);

async function executeSql(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });

    const options = {
      hostname: `${PROJECT_REF}.supabase.co`,
      port: 443,
      path: '/rest/v1/rpc/exec',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve({ success: true, data: body });
        } else {
          resolve({ success: false, error: body, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  console.log(`Executing ${statements.length} SQL statements...\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    console.log(`[${i + 1}/${statements.length}] ${stmt.substring(0, 60)}...`);

    const result = await executeSql(stmt);

    if (result.success) {
      console.log('  ✅ Success\n');
    } else {
      console.log(`  ⚠️  Status ${result.statusCode}: ${result.error}\n`);
    }
  }

  console.log('============================================');
  console.log('✅ Migration completed!');
  console.log('============================================\n');
  console.log('Next step: Run the fixed sync script');
  console.log('  ./scripts/sync-devin-interested-FIXED.sh\n');
})();
