/**
 * Deploy daily billable revenue function directly via Supabase
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.COuKAWTnNslBkHiVg2iFT_V0PrQ-iujqv1qJuYZawJI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deployFunction() {
  console.log('📥 Reading SQL migration file...\n');

  const sqlPath = path.join(process.cwd(), 'supabase/migrations/20251014200000_add_daily_billable_revenue_function.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('🚀 Deploying daily billable revenue function...\n');

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Error deploying function:', error);
      throw error;
    }

    console.log('✅ Function deployed successfully!\n');

    // Test the function
    console.log('🧪 Testing function with current month...\n');
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    const { data: testData, error: testError } = await supabase
      .rpc('get_daily_billable_revenue', { month_year: currentMonth });

    if (testError) {
      console.error('❌ Test error:', testError);
    } else {
      console.log(`✅ Function test successful! Found ${testData?.length || 0} days with revenue data\n`);
      if (testData && testData.length > 0) {
        console.log('Sample data (first 5 days):');
        testData.slice(0, 5).forEach((row: any) => {
          console.log(`  Day ${row.day_of_month}: $${row.daily_revenue} (Cumulative: $${row.cumulative_revenue}, Leads: ${row.lead_count})`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

deployFunction();
