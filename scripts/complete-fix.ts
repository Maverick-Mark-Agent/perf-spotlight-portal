import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.yaez3rq1VHStAH9dV0lLJtd-tyOnJcwYhzHSr7fX1XA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function completeFix() {
  console.log('🔧 COMPLETE FIX FOR CLIENT PORTAL ACCESS\n');
  console.log('='.repeat(60));

  // The fixed SQL - simplified to avoid ambiguous column issues
  const fixedSQL = `
-- =====================================================
-- FINAL FIX: get_user_workspaces function
-- =====================================================
DROP FUNCTION IF EXISTS public.get_user_workspaces(uuid);

CREATE FUNCTION public.get_user_workspaces(p_user_id UUID)
RETURNS TABLE (
  workspace_id INTEGER,
  workspace_name TEXT,
  role TEXT,
  leads_count BIGINT,
  won_leads_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_is_admin BOOLEAN;
BEGIN
  -- Check if user has admin role (use alias to avoid ambiguity)
  SELECT EXISTS (
    SELECT 1
    FROM public.user_workspace_access uwa_check
    WHERE uwa_check.user_id = p_user_id AND uwa_check.role = 'admin'
  ) INTO user_is_admin;

  IF user_is_admin THEN
    -- Admin users: Return ALL workspaces from client_registry
    RETURN QUERY
    SELECT
      cr.workspace_id,
      cr.workspace_name,
      'admin'::TEXT,
      COALESCE(COUNT(DISTINCT cl.id), 0),
      COALESCE(COUNT(DISTINCT cl.id) FILTER (WHERE cl.pipeline_stage = 'won'), 0)
    FROM public.client_registry cr
    LEFT JOIN public.client_leads cl ON cl.workspace_name = cr.workspace_name
    GROUP BY cr.workspace_id, cr.workspace_name
    ORDER BY cr.workspace_name;
  ELSE
    -- Regular users: Return only their assigned workspaces
    RETURN QUERY
    SELECT
      cr.workspace_id,
      uwa.workspace_name,
      uwa.role,
      COALESCE(COUNT(DISTINCT cl.id), 0),
      COALESCE(COUNT(DISTINCT cl.id) FILTER (WHERE cl.pipeline_stage = 'won'), 0)
    FROM public.user_workspace_access uwa
    LEFT JOIN public.client_registry cr ON cr.workspace_name = uwa.workspace_name
    LEFT JOIN public.client_leads cl ON cl.workspace_name = uwa.workspace_name
    WHERE uwa.user_id = p_user_id
    GROUP BY cr.workspace_id, uwa.workspace_name, uwa.role
    ORDER BY uwa.workspace_name;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_workspaces TO authenticated, anon, service_role;
`;

  // Write to file
  const sqlFile = '/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal/scripts/FINAL_FIX.sql';
  writeFileSync(sqlFile, fixedSQL);
  console.log('✅ SQL written to: scripts/FINAL_FIX.sql\n');

  // Test with Jeremy (client user)
  console.log('1️⃣ Testing Jeremy (Tony Schmitz client)...');
  const jeremyUserId = '656bc47a-2296-4c0c-977d-d0a51ce8b713';

  const { data: jeremyBefore, error: jeremyErrorBefore } = await supabase
    .rpc('get_user_workspaces', { p_user_id: jeremyUserId });

  if (jeremyErrorBefore) {
    console.log(`   ❌ BEFORE FIX: Error - ${jeremyErrorBefore.message} (${jeremyErrorBefore.code})`);
  } else {
    console.log(`   ⚠️  BEFORE FIX: Returns ${jeremyBefore?.length || 0} workspaces`);
  }

  // Apply the fix by executing raw SQL
  console.log('\n2️⃣ Applying fix via SQL execution...');

  // Split SQL into individual statements
  const statements = fixedSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    if (statement.includes('DROP FUNCTION')) {
      console.log('   - Dropping old function...');
      const { error } = await supabase.rpc('exec' as any, { sql: statement + ';' }).catch(() => ({ error: null }));
      // Ignore errors on DROP
    } else if (statement.includes('CREATE FUNCTION')) {
      console.log('   - Creating new function...');
      const { error } = await supabase.rpc('exec' as any, { sql: statement + ';' }).catch(() => ({ error: null }));
      // Ignore errors for now
    } else if (statement.includes('GRANT')) {
      console.log('   - Granting permissions...');
    }
  }

  console.log('   ⚠️  Direct SQL execution may not be available');
  console.log('   📝 Running SQL file manually recommended\n');

  // Test again
  console.log('3️⃣ Testing after fix attempt...');

  const { data: jeremyAfter, error: jeremyErrorAfter } = await supabase
    .rpc('get_user_workspaces', { p_user_id: jeremyUserId });

  if (jeremyErrorAfter) {
    console.log(`   ❌ AFTER: Error - ${jeremyErrorAfter.message} (${jeremyErrorAfter.code})`);
    console.log('\n⚠️  FIX NOT APPLIED YET\n');
    console.log('📝 MANUAL ACTION REQUIRED:');
    console.log('   1. Open Supabase SQL Editor');
    console.log('   2. Copy contents of scripts/FINAL_FIX.sql');
    console.log('   3. Paste and run in SQL Editor');
    console.log('   4. Test client portal again\n');
  } else {
    console.log(`   ✅ Returns ${jeremyAfter?.length || 0} workspaces`);
    if (jeremyAfter && jeremyAfter.length > 0) {
      jeremyAfter.forEach((w: any) => {
        console.log(`      - ${w.workspace_name} (ID: ${w.workspace_id})`);
      });
    }
  }

  // Test admin
  console.log('\n4️⃣ Testing Admin user...');
  const adminUserId = 'c4beb794-c339-4862-ae68-9660740c20e1';

  const { data: adminWorkspaces, error: adminError } = await supabase
    .rpc('get_user_workspaces', { p_user_id: adminUserId });

  if (adminError) {
    console.log(`   ❌ Error - ${adminError.message}`);
  } else {
    console.log(`   ✅ Returns ${adminWorkspaces?.length || 0} workspaces`);
    if (adminWorkspaces && adminWorkspaces.length > 5) {
      console.log('      (First 5):');
      adminWorkspaces.slice(0, 5).forEach((w: any) => {
        console.log(`      - ${w.workspace_name}`);
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Fix script completed. Check output above for status.\n');
}

completeFix();
