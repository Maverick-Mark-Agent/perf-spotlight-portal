import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function updateClientTargets() {
  console.log('\n=== Updating Client Monthly Sending Targets ===\n');

  // Show current values first
  console.log('Current values:');
  const { data: before, error: beforeError } = await supabase
    .from('client_registry')
    .select('workspace_name, monthly_sending_target')
    .in('workspace_name', [
      'Maverick In-house',
      'Gregg Blanchard',
      'Koppa Analytics',
      'Littlegiant',
      'Ozment Media',
      'ATI',
      'Boring Book Keeping'
    ])
    .order('workspace_name');

  if (beforeError) {
    console.error('Error fetching current values:', beforeError);
    return;
  }

  before?.forEach(client => {
    console.log(`  ${client.workspace_name}: ${client.monthly_sending_target}`);
  });

  console.log('\nApplying updates...\n');

  // Update 6 clients to 0
  const { error: error1 } = await supabase
    .from('client_registry')
    .update({ monthly_sending_target: 0 })
    .in('workspace_name', [
      'Maverick In-house',
      'Koppa Analytics',
      'Littlegiant',
      'Ozment Media',
      'ATI',
      'Boring Book Keeping'
    ]);

  if (error1) {
    console.error('Error updating to 0:', error1);
    return;
  }

  // Update Gregg Blanchard to 30,000
  const { error: error2 } = await supabase
    .from('client_registry')
    .update({ monthly_sending_target: 30000 })
    .eq('workspace_name', 'Gregg Blanchard');

  if (error2) {
    console.error('Error updating Gregg Blanchard:', error2);
    return;
  }

  // Show new values
  console.log('New values:');
  const { data: after, error: afterError } = await supabase
    .from('client_registry')
    .select('workspace_name, monthly_sending_target')
    .in('workspace_name', [
      'Maverick In-house',
      'Gregg Blanchard',
      'Koppa Analytics',
      'Littlegiant',
      'Ozment Media',
      'ATI',
      'Boring Book Keeping'
    ])
    .order('workspace_name');

  if (afterError) {
    console.error('Error fetching new values:', afterError);
    return;
  }

  after?.forEach(client => {
    console.log(`  ${client.workspace_name}: ${client.monthly_sending_target}`);
  });

  // Calculate new total
  const { data: allClients, error: totalError } = await supabase
    .from('client_registry')
    .select('monthly_sending_target')
    .eq('is_active', true);

  if (!totalError && allClients) {
    const total = allClients.reduce((sum, c) => sum + (c.monthly_sending_target || 0), 0);
    console.log(`\n✅ Updates complete!`);
    console.log(`New total monthly target across all active clients: ${total.toLocaleString()}`);
  }
}

updateClientTargets();
