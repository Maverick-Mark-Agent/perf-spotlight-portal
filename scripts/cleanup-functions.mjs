#!/usr/bin/env node

const ACCESS_TOKEN = 'sbp_765c83453a7d30be808b30e47cc230e0e9686015';
const PROJECT_REF = 'gjqbbgrfhijescaouqkx';

console.log('Cleaning up old functions...\n');

const sql = `
DROP FUNCTION IF EXISTS generate_bison_conversation_url CASCADE;
DROP FUNCTION IF EXISTS generate_bison_reply_url CASCADE;
DROP FUNCTION IF EXISTS generate_bison_inbox_search_url CASCADE;
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

  console.log('✅ Old functions dropped');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
