-- Create lead_replies table for real-time replies dashboard
-- Stores ALL replies (positive and negative) from Email Bison webhooks
-- Enables real-time monitoring of lead responses across all workspaces

CREATE TABLE IF NOT EXISTS public.lead_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Workspace & Lead Info
  workspace_name TEXT NOT NULL,
  lead_email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  title TEXT,

  -- Reply Details
  reply_text TEXT, -- Full reply content from lead
  reply_date TIMESTAMP WITH TIME ZONE NOT NULL,
  sentiment TEXT, -- 'positive', 'negative', 'neutral' from Bison
  is_interested BOOLEAN DEFAULT false, -- Bison's interested classification

  -- Bison Metadata
  bison_lead_id TEXT,
  bison_reply_id TEXT UNIQUE, -- Prevent duplicate replies
  bison_conversation_url TEXT,
  bison_workspace_id INTEGER,

  -- Dashboard Management
  is_handled BOOLEAN DEFAULT false,
  assigned_to TEXT,
  handler_notes TEXT,
  handled_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_replies_workspace
  ON public.lead_replies(workspace_name);

CREATE INDEX IF NOT EXISTS idx_lead_replies_date
  ON public.lead_replies(reply_date DESC);

CREATE INDEX IF NOT EXISTS idx_lead_replies_sentiment
  ON public.lead_replies(sentiment);

CREATE INDEX IF NOT EXISTS idx_lead_replies_handled
  ON public.lead_replies(is_handled);

CREATE INDEX IF NOT EXISTS idx_lead_replies_lead_email
  ON public.lead_replies(lead_email);

CREATE INDEX IF NOT EXISTS idx_lead_replies_bison_reply_id
  ON public.lead_replies(bison_reply_id);

CREATE INDEX IF NOT EXISTS idx_lead_replies_created
  ON public.lead_replies(created_at DESC);

-- Composite index for dashboard queries (workspace + date)
CREATE INDEX IF NOT EXISTS idx_lead_replies_workspace_date
  ON public.lead_replies(workspace_name, reply_date DESC);

-- Enable Row Level Security
ALTER TABLE public.lead_replies ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users (admin dashboard)
DROP POLICY IF EXISTS "Allow all operations on lead_replies" ON public.lead_replies;
CREATE POLICY "Allow all operations on lead_replies"
  ON public.lead_replies
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_lead_replies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_lead_replies_updated_at ON public.lead_replies;
CREATE TRIGGER set_lead_replies_updated_at
  BEFORE UPDATE ON public.lead_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_lead_replies_updated_at();

-- Enable Realtime for instant dashboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_replies;

-- Add comments for documentation
COMMENT ON TABLE public.lead_replies IS 'Real-time feed of all lead replies from Email Bison webhooks (positive and negative)';
COMMENT ON COLUMN public.lead_replies.reply_text IS 'Full text content of the lead reply';
COMMENT ON COLUMN public.lead_replies.sentiment IS 'Reply sentiment: positive, negative, or neutral';
COMMENT ON COLUMN public.lead_replies.is_interested IS 'Bison classification: true if lead expressed interest';
COMMENT ON COLUMN public.lead_replies.is_handled IS 'Whether this reply has been reviewed/actioned';
COMMENT ON COLUMN public.lead_replies.bison_reply_id IS 'Unique ID from Bison to prevent duplicate webhook processing';

-- Verify table creation
SELECT 'lead_replies table created successfully!' as status;
