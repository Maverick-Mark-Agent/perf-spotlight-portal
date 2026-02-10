import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJasonTarget() {
  console.log('Checking Jason Binyon daily_sending_target...\n');

  const { data, error } = await supabase
    .from('client_registry')
    .select('workspace_name, display_name, daily_sending_target, monthly_sending_target, monthly_kpi_target')
    .eq('workspace_name', 'Jason Binyon')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Jason Binyon data:');
  console.log('Workspace Name:', data.workspace_name);
  console.log('Display Name:', data.display_name);
  console.log('Daily Sending Target:', data.daily_sending_target);
  console.log('Monthly Sending Target:', data.monthly_sending_target);
  console.log('Monthly KPI Target:', data.monthly_kpi_target);
  console.log('\nCalculated daily target (monthly_sending_target / 30):', Math.round((data.monthly_sending_target || 0) / 30));
}

checkJasonTarget();
