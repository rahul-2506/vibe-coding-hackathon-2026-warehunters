-- ==============================================================================
-- REVIEWLENS: USER MEMORIES SCHEMA MIGRATION
-- Version: 1.0.0
-- Description: Stores LLM-extracted user preferences, past recommendations,
--              allergies, and conversation summaries.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.user_memories (
    user_id text PRIMARY KEY,
    memory jsonb DEFAULT '{
        "skin_type": "",
        "concerns": [],
        "budget": "",
        "favorite_brands": [],
        "allergies": [],
        "past_recommendations": [],
        "conversation_summary": ""
    }'::jsonb,
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;

-- Define RLS Policies for user_memories
DROP POLICY IF EXISTS "Allow users to manage their own memories" ON public.user_memories;
CREATE POLICY "Allow users to manage their own memories" ON public.user_memories
    FOR ALL USING (true); -- Guest and authenticated users manage memory via APIs

-- Index for fast lookup by user_id
CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON public.user_memories(user_id);
