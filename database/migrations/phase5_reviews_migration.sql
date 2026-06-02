-- =========================================================================
-- REVIEWLENS: PHASE 5 INTERACTIVE REVIEWS & ANALYZER SCHEMA MIGRATION
-- Target: PostgreSQL / Supabase
-- Purpose: Safely extend reviews table with interactive review inputs,
--          ML classification telemetry, analysis breakdowns, and reviewer scores.
-- =========================================================================

-- 1. Descriptive & Interactive review inputs
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS experience_mood text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS highlight_categories text[] DEFAULT '{}'::text[];
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS recommendation text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS discovery_source text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS confidence_score integer DEFAULT 100;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS image_url text;

-- 2. ML telemetry columns
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS classification text DEFAULT 'GENUINE';
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS ml_explanation text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS ai_confidence integer DEFAULT 80;

-- 3. Dynamic Telemetry & Hackathon gamification columns
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS analysis_breakdown jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reviewer_score integer DEFAULT 50;

-- 4. Enable secure RLS updates
DROP POLICY IF EXISTS "Users can insert reviews" ON public.reviews;
CREATE POLICY "Users can insert reviews" ON public.reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
