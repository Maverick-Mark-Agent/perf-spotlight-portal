const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gjqbbgrfhijescaouqkx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
);

async function diagnose() {
  console.log('=== lead_replies: original_sender_email_id values (recent) ===');
  const { data: lr, error } = await supabase
    .from('lead_replies')
    .select('workspace_name, original_sender_email_id, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) console.error(error.message);
  else {
    lr.forEach(r => {
      console.log(`  [${r.created_at?.substring(0,16)}] "${r.workspace_name}": original_sender_email_id=${r.original_sender_email_id}`);
    });
    
    const withId = lr.filter(r => r.original_sender_email_id !== null);
    const withoutId = lr.filter(r => r.original_sender_email_id === null);
    console.log(`\n  Has original_sender_email_id: ${withId.length}`);
    console.log(`  Missing original_sender_email_id: ${withoutId.length}`);
  }
}

diagnose().catch(console.error);
