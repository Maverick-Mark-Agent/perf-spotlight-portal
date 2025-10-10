import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const sql = body.sql;

    if (!sql) {
      throw new Error('SQL query required');
    }

    console.log('Executing SQL:', sql);

    // Get database connection string from environment
    const dbUrl = Deno.env.get('DB_URL') || Deno.env.get('SUPABASE_DB_URL');

    if (!dbUrl) {
      throw new Error('Database URL not configured');
    }

    // Connect to PostgreSQL
    const client = new Client(dbUrl);
    await client.connect();

    try {
      const result = await client.queryObject(sql);
      await client.end();

      return new Response(
        JSON.stringify({
          success: true,
          rows: result.rows,
          rowCount: result.rowCount
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (sqlError) {
      await client.end();
      throw sqlError;
    }

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
