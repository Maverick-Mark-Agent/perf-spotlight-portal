const { createClient } = require('@supabase/supabase-js');

// Use the anon key from client.ts (the one we know works for the app)
const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function diagnose() {
  console.log('=== CHECKING email_accounts_raw ===\n');
  
  const { data: emailAccounts, error: emailError } = await supabase
    .from('email_accounts_raw')
    .select('workspace_name, status, email_address, bison_account_id')
    .order('workspace_name');

  if (emailError) {
    console.error('Error fetching email_accounts_raw:', emailError.message);
  } else {
    console.log('Total rows:', emailAccounts.length, '\n');
    
    const byWorkspace = {};
    emailAccounts.forEach(row => {
      if (!byWorkspace[row.workspace_name]) byWorkspace[row.workspace_name] = [];
      byWorkspace[row.workspace_name].push(row);
    });
    
    Object.entries(byWorkspace).forEach(([ws, accounts]) => {
      const connected = accounts.filter(a => a.status === 'Connected');
      const others = accounts.filter(a => a.status !== 'Connected');
      const statusStr = others.map(a => `"${a.status}"`).join(', ');
      console.log(`  "${ws}": ${connected.length} Connected${others.length > 0 ? ', others=[' + statusStr + ']' : ''}`);
    });
  }

  console.log('\n=== CHECKING client_registry ===\n');
  
  const { data: registry, error: regError } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_instance, bison_workspace_id, bison_api_key')
    .order('workspace_name');

  if (regError) {
    console.error('Error fetching client_registry:', regError.message);
  } else {
    console.log('Total workspaces:', registry.length, '\n');
    registry.forEach(r => {
      const connected = emailAccounts ? emailAccounts.filter(a => a.workspace_name === r.workspace_name && a.status === 'Connected') : [];
      const canSend = connected.length > 0 ? '✅ CAN SEND' : '❌ CANNOT SEND';
      console.log(`  ${canSend} | "${r.workspace_name}" | ${r.bison_instance}`);
    });
  }

  console.log('\n=== NAME MISMATCHES ===\n');
  if (emailAccounts && registry) {
    const registryNames = new Set(registry.map(r => r.workspace_name));
    const emailNames = new Set(emailAccounts.map(a => a.workspace_name));
    
    emailNames.forEach(n => {
      if (!registryNames.has(n)) {
        console.log(`  ⚠️  email_accounts_raw has "${n}" but NO match in client_registry`);
      }
    });
  }

  console.log('\n=== RECENT SEND FAILURES ===\n');
  const { data: failures, error: failError } = await supabase
    .from('sent_replies')
    .select('workspace_name, status, error_message, created_at')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(20);

  if (failError) {
    console.error('Error:', failError.message);
  } else if (failures.length === 0) {
    console.log('No failed records in sent_replies table.');
    console.log('(The error likely happens BEFORE recording to sent_replies)');
  } else {
    failures.forEach(f => {
      console.log(`  [${f.created_at?.substring(0,16)}] "${f.workspace_name}": ${f.error_message?.substring(0,150)}`);
    });
  }
}

diagnose().catch(console.error);
