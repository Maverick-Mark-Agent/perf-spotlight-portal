#!/usr/bin/env node

const ACCESS_TOKEN = 'sbp_765c83453a7d30be808b30e47cc230e0e9686015';
const PROJECT_REF = 'gjqbbgrfhijescaouqkx';

console.log('============================================');
console.log('  Running Migration: Fix Conversation URL Pattern');
console.log('============================================\n');

const sql = `
CREATE OR REPLACE FUNCTION generate_bison_inbox_search_url(
  p_lead_email TEXT,
  p_base_url TEXT DEFAULT 'https://send.maverickmarketingllc.com'
) RETURNS TEXT AS $$
BEGIN
  IF p_lead_email IS NULL THEN
    RETURN NULL;
  END IF;
  -- Use inbox search pattern that actually works in Email Bison
  RETURN p_base_url || '/inbox?search=' || p_lead_email;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION generate_bison_inbox_search_url IS 'Generates Email Bison inbox search URL for a lead email address';
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
  console.log('\nNew URL pattern: /inbox?search={lead_email}');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
