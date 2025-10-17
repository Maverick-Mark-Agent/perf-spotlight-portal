const { Client } = require('pg');

const client = new Client({
  host: 'aws-0-us-west-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.gjqbbgrfhijescaouqkx',
  password: 'Maverick2024!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function addTommyAsAdmin() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    const userId = '09322929-6078-4b08-bd55-e3e1ff773028';

    // Insert admin role
    console.log('Adding admin role for Tommy...');
    const insertResult = await client.query(`
      INSERT INTO user_workspace_access (user_id, workspace_name, role)
      VALUES ($1, 'admin', 'admin')
      ON CONFLICT (user_id, workspace_name) DO NOTHING
      RETURNING *;
    `, [userId]);

    console.log('✅ Admin role added!');
    console.log('Result:', insertResult.rows);

    // Verify
    console.log('\nVerifying admin access...');
    const verifyResult = await client.query(`
      SELECT * FROM user_workspace_access
      WHERE user_id = $1 AND role = 'admin';
    `, [userId]);

    console.log('✅ Verification complete!');
    console.log('Admin access entries:', verifyResult.rows);
    console.log('\n🎉 Tommy now has admin access! Refresh browser and try logging in.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
  }
}

addTommyAsAdmin();
