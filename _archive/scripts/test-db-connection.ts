import { createClient } from '@supabase/supabase-js';
import { secrets } from '@lib/secrets';
import { logger } from '@lib/logger';

async function testConnection() {
  console.log('\n🔍 Testing Supabase Connection...\n');

  const supabase = createClient(secrets.supabaseUrl, secrets.supabaseServiceRoleKey);

  try {
    // Test 1: Check if we can query
    console.log('Test 1: Basic query test...');
    const { data, error } = await supabase.from('client_registry').select('count');

    if (error) {
      console.log('❌ Query failed:', error.message);
    } else {
      console.log('✅ Query successful!');
    }

    // Test 2: Check for agent tables
    console.log('\nTest 2: Checking for agent tables...');
    const tables = ['agent_runs', 'agent_errors', 'raw_leads', 'cleaned_leads', 'client_zipcodes', 'monthly_cleaned_leads'];

    for (const table of tables) {
      const { error } = await supabase.from(table).select('count').limit(0);
      if (error) {
        console.log(`❌ Table '${table}' not found or inaccessible`);
      } else {
        console.log(`✅ Table '${table}' exists`);
      }
    }

    // Test 3: List all tables
    console.log('\nTest 3: Listing all accessible tables...');
    const { data: tableData, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (!tableError && tableData) {
      console.log(`Found ${tableData.length} tables in public schema`);
    }

  } catch (error) {
    console.error('❌ Connection test failed:', error);
  }

  console.log('\n✅ Connection tests complete\n');
}

testConnection();
