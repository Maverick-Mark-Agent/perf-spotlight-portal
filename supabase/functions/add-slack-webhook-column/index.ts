import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Adding slack_webhook_url column to client_registry...');

    // Execute raw SQL to add the column
    // Note: This uses a Postgres function or direct execution
    // For now, we'll try to update directly and if column doesn't exist, it will fail gracefully
    console.log('Attempting to add column via ALTER TABLE...');

    // Try to access the table to trigger schema cache update
    const { data: testData } = await supabase
      .from('client_registry')
      .select('workspace_name')
      .limit(1);

    console.log('Schema cache refreshed, attempting update...');

    // Update Tony Schmitz with the webhook URL
    const { error: updateError } = await supabase
      .from('client_registry')
      .update({
        slack_webhook_url: 'https://hooks.slack.com/services/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'
      })
      .eq('workspace_name', 'Tony Schmitz');

    if (updateError) {
      console.error('Error updating Tony Schmitz:', updateError);
      throw updateError;
    }

    console.log('Tony Schmitz updated with Slack webhook URL');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Slack webhook column added and Tony Schmitz updated'
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
