const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function triggerSync() {
  console.log('Triggering Email Bison sync job...\n');

  try {
    const { data, error } = await supabase.functions.invoke('poll-sender-emails', {
      body: { force: true }
    });

    if (error) {
      console.error('❌ Error triggering sync:', error);
      return;
    }

    console.log('✅ Sync job triggered successfully!');
    console.log('Response:', data);
    console.log('\nNote: The sync may take 1-2 minutes to complete.');
    console.log('Check the database after a few minutes to see fresh data.');

  } catch (err) {
    console.error('❌ Exception:', err);
  }
}

triggerSync();
