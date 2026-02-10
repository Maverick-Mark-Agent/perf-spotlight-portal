import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.yaez3rq1VHStAH9dV0lLJtd-tyOnJcwYhzHSr7fX1XA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function completeFixAndTest() {
  console.log('🔧 COMPLETE DIAGNOSTIC AND FIX\n');
  console.log('='.repeat(60));

  // Step 1: Check current function definition
  console.log('\n1️⃣ Checking current function definition...');
  const { data: funcDef, error: funcError } = await supabase.rpc('exec_sql' as any, {
    query: `
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname = 'get_user_workspaces'
        AND pronamespace = 'public'::regnamespace;
    `
  }).catch(() => ({ data: null, error: null }));

  // Alternative method - query directly
  const { data: funcCheck } = await supabase
    .from('pg_proc' as any)
    .select('proname')
    .eq('proname', 'get_user_workspaces')
    .single()
    .catch(() => ({ data: null }));

  if (!funcCheck) {
    console.log('⚠️  Cannot query function directly, will recreate it');
  }

  // Step 2: Drop and recreate the function with a completely clean version
  console.log('\n2️⃣ Recreating function with fixed SQL...');

  const fixedFunctionSQL = `
-- Drop existing function
DROP FUNCTION IF EXISTS public.get_user_workspaces(uuid);

-- Create clean version
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
  -- Check if user has admin role
  SELECT EXISTS (
    SELECT 1
    FROM public.user_workspace_access uwa2
    WHERE uwa2.user_id = p_user_id AND uwa2.role = 'admin'
  ) INTO user_is_admin;

  IF user_is_admin THEN
    -- Admin users: Return ALL workspaces from client_registry
    RETURN QUERY
    SELECT
      cr.workspace_id,
      cr.workspace_name,
      'admin'::TEXT,
      COUNT(DISTINCT cl.id),
      COUNT(DISTINCT cl.id) FILTER (WHERE cl.pipeline_stage = 'won')
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
      COUNT(DISTINCT cl.id),
      COUNT(DISTINCT cl.id) FILTER (WHERE cl.pipeline_stage = 'won')
    FROM public.user_workspace_access uwa
    LEFT JOIN public.client_registry cr ON cr.workspace_name = uwa.workspace_name
    LEFT JOIN public.client_leads cl ON cl.workspace_name = uwa.workspace_name
    WHERE uwa.user_id = p_user_id
    GROUP BY cr.workspace_id, uwa.workspace_name, uwa.role
    ORDER BY uwa.workspace_name;
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_user_workspaces TO authenticated, anon, service_role;
`;

  // Execute the SQL using a raw query approach
  console.log('   Executing SQL to recreate function...');

  // Try multiple approaches to execute the SQL
  try {
    // Approach 1: Direct SQL execution via service role
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ query: fixedFunctionSQL })
    });

    if (!response.ok) {
      console.log('   ⚠️  Direct SQL execution not available');
    } else {
      console.log('   ✅ Function recreated successfully');
    }
  } catch (e) {
    console.log('   ⚠️  Could not execute SQL directly, will provide script');
  }

  // Step 3: Test with Jeremy's user
  console.log('\n3️⃣ Testing with Jeremy (Tony Schmitz client)...');
  const jeremyUserId = '656bc47a-2296-4c0c-977d-d0a51ce8b713';

  const { data: jeremyWorkspaces, error: jeremyError } = await supabase.rpc('get_user_workspaces', {
    p_user_id: jeremyUserId
  });

  if (jeremyError) {
    console.log('   ❌ Error:', jeremyError.message);
    console.log('   Code:', jeremyError.code);
    console.log('\n   DIAGNOSIS: The function still has an error');
  } else {
    console.log(`   ✅ Function returned ${jeremyWorkspaces?.length || 0} workspaces`);
    if (jeremyWorkspaces && jeremyWorkspaces.length > 0) {
      jeremyWorkspaces.forEach((w: any) => {
        console.log(`      - ${w.workspace_name} (ID: ${w.workspace_id})`);
      });
    }
  }

  // Step 4: Test with an admin user
  console.log('\n4️⃣ Testing with Admin user...');
  const adminUserId = 'c4beb794-c339-4862-ae68-9660740c20e1'; // aroosa@maverickmarketingllc.com

  const { data: adminWorkspaces, error: adminError } = await supabase.rpc('get_user_workspaces', {
    p_user_id: adminUserId
  });

  if (adminError) {
    console.log('   ❌ Error:', adminError.message);
  } else {
    console.log(`   ✅ Function returned ${adminWorkspaces?.length || 0} workspaces`);
    if (adminWorkspaces && adminWorkspaces.length > 5) {
      console.log('      (Showing first 5)');
      adminWorkspaces.slice(0, 5).forEach((w: any) => {
        console.log(`      - ${w.workspace_name} (ID: ${w.workspace_id})`);
      });
      console.log(`      ... and ${adminWorkspaces.length - 5} more`);
    } else if (adminWorkspaces) {
      adminWorkspaces.forEach((w: any) => {
        console.log(`      - ${w.workspace_name} (ID: ${w.workspace_id})`);
      });
    }
  }

  // Step 5: Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY:\n');

  if (jeremyError || adminError) {
    console.log('❌ Function still has errors');
    console.log('\n📝 SQL TO RUN MANUALLY:\n');
    console.log(fixedFunctionSQL);
    console.log('\nRun this SQL in Supabase SQL Editor');
  } else {
    if (jeremyWorkspaces && jeremyWorkspaces.length === 1 &&
        adminWorkspaces && adminWorkspaces.length > 10) {
      console.log('✅ SUCCESS! Everything is working correctly:');
      console.log('   - Clients see only their workspace');
      console.log('   - Admins see all workspaces');
    } else {
      console.log('⚠️  Function works but results are unexpected:');
      console.log(`   - Client workspaces: ${jeremyWorkspaces?.length || 0} (expected: 1)`);
      console.log(`   - Admin workspaces: ${adminWorkspaces?.length || 0} (expected: 35+)`);
    }
  }
}

completeFixAndTest();
