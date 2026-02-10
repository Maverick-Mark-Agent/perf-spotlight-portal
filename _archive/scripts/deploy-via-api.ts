import { readFileSync } from 'fs';

async function deployViaAPI() {
  console.log('🔧 Deploying SQL via Supabase Management API...\n');

  const sql = readFileSync('/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal/scripts/FINAL_FIX.sql', 'utf-8');

  const projectRef = 'gjqbbgrfhijescaouqkx';
  const accessToken = 'sbp_765c83453a7d30be808b30e47cc230e0e9686015';

  try {
    console.log('📡 Sending SQL to Supabase...');

    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: sql
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ API Error:', result);
      throw new Error(`API returned ${response.status}: ${JSON.stringify(result)}`);
    }

    console.log('✅ SQL executed successfully!\n');
    console.log('Response:', result);

    console.log('\n✅ DEPLOYMENT COMPLETE!\n');
    console.log('The get_user_workspaces function has been fixed.');
    console.log('\nPlease test by:');
    console.log('1. Having Tony\'s team login - they should see ONLY Tony Schmitz workspace');
    console.log('2. Having admins login - they should see ALL workspaces\n');

  } catch (error: any) {
    console.error('❌ Deployment failed:', error.message);
    console.error('\n📝 MANUAL ACTION REQUIRED:');
    console.error('Copy and run scripts/FINAL_FIX.sql in Supabase SQL Editor\n');
  }
}

deployViaAPI();
