#!/usr/bin/env node

const ACCESS_TOKEN = 'sbp_765c83453a7d30be808b30e47cc230e0e9686015';
const PROJECT_REF = 'gjqbbgrfhijescaouqkx';

console.log('============================================');
console.log('  Running Migration: Add Reply UUID Column');
console.log('============================================\n');

const sql = `
ALTER TABLE public.client_leads
ADD COLUMN IF NOT EXISTS bison_reply_uuid TEXT;

COMMENT ON COLUMN public.client_leads.bison_reply_uuid IS 'Email Bison reply UUID for generating conversation URLs';

CREATE INDEX IF NOT EXISTS idx_client_leads_bison_reply_uuid
  ON public.client_leads(bison_reply_uuid)
  WHERE bison_reply_uuid IS NOT NULL;

-- Drop old functions
DROP FUNCTION IF EXISTS generate_bison_reply_url(INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS generate_bison_inbox_search_url(TEXT, TEXT);

-- Create new UUID-based function
CREATE OR REPLACE FUNCTION generate_bison_conversation_url(
  p_reply_uuid TEXT,
  p_base_url TEXT DEFAULT 'https://send.maverickmarketingllc.com'
) RETURNS TEXT AS $$
BEGIN
  IF p_reply_uuid IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN p_base_url || '/inbox/replies/' || p_reply_uuid;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION generate_bison_conversation_url IS 'Generates Email Bison conversation URL using reply UUID (Airtable pattern)';
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
  console.log('\nNext: Update leads with reply UUIDs');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
