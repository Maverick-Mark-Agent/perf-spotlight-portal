#!/usr/bin/env node

const ACCESS_TOKEN = 'sbp_765c83453a7d30be808b30e47cc230e0e9686015';
const PROJECT_REF = 'gjqbbgrfhijescaouqkx';

console.log('============================================');
console.log('  Running Migration: Add Reply IDs');
console.log('============================================\n');

const sql = `
ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS bison_reply_id TEXT;

COMMENT ON COLUMN public.client_leads.bison_reply_id IS 'Email Bison reply ID for the interested reply that brought this lead into the pipeline';

CREATE INDEX IF NOT EXISTS idx_client_leads_bison_reply_id
  ON public.client_leads(bison_reply_id)
  WHERE bison_reply_id IS NOT NULL;

CREATE OR REPLACE FUNCTION generate_bison_reply_url(
  p_workspace_id INTEGER,
  p_reply_id TEXT,
  p_base_url TEXT DEFAULT 'https://send.maverickmarketingllc.com'
) RETURNS TEXT AS $$
BEGIN
  IF p_workspace_id IS NULL OR p_reply_id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN p_base_url || '/workspaces/' || p_workspace_id || '/replies/' || p_reply_id;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION generate_bison_reply_url IS 'Generates Email Bison conversation URL from workspace ID and reply ID';
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
  console.log('\nNext step: Update sync script to capture reply IDs');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
