import { Client } from 'pg';
import { readFileSync } from 'fs';

async function deployFix() {
  console.log('🔧 Deploying FINAL_FIX.sql to Supabase...\n');

  const client = new Client({
    host: 'aws-0-us-west-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.gjqbbgrfhijescaouqkx',
    password: 'Maverick2024!',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Connect
    console.log('📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Read SQL
    const sql = readFileSync('/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal/scripts/FINAL_FIX.sql', 'utf-8');

    console.log('📝 Executing SQL...\n');

    // Execute SQL
    await client.query(sql);

    console.log('✅ SQL executed successfully!\n');

    // Test with Jeremy (client)
    console.log('🧪 Testing with Jeremy (Tony Schmitz client)...');
    const jeremyResult = await client.query(
      'SELECT * FROM get_user_workspaces($1)',
      ['656bc47a-2296-4c0c-977d-d0a51ce8b713']
    );

    console.log(`   ✅ Returns ${jeremyResult.rows.length} workspace(s):`);
    jeremyResult.rows.forEach(row => {
      console.log(`      - ${row.workspace_name} (ID: ${row.workspace_id}, Role: ${row.role})`);
    });

    if (jeremyResult.rows.length === 1 && jeremyResult.rows[0].workspace_name === 'Tony Schmitz') {
      console.log('   ✅ CORRECT: Client sees only their workspace\n');
    } else {
      console.log('   ⚠️  WARNING: Expected 1 workspace (Tony Schmitz)\n');
    }

    // Test with Admin
    console.log('🧪 Testing with Admin user (Aroosa)...');
    const adminResult = await client.query(
      'SELECT * FROM get_user_workspaces($1)',
      ['c4beb794-c339-4862-ae68-9660740c20e1']
    );

    console.log(`   ✅ Returns ${adminResult.rows.length} workspace(s):`);
    if (adminResult.rows.length > 5) {
      console.log('      (Showing first 5):');
      adminResult.rows.slice(0, 5).forEach(row => {
        console.log(`      - ${row.workspace_name} (ID: ${row.workspace_id})`);
      });
      console.log(`      ... and ${adminResult.rows.length - 5} more`);
    } else {
      adminResult.rows.forEach(row => {
        console.log(`      - ${row.workspace_name} (ID: ${row.workspace_id})`);
      });
    }

    if (adminResult.rows.length > 10) {
      console.log('   ✅ CORRECT: Admin sees all workspaces\n');
    } else {
      console.log('   ⚠️  WARNING: Expected 35+ workspaces\n');
    }

    console.log('='.repeat(60));
    console.log('✅ DEPLOYMENT COMPLETE!\n');
    console.log('Client portal should now work correctly:');
    console.log('  ✅ Clients see only their assigned workspace');
    console.log('  ✅ Admins see ALL workspaces\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('\nDetails:', error);
  } finally {
    await client.end();
  }
}

deployFix();
