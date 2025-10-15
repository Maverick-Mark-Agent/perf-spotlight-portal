import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function getVolumeData() {
  const today = new Date().toISOString().split('T')[0];

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
    .eq('metric_date', today)
    .eq('client_registry.is_active', true)
    .order('emails_sent_mtd', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== CLIENT EMAIL VOLUMES (MTD) ===\n');
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

getVolumeData();
