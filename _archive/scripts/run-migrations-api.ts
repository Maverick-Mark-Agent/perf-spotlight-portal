import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigrations() {
  const PROJECT_REF = 'gjqbbgrfhijescaouqkx';
  const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q';

  console.log('\n🚀 Running Database Migrations via Supabase Management API...\n');

  try {
    // Read the consolidated migrations file
    const sqlPath = join(process.cwd(), 'ALL_MIGRATIONS.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    console.log('📄 Loaded ALL_MIGRATIONS.sql');
    console.log(`📏 File size: ${sql.length} characters\n`);

    // Split SQL into individual statements (avoiding comments and blank lines)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📋 Found ${statements.length} SQL statements\n`);
    console.log('⏳ Executing statements...\n');

    // Execute each statement via the Supabase database API
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      // Skip comments
      if (statement.trim().startsWith('--')) continue;

      try {
        const response = await fetch(
          `https://${PROJECT_REF}.supabase.co/rest/v1/rpc/query`,
          {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: statement })
          }
        );

        if (response.ok) {
          successCount++;
          // Only show first 50 chars of statement
          const preview = statement.substring(0, 50).replace(/\n/g, ' ');
          console.log(`✅ [${i + 1}/${statements.length}] ${preview}...`);
        } else {
          errorCount++;
          const error = await response.text();
          console.log(`❌ [${i + 1}/${statements.length}] Failed:`, error.substring(0, 100));
        }
      } catch (error) {
        errorCount++;
        console.log(`❌ [${i + 1}/${statements.length}] Error:`, error);
      }
    }

    console.log(`\n📊 Results: ${successCount} succeeded, ${errorCount} failed\n`);

    if (errorCount > 0) {
      console.log('⚠️  Some statements failed. This is normal if:');
      console.log('   - Tables/policies already exist');
      console.log('   - Using CREATE OR REPLACE');
      console.log('   - Supabase API doesn\'t support direct SQL execution\n');
      console.log('💡 Recommended: Run migrations manually in Supabase SQL Editor');
      console.log('   https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new\n');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n⚠️  Please run the migrations manually:');
    console.log('   1. Open: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new');
    console.log('   2. Copy contents of ALL_MIGRATIONS.sql');
    console.log('   3. Paste and click "Run"\n');
  }
}

runMigrations();
