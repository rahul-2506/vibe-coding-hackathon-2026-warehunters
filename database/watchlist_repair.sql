-- =========================================================================
-- REVIEWLENS: WATCHLIST SCHEMA REPAIR
-- Target: PostgreSQL / Supabase
-- Purpose: Unify watchlists table with frontend CartContext JSONB expectations
-- =========================================================================

-- 1. Create the watchlists table if not exists with correct schema matching CartContext.jsx
CREATE TABLE IF NOT EXISTS public.watchlists (
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    items jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. Ensure items column exists (if table existed previously)
ALTER TABLE public.watchlists ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]'::jsonb;

-- 3. Ensure RLS is active
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;

-- 4. Re-setup secure user policy
DROP POLICY IF EXISTS "Users can manage their own watchlists" ON public.watchlists;
CREATE POLICY "Users can manage their own watchlists" ON public.watchlists
    FOR ALL USING (auth.uid() = user_id);
