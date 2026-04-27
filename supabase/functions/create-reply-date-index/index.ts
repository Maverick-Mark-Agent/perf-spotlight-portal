import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async () => {
  const dbUrl = Deno.env.get('SUPABASE_DB_URL');
  
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: 'No SUPABASE_DB_URL' }), { status: 500 });
  }

  // Use postgres directly via pg driver
  const { Client } = await import('https://deno.land/x/postgres@v0.17.0/mod.ts');
  const client = new Client(dbUrl);
  
  try {
    await client.connect();
    await client.queryObject('CREATE INDEX IF NOT EXISTS lead_replies_reply_date_idx ON lead_replies (reply_date DESC)');
    await client.end();
    return new Response(JSON.stringify({ success: true, message: 'Index created' }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
