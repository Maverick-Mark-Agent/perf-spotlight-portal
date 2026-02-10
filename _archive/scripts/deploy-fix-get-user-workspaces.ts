import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function deployFix() {
  console.log('🔧 Deploying fix to get_user_workspaces function...\n');

  const fixSQL = `
    CREATE OR REPLACE FUNCTION public.get_user_workspaces(p_user_id UUID)
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
    BEGIN
      RETURN QUERY
      SELECT
        cr.id AS workspace_id,
        uwa.workspace_name,
        uwa.role,
        COUNT(DISTINCT cl.id) AS leads_count,
        COUNT(DISTINCT cl.id) FILTER (WHERE cl.pipeline_stage = 'won') AS won_leads_count
      FROM public.user_workspace_access uwa
      LEFT JOIN public.client_registry cr ON cr.workspace_name = uwa.workspace_name
      LEFT JOIN public.client_leads cl ON cl.workspace_name = uwa.workspace_name
      WHERE uwa.user_id = p_user_id
      GROUP BY cr.id, uwa.workspace_name, uwa.role
      ORDER BY uwa.workspace_name;
    END;
    $$;
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: fixSQL });

    if (error) {
      console.error('❌ Error deploying fix:', error);
      console.log('\n⚠️  Trying alternative method with direct query...\n');

      // Alternative: Try to deploy via Edge Function
      const { data: functionData, error: functionError } = await supabase.functions.invoke('exec-sql', {
        body: { sql: fixSQL }
      });

      if (functionError) {
        console.error('❌ Alternative method also failed:', functionError);
        console.log('\n📝 MANUAL DEPLOYMENT REQUIRED:');
        console.log('Please run this SQL in Supabase SQL Editor:\n');
        console.log(fixSQL);
        return;
      }

      console.log('✅ Function deployed via alternative method!');
      return;
    }

    console.log('✅ Function deployed successfully!');
    console.log('\n🧪 Testing the updated function...\n');

    // Test with a sample user (we'll use any authenticated user)
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      const { data: testData, error: testError } = await supabase.rpc('get_user_workspaces', {
        p_user_id: session.user.id
      });

      if (testError) {
        console.error('❌ Test failed:', testError);
      } else {
        console.log('✅ Test successful! User workspaces:', testData);
      }
    } else {
      console.log('⚠️  No authenticated session, skipping test.');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

deployFix();
