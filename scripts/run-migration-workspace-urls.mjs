#!/usr/bin/env node

const ACCESS_TOKEN = 'sbp_765c83453a7d30be808b30e47cc230e0e9686015';
const PROJECT_REF = 'gjqbbgrfhijescaouqkx';

console.log('============================================');
console.log('  Running Migration: Bison Workspace URLs');
console.log('============================================\n');

const sql = `
ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS bison_workspace_id INTEGER;

COMMENT ON COLUMN public.client_leads.bison_workspace_id IS 'Email Bison workspace/team ID for generating conversation URLs';

CREATE TABLE IF NOT EXISTS public.workspace_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_name TEXT UNIQUE NOT NULL,
  bison_workspace_id INTEGER NOT NULL,
  bison_base_url TEXT DEFAULT 'https://send.maverickmarketingllc.com',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.workspace_mappings IS 'Maps workspace names to Email Bison workspace IDs for URL generation';

INSERT INTO public.workspace_mappings (workspace_name, bison_workspace_id)
VALUES
  ('Devin Hodo', 37),
  ('David Amiri', 25)
ON CONFLICT (workspace_name) DO NOTHING;

CREATE OR REPLACE FUNCTION generate_bison_conversation_url(
  p_workspace_id INTEGER,
  p_lead_id TEXT,
  p_base_url TEXT DEFAULT 'https://send.maverickmarketingllc.com'
) RETURNS TEXT AS $$
BEGIN
  IF p_workspace_id IS NULL OR p_lead_id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN p_base_url || '/workspaces/' || p_workspace_id || '/leads/' || p_lead_id;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION generate_bison_conversation_url IS 'Generates Email Bison conversation URL from workspace ID and lead ID';

UPDATE public.client_leads
SET
  bison_workspace_id = 37,
  bison_conversation_url = generate_bison_conversation_url(37, bison_lead_id)
WHERE
  workspace_name = 'Devin Hodo'
  AND bison_lead_id IS NOT NULL;

UPDATE public.client_leads
SET
  bison_workspace_id = 25,
  bison_conversation_url = generate_bison_conversation_url(25, bison_lead_id)
WHERE
  workspace_name = 'David Amiri'
  AND bison_lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_leads_bison_workspace_id
  ON public.client_leads(bison_workspace_id)
  WHERE bison_workspace_id IS NOT NULL;
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
  console.log('');
  console.log('Verifying results...');
  
  // Run verification query
  const verifyResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: `
        SELECT
          workspace_name,
          COUNT(*) as total_leads,
          COUNT(bison_conversation_url) as leads_with_url,
          COUNT(bison_workspace_id) as leads_with_workspace_id
        FROM public.client_leads
        WHERE workspace_name IN ('Devin Hodo', 'David Amiri')
        GROUP BY workspace_name;
      `
    })
  });

  const verifyData = await response.json();
  console.log('Verification results:');
  console.log(JSON.stringify(verifyData, null, 2));
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
