-- ============================================================
-- 7. AI AGENT CONVERSATION TABLES
-- ============================================================

-- Table to store conversation sessions
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Table to store individual messages per conversation
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role            text        NOT NULL CHECK (role IN ('user', 'model')),
  content         text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for fast history lookup
CREATE INDEX IF NOT EXISTS ai_messages_conversation_id_idx ON public.ai_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS ai_conversations_session_id_idx ON public.ai_conversations(session_id);

-- Enable RLS
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- Allow backend (service role) full access
DROP POLICY IF EXISTS "Service role full access on ai_conversations" ON public.ai_conversations;
CREATE POLICY "Service role full access on ai_conversations"
  ON public.ai_conversations
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on ai_messages" ON public.ai_messages;
CREATE POLICY "Service role full access on ai_messages"
  ON public.ai_messages
  USING (true)
  WITH CHECK (true);
