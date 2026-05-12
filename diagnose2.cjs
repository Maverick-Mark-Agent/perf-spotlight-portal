const { createClient } = require('@supabase/supabase-js');

// Try with the service role key from .env (even though REST API rejected it, maybe node client handles it differently)
// Also try direct REST with different approach
const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function diagnose() {
  // 1. Check if RLS is blocking us - try to get count
  console.log('=== 1. RLS CHECK - Can we see email_accounts_raw? ===');
  const { count, error: countErr } = await supabase
    .from('email_accounts_raw')
    .select('*', { count: 'exact', head: true });
  console.log(`Count: ${count}, Error: ${countErr?.message || 'none'}`);

  // 2. Check sent_replies for RECENT successes (yesterday)
  console.log('\n=== 2. RECENT SUCCESSFUL sends (last 7 days) ===');
  const { data: successes, error: succErr } = await supabase
    .from('sent_replies')
    .select('workspace_name, status, created_at, sent_at')
    .eq('status', 'sent')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (succErr) console.error('Error:', succErr.message);
  else {
    console.log(`Found ${successes.length} successful sends in last 7 days:`);
    successes.forEach(s => console.log(`  [${s.created_at?.substring(0,16)}] "${s.workspace_name}" status=${s.status}`));
  }

  // 3. Check ALL sent_replies (any status) from last 3 days
  console.log('\n=== 3. ALL send attempts (last 3 days) ===');
  const { data: allRecent, error: allErr } = await supabase
    .from('sent_replies')
    .select('workspace_name, status, error_message, created_at')
    .gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(30);
  
  if (allErr) console.error('Error:', allErr.message);
  else {
    console.log(`Found ${allRecent.length} send attempts in last 3 days:`);
    allRecent.forEach(s => console.log(`  [${s.created_at?.substring(0,16)}] "${s.workspace_name}" => ${s.status}: ${s.error_message?.substring(0,100) || 'ok'}`));
  }

  // 4. Check email_accounts page - how does it fetch data?
  // Look for email_accounts table (not _raw)
  console.log('\n=== 4. Check email_accounts table (not _raw) ===');
  const { data: emailAccountsAlt, error: altErr } = await supabase
    .from('email_accounts')
    .select('workspace_name, status, email_address')
    .limit(10);
  
  if (altErr) console.log('email_accounts table error:', altErr.message);
  else console.log('email_accounts rows:', emailAccountsAlt?.length, JSON.stringify(emailAccountsAlt?.slice(0,3)));

  // 5. Check if there's a different table name
  console.log('\n=== 5. Check infrastructure_data or similar ===');
  const { data: infra, error: infraErr } = await supabase
    .from('infrastructure_data')
    .select('workspace_name, status')
    .limit(5);
  if (infraErr) console.log('infrastructure_data error:', infraErr.message);
  else console.log('infrastructure_data rows:', infra?.length);
}

diagnose().catch(console.error);
