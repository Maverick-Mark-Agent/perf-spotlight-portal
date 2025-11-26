-- AI Expense Assistant Tables
-- Tracks conversation sessions and messages for the expense assistant chatbot

-- Track AI assistant conversations
CREATE TABLE IF NOT EXISTS expense_assistant_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  expenses_created INTEGER DEFAULT 0,
  receipts_matched INTEGER DEFAULT 0
);

-- Track individual messages for context
CREATE TABLE IF NOT EXISTS expense_assistant_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES expense_assistant_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb, -- [{file_name, file_type, storage_path}]
  metadata JSONB DEFAULT '{}'::jsonb, -- {expenses_created: [...], receipts_matched: [...]}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assistant_messages_session ON expense_assistant_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_assistant_sessions_started ON expense_assistant_sessions(started_at DESC);

-- RLS Policies (disabled for now since this is admin-only)
ALTER TABLE expense_assistant_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_assistant_messages ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users full access (admin dashboard)
CREATE POLICY "Allow all for expense_assistant_sessions" ON expense_assistant_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for expense_assistant_messages" ON expense_assistant_messages
  FOR ALL USING (true) WITH CHECK (true);
