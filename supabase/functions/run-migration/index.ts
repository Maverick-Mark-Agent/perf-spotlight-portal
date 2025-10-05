import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const PROJECT_REF = 'gjqbbgrfhijescaouqkx';
    const DB_URL = 'postgresql://postgres.gjqbbgrfhijescaouqkx:Maverick2024!@aws-0-us-west-1.pooler.supabase.com:6543/postgres';
    
    // Use pg_isready to test connection
    const testCmd = new Deno.Command("pg_isready", {
      args: ["-h", "aws-0-us-west-1.pooler.supabase.com", "-p", "6543", "-U", "postgres.gjqbbgrfhijescaouqkx"],
    });

    const { code, stdout, stderr } = await testCmd.output();

    return new Response(
      JSON.stringify({
        test: "Connection test",
        code,
        stdout: new TextDecoder().decode(stdout),
        stderr: new TextDecoder().decode(stderr)
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
