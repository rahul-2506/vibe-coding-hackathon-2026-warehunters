-- ==============================================================================
-- REVIEWLENS: SESSION MEMORY SCHEMA MIGRATION
-- Version: 1.1.0
-- ==============================================================================

-- 1. Create chat_sessions table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
    sender text NOT NULL CHECK (sender IN ('user', 'assistant')),
    message text NOT NULL,
    data jsonb DEFAULT NULL, -- Stores any structured JSON responses (e.g. recommendations list)
    created_at timestamp with time zone DEFAULT now()
);

-- 3. Create user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    skin_type text DEFAULT 'normal',
    budget numeric DEFAULT 1500,
    concerns text[] DEFAULT '{}'::text[],
    disliked_ingredients text[] DEFAULT '{}'::text[],
    preferred_brands text[] DEFAULT '{}'::text[],
    product_interests jsonb DEFAULT '[]'::jsonb,
    recommendation_history jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- 5. Define RLS Policies

-- chat_sessions: Users can view/create their own sessions, public/anonymous can view their own fallback
DROP POLICY IF EXISTS "Users can manage their own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can manage their own chat sessions" ON public.chat_sessions
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- chat_messages: Users can access messages within their sessions
DROP POLICY IF EXISTS "Users can manage messages in their sessions" ON public.chat_messages;
CREATE POLICY "Users can manage messages in their sessions" ON public.chat_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.chat_sessions 
            WHERE chat_sessions.id = chat_messages.session_id 
            AND (chat_sessions.user_id = auth.uid() OR chat_sessions.user_id IS NULL)
        )
    );

-- user_preferences: Users can manage their own preferences
DROP POLICY IF EXISTS "Users can manage their own preferences" ON public.user_preferences;
CREATE POLICY "Users can manage their own preferences" ON public.user_preferences
    FOR ALL USING (auth.uid() = user_id);

-- 6. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);
