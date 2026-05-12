// One-shot migration runner for the COO Brain tables.
// Applies the SQL inline so we don't depend on `supabase db push` succeeding
// against a project with pre-existing migration state issues.
//
// SAFE TO RUN MULTIPLE TIMES — uses CREATE TABLE IF NOT EXISTS, DROP POLICY IF
// EXISTS, etc. throughout. Idempotent.
//
// After this runs successfully once, this function can be deleted.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SQL = `
CREATE TABLE IF NOT EXISTS public.coo_brief_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_date DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  brief_json JSONB NOT NULL,
  source_transcript TEXT,
  source_channels TEXT[] NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  model TEXT,
  input_tokens INT,
  output_tokens INT,
  slack_dm_ts TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coo_brief_history_date ON public.coo_brief_history(brief_date DESC);

CREATE TABLE IF NOT EXISTS public.coo_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  owner TEXT,
  workspace_name TEXT,
  source_channel_id TEXT,
  source_channel_name TEXT,
  source_message_ts TEXT,
  source_message_url TEXT,
  source_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  snoozed_until TIMESTAMPTZ,
  done_at TIMESTAMPTZ,
  brief_id UUID REFERENCES public.coo_brief_history(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coo_tasks_status ON public.coo_tasks(status);
CREATE INDEX IF NOT EXISTS idx_coo_tasks_brief ON public.coo_tasks(brief_id);
CREATE INDEX IF NOT EXISTS idx_coo_tasks_workspace ON public.coo_tasks(workspace_name);

CREATE TABLE IF NOT EXISTS public.coo_manual_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'slack_dm',
  slack_message_ts TEXT,
  surfaced_in_brief_id UUID REFERENCES public.coo_brief_history(id) ON DELETE SET NULL,
  surfaced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coo_manual_notes_unsurfaced ON public.coo_manual_notes(surfaced_at) WHERE surfaced_at IS NULL;

ALTER TABLE public.coo_brief_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coo_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coo_manual_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coo_brief_history_owner_only ON public.coo_brief_history;
CREATE POLICY coo_brief_history_owner_only ON public.coo_brief_history
  FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'email' = 'hussain@maverickmarketingllc.com');

DROP POLICY IF EXISTS coo_tasks_owner_only ON public.coo_tasks;
CREATE POLICY coo_tasks_owner_only ON public.coo_tasks
  FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'email' = 'hussain@maverickmarketingllc.com');

DROP POLICY IF EXISTS coo_manual_notes_owner_only ON public.coo_manual_notes;
CREATE POLICY coo_manual_notes_owner_only ON public.coo_manual_notes
  FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'email' = 'hussain@maverickmarketingllc.com');

REVOKE ALL ON public.coo_brief_history FROM anon;
REVOKE ALL ON public.coo_tasks FROM anon;
REVOKE ALL ON public.coo_manual_notes FROM anon;
`;

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('POST only', { status: 405 });
  }
  const dbUrl = Deno.env.get('SUPABASE_DB_URL') || Deno.env.get('DB_URL');
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: 'no DB URL' }), { status: 500 });
  }

  // Allow caller to override the SQL via POST body for one-off ops.
  let sqlToRun = SQL;
  try {
    const body = await req.json();
    if (body?.sql && typeof body.sql === 'string' && body.sql.trim().length > 0) {
      sqlToRun = body.sql;
    }
  } catch (_) {
    // empty body — use default schema SQL
  }

  // Use the postgres deno driver to run raw SQL
  const { Client } = await import('https://deno.land/x/postgres@v0.17.0/mod.ts');
  const client = new Client(dbUrl);
  try {
    await client.connect();
    const statements = sqlToRun.split(/;\s*\n/).map(s => s.trim()).filter(s => s.length > 0);
    const results: string[] = [];
    for (const stmt of statements) {
      try {
        const r = await client.queryArray(stmt + ';');
        results.push('ok: ' + stmt.split('\n')[0].slice(0, 80) + ` (rows=${r.rowCount ?? 0})`);
      } catch (e: any) {
        results.push('ERR: ' + (e?.message || 'unknown') + ' on ' + stmt.split('\n')[0].slice(0, 80));
      }
    }
    return new Response(JSON.stringify({ ok: true, results }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'unknown' }), { status: 500 });
  } finally {
    try { await client.end(); } catch {}
  }
});
