-- COO Brain — personal-use tables for the daily brief agent.
-- All tables prefixed `coo_`. RLS locked so only the COO user can read/write
-- via the dashboard; service-role (edge functions) bypasses RLS as expected.
--
-- Owner user_id: U097J97AVU7 corresponds to Hussain Mujtaba in Slack, but the
-- Supabase user is identified by auth.users.email = 'hussain@maverickmarketingllc.com'.
-- We grant access to that email only.

-- ───────────────────────────────────────────────────────────────────────────
-- coo_brief_history: one row per generated daily brief
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coo_brief_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_date DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The structured brief Claude returned (sections: client_queries, blockers,
  -- decisions_needed, ideas_to_revisit, my_followups, delegations, etc.)
  brief_json JSONB NOT NULL,
  -- The raw Slack transcript fed to Claude — kept for debugging / re-runs
  source_transcript TEXT,
  -- Channels and time window covered
  source_channels TEXT[] NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  -- Claude usage tracking
  model TEXT,
  input_tokens INT,
  output_tokens INT,
  -- The Slack message ts (timestamp) of the DM we sent — useful for thread replies
  slack_dm_ts TEXT,
  -- Errors (if any)
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coo_brief_history_date ON public.coo_brief_history(brief_date DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- coo_tasks: extracted action items / followups / decisions
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coo_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- "client_query" | "blocker" | "decision_needed" | "idea" | "my_followup"
  -- | "delegation" | "manual_note"
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  -- Who owns it: "me" (Hussain) | "tommy" | "sarah" | "thomas" | "davis" | etc.
  owner TEXT,
  -- Which client this relates to (FK by name to client_registry)
  workspace_name TEXT,
  -- Slack source: where did this come from?
  source_channel_id TEXT,
  source_channel_name TEXT,
  source_message_ts TEXT,
  source_message_url TEXT,
  source_user_id TEXT,
  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'done' | 'snoozed' | 'dismissed'
  snoozed_until TIMESTAMPTZ,
  done_at TIMESTAMPTZ,
  -- Brief that surfaced this task
  brief_id UUID REFERENCES public.coo_brief_history(id) ON DELETE SET NULL,
  -- Free-form notes added later via DM reply
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coo_tasks_status ON public.coo_tasks(status);
CREATE INDEX IF NOT EXISTS idx_coo_tasks_brief ON public.coo_tasks(brief_id);
CREATE INDEX IF NOT EXISTS idx_coo_tasks_workspace ON public.coo_tasks(workspace_name);

-- ───────────────────────────────────────────────────────────────────────────
-- coo_manual_notes: stuff Hussain DMs to TopG ad-hoc ("remember X")
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coo_manual_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'slack_dm', -- 'slack_dm' | 'manual'
  slack_message_ts TEXT,
  -- Was this surfaced in a brief? when?
  surfaced_in_brief_id UUID REFERENCES public.coo_brief_history(id) ON DELETE SET NULL,
  surfaced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coo_manual_notes_unsurfaced ON public.coo_manual_notes(surfaced_at) WHERE surfaced_at IS NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- RLS — only the COO email can read these tables via the dashboard.
-- Edge functions use the service role and bypass RLS.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.coo_brief_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coo_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coo_manual_notes ENABLE ROW LEVEL SECURITY;

-- Policy: only authenticated users with email = hussain@maverickmarketingllc.com
-- can SELECT. No INSERT/UPDATE/DELETE policies for authenticated users — only
-- service-role writes (which bypass RLS).
DROP POLICY IF EXISTS coo_brief_history_owner_only ON public.coo_brief_history;
CREATE POLICY coo_brief_history_owner_only ON public.coo_brief_history
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'hussain@maverickmarketingllc.com');

DROP POLICY IF EXISTS coo_tasks_owner_only ON public.coo_tasks;
CREATE POLICY coo_tasks_owner_only ON public.coo_tasks
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'hussain@maverickmarketingllc.com');

DROP POLICY IF EXISTS coo_manual_notes_owner_only ON public.coo_manual_notes
;
CREATE POLICY coo_manual_notes_owner_only ON public.coo_manual_notes
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'hussain@maverickmarketingllc.com');

-- Belt-and-suspenders: explicitly REVOKE access for anon (public) role too.
REVOKE ALL ON public.coo_brief_history FROM anon;
REVOKE ALL ON public.coo_tasks FROM anon;
REVOKE ALL ON public.coo_manual_notes FROM anon;

COMMENT ON TABLE public.coo_brief_history IS 'COO Brain: daily brief snapshots. Personal to Hussain only — RLS locked.';
COMMENT ON TABLE public.coo_tasks IS 'COO Brain: extracted action items from briefs + manual entries. RLS locked.';
COMMENT ON TABLE public.coo_manual_notes IS 'COO Brain: ad-hoc notes Hussain DMs to TopG between briefs. RLS locked.';
