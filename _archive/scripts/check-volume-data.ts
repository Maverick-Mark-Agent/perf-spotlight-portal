import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function checkData() {
  console.log('\n=== Checking Available Data ===\n');

  // Check what dates are available
  const { data: dates, error: datesError } = await supabase
    .from('client_metrics')
    .select('metric_date, metric_type')
    .eq('metric_type', 'mtd')
    .order('metric_date', { ascending: false })
    .limit(5);

  console.log('Recent MTD metric dates:');
  dates?.forEach(d => console.log(`  - ${d.metric_date}`));

  // Get the most recent date
  const recentDate = dates?.[0]?.metric_date;
  console.log(`\nUsing date: ${recentDate}\n`);

  if (!recentDate) {
    console.log('No data found!');
    return;
  }

  // Query with the most recent date
  const { data, error } = await supabase
    .from('client_metrics')
    .select(`
      workspace_name,
      emails_sent_mtd,
      client_registry!inner(
        display_name,
        monthly_sending_target,
        is_active
      )
    `)
    .eq('metric_type', 'mtd')
    .eq('metric_date', recentDate)
    .eq('client_registry.is_active', true)
    .order('emails_sent_mtd', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('=== CLIENT EMAIL VOLUMES (MTD) ===\n');
  console.log('Client Name                    | Emails Sent MTD | Monthly Target');
  console.log('-------------------------------|-----------------|---------------');

  let totalEmails = 0;
  let totalTarget = 0;

  data?.forEach((row: any) => {
    const name = row.client_registry?.display_name || row.workspace_name;
    const emails = row.emails_sent_mtd || 0;
    const target = row.client_registry?.monthly_sending_target || 0;

    totalEmails += emails;
    totalTarget += target;

    console.log(`${name.padEnd(30)} | ${emails.toLocaleString().padStart(15)} | ${target.toLocaleString().padStart(14)}`);
  });

  console.log('-------------------------------|-----------------|---------------');
  console.log(`TOTAL (${data?.length || 0} clients)              | ${totalEmails.toLocaleString().padStart(15)} | ${totalTarget.toLocaleString().padStart(14)}`);
  console.log('\n');
}

checkData();
