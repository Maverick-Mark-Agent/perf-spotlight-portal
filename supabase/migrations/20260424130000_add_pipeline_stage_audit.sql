-- Audit trigger for pipeline_stage changes on client_leads.
--
-- Why: clients report leads "randomly moving" in the Kanban. We have multiple
-- edge functions and the UI drag-and-drop all writing pipeline_stage directly.
-- Without an audit log we can't pinpoint which writer is reversing user moves.
-- This table captures every UPDATE that changes pipeline_stage along with the
-- Postgres role, JWT sub, request headers (user-agent, referer), and client IP.
--
-- To investigate "lead X was at quoting yesterday and is back at interested":
--   SELECT * FROM pipeline_stage_history
--   WHERE lead_id = '<uuid>' ORDER BY changed_at DESC;

CREATE TABLE IF NOT EXISTS public.pipeline_stage_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID NOT NULL REFERENCES public.client_leads(id) ON DELETE CASCADE,
    workspace_name TEXT NOT NULL,
    lead_email TEXT,
    old_stage TEXT,
    new_stage TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- "Who" fields — all optional because context may not always be available
    db_role TEXT,                  -- Postgres role: service_role / authenticated / anon
    jwt_sub TEXT,                  -- sub claim from the request JWT (user id or service)
    jwt_role TEXT,                 -- role claim from the request JWT
    user_agent TEXT,               -- from request headers — identifies edge function / browser
    referer TEXT,                  -- page / function that initiated the write
    client_addr INET               -- IP address of the caller
);

CREATE INDEX IF NOT EXISTS idx_pipeline_history_lead_id
    ON public.pipeline_stage_history (lead_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_history_changed_at
    ON public.pipeline_stage_history (changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_history_workspace
    ON public.pipeline_stage_history (workspace_name, changed_at DESC);

COMMENT ON TABLE public.pipeline_stage_history IS
  'Append-only audit of pipeline_stage transitions on client_leads. Captures who/when/where so we can diagnose unexpected stage changes.';

CREATE OR REPLACE FUNCTION public.log_pipeline_stage_change()
RETURNS TRIGGER AS $$
DECLARE
    v_claims JSONB;
    v_headers JSONB;
BEGIN
    -- These current_setting() calls wrap safely — if the setting is missing,
    -- the `true` second argument returns NULL instead of erroring. We then
    -- guard the JSONB cast so a malformed value still can't break the write.
    BEGIN
        v_claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
    EXCEPTION WHEN others THEN
        v_claims := NULL;
    END;

    BEGIN
        v_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
    EXCEPTION WHEN others THEN
        v_headers := NULL;
    END;

    INSERT INTO public.pipeline_stage_history (
        lead_id, workspace_name, lead_email,
        old_stage, new_stage,
        db_role, jwt_sub, jwt_role, user_agent, referer, client_addr
    ) VALUES (
        NEW.id,
        NEW.workspace_name,
        NEW.lead_email,
        OLD.pipeline_stage,
        NEW.pipeline_stage,
        current_setting('role', true),
        v_claims->>'sub',
        v_claims->>'role',
        v_headers->>'user-agent',
        v_headers->>'referer',
        inet_client_addr()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.log_pipeline_stage_change IS
  'Trigger function: writes a row to pipeline_stage_history on every pipeline_stage change. SECURITY DEFINER so RLS on pipeline_stage_history does not block inserts from authenticated clients.';

DROP TRIGGER IF EXISTS trg_log_pipeline_stage_change ON public.client_leads;

CREATE TRIGGER trg_log_pipeline_stage_change
    AFTER UPDATE OF pipeline_stage ON public.client_leads
    FOR EACH ROW
    WHEN (OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage)
    EXECUTE FUNCTION public.log_pipeline_stage_change();

-- Read access for authenticated users (so the UI/admin tools can query it).
-- Write access is only via the trigger.
ALTER TABLE public.pipeline_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipeline_stage_history readable by authenticated"
    ON public.pipeline_stage_history FOR SELECT
    TO authenticated
    USING (true);

-- Verification after apply:
--   -- Drag a lead in the Kanban, then:
--   SELECT old_stage, new_stage, db_role, jwt_role, user_agent, changed_at
--   FROM pipeline_stage_history ORDER BY changed_at DESC LIMIT 5;
--
--   -- Find leads that bounced between stages:
--   SELECT lead_id, COUNT(*) AS moves, array_agg(new_stage ORDER BY changed_at) AS path
--   FROM pipeline_stage_history
--   WHERE changed_at > now() - interval '24 hours'
--   GROUP BY lead_id HAVING COUNT(*) > 2
--   ORDER BY moves DESC;
