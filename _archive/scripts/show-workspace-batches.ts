import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const { data } = await supabase
    .from('client_registry')
    .select('workspace_name')
    .eq('is_active', true)
    .order('workspace_name');

  console.log('Workspace Processing Order (batches of 3):\n');
  console.log('='.repeat(60));

  data?.forEach((w, i) => {
    const batch = Math.floor(i / 3) + 1;
    const position = i % 3;
    const marker = w.workspace_name === 'Jason Binyon' ? ' ← JASON BINYON ***' : '';
    console.log(`Batch ${batch.toString().padStart(2)}: [${position}] ${w.workspace_name}${marker}`);
  });

  console.log('='.repeat(60));
}

main();
