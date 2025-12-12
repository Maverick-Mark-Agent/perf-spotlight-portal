import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODA5MTU2NywiZXhwIjoyMDQzNjY3NTY3fQ.k-ant-api03-5h09QQR7HYaS9f7vfCjENfm6qJ0qjbGnK2FNwDR3DeVwBM_Q6rw3ne7CTp6h2OBQOfrg9IBD6xnthj6hsYbVJQ-Sum12QAA';

const EMAIL_TO_INVITE = 'hassan@maverickmarketingllc.com';
const ROLE = 'admin';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('================================================================================');
  console.log('INVITING HASSAN TO ALL WORKSPACES VIA EDGE FUNCTION');
  console.log('================================================================================');
  console.log(`Email: ${EMAIL_TO_INVITE}`);
  console.log(`Role: ${ROLE}`);
  console.log('================================================================================\n');

  try {
    const { data, error } = await supabase.functions.invoke('invite-user-all-workspaces', {
      body: {
        email: EMAIL_TO_INVITE,
        role: ROLE,
      },
    });

    if (error) {
      console.error('❌ Error invoking Edge Function:', error);
      return;
    }

    console.log('\n================================================================================');
    console.log('RESULTS');
    console.log('================================================================================');
    console.log(JSON.stringify(data, null, 2));
    console.log('================================================================================');

    if (data.successful > 0) {
      console.log(`\n✅ Successfully invited Hassan to ${data.successful} workspace(s)!`);
    }

    if (data.failed > 0) {
      console.log(`\n⚠️  Failed to invite to ${data.failed} workspace(s)`);
      if (data.errors && data.errors.length > 0) {
        console.log('\nFailed workspaces:');
        data.errors.forEach((err: any) => {
          console.log(`  - ${err.workspace}: ${err.error}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

main();