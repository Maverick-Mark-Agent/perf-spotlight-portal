import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  console.log('Attempting to query various tables to find what exists...\n');

  const tablesToCheck = [
    'webhook_delivery_log',
    'webhook_logs',
    'daily_kpi_metrics',
    'kpi_metrics',
    'contacts',
    'raw_contacts',
    'workspace',
    'workspaces',
    'cron_jobs',
    'scheduled_jobs'
  ];

  for (const table of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: Table exists! Found ${data?.length || 0} record(s) in sample`);
        if (data && data.length > 0) {
          console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`);
        }
      }
    } catch (err) {
      console.log(`❌ ${table}: Exception - ${err}`);
    }
  }
}

listTables().catch(console.error);
