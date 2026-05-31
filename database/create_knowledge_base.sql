-- =========================================================================
-- REVIEWLENS: KNOWLEDGE BASE SCHEMA MIGRATION
-- Target: PostgreSQL / Supabase
-- Purpose: Create knowledge_base table, performance indexes, bidirectional
--          schema sync triggers, and premium seed data (Skincare, Beauty, Laptops, Electronics)
-- =========================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector"; -- Enable pgvector if available (optional)

-- -------------------------------------------------------------------------
-- STEP 1: Create knowledge_base Table
-- -------------------------------------------------------------------------
-- Supports both new user-requested columns and legacy python RAG fields.

CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    
    -- User-requested fields
    title text NOT NULL,
    content text NOT NULL,
    category text NOT NULL,
    embedding vector(1536), -- Optional 1536-dim OpenAI embeddings support
    source text,
    tags text[] DEFAULT '{}'::text[],
    
    -- Legacy RAG pipeline compatibility fields
    topic text,
    sub_topic text,
    keywords text,
    
    created_at timestamp with time zone DEFAULT now()
);

-- Enable Row-Level Security (RLS) on knowledge_base
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Set up permissive read policy for everyone (RAG is read-only for public searches)
DROP POLICY IF EXISTS "Knowledge base is viewable by everyone" ON public.knowledge_base;
CREATE POLICY "Knowledge base is viewable by everyone" ON public.knowledge_base
    FOR SELECT USING (true);

-- -------------------------------------------------------------------------
-- STEP 2: Create Bidirectional Schema Sync Trigger
-- -------------------------------------------------------------------------
-- Safely synchronizes inserted rows. If a backend inserts using 'title', 'topic'
-- is auto-filled. If 'category' is set, 'sub_topic' is auto-filled.
-- If 'tags' are provided, 'keywords' are generated as a comma-separated string (and vice-versa).

CREATE OR REPLACE FUNCTION public.sync_knowledge_base_columns()
RETURNS trigger AS $$
BEGIN
    -- Sync title and topic
    IF NEW.title IS NOT NULL AND NEW.topic IS NULL THEN
        NEW.topic := NEW.title;
    ELSIF NEW.topic IS NOT NULL AND NEW.title IS NULL THEN
        NEW.title := NEW.topic;
    END IF;

    -- Sync category and sub_topic
    IF NEW.category IS NOT NULL AND NEW.sub_topic IS NULL THEN
        NEW.sub_topic := NEW.category;
    ELSIF NEW.sub_topic IS NOT NULL AND NEW.category IS NULL THEN
        NEW.category := NEW.sub_topic;
    END IF;

    -- Sync tags array and comma-separated keywords string
    IF NEW.tags IS NOT NULL AND cardinality(NEW.tags) > 0 AND NEW.keywords IS NULL THEN
        NEW.keywords := array_to_string(NEW.tags, ', ');
    ELSIF NEW.keywords IS NOT NULL AND NEW.tags IS NULL OR cardinality(NEW.tags) = 0 THEN
        NEW.tags := string_to_array(NEW.keywords, ', ');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_knowledge_base_columns ON public.knowledge_base;
CREATE TRIGGER trg_sync_knowledge_base_columns
BEFORE INSERT OR UPDATE ON public.knowledge_base
FOR EACH ROW EXECUTE FUNCTION public.sync_knowledge_base_columns();

-- -------------------------------------------------------------------------
-- STEP 3: Create Sample Seed Data
-- -------------------------------------------------------------------------
-- Inserts high-quality grounding data spanning skincare, beauty, laptops, electronics.

INSERT INTO public.knowledge_base (title, content, category, source, tags) VALUES
(
    'Salicylic Acid Active Mechanisms',
    'Salicylic Acid is a lipid-soluble beta-hydroxy acid (BHA) that penetrates deep into sebum-filled follicles. It breaks down desmosomal junctions in the stratum corneum, exfoliating dead cells, regulating oil production, and dramatically reducing inflammatory acne lesions.',
    'skincare',
    'Journal of Clinical and Aesthetic Dermatology',
    ARRAY['skincare', 'salicylic acid', 'bha', 'acne', 'sebum', 'exfoliation']
),
(
    'Niacinamide Barrier Benefits',
    'Niacinamide (Vitamin B3) is a powerful antioxidant that increases the synthesis of ceramides and free fatty acids in the stratum corneum. This strengthens the natural skin moisture barrier, suppresses melanin transfer to keratinocytes, reduces hyperpigmentation, and balances sebum.',
    'beauty products',
    'Dermatological Research Letters',
    ARRAY['beauty', 'skincare', 'niacinamide', 'barrier', 'bright', 'glow']
),
(
    'Laptop Thermal Architecture',
    'Modern ultra-slim gaming laptops employ vapor chamber cooling blocks, dual phase-change thermal liquid metal interfaces, and multi-fan multi-exhaust duct configurations to sustain power delivery of 140W+ to GPU cores without crossing the 90C thermal throttle limit.',
    'laptops',
    'Hardware Engineering Review',
    ARRAY['laptops', 'thermals', 'cooling', 'gaming', 'performance']
),
(
    'Active Noise Cancellation Earbuds',
    'Active Noise Cancellation (ANC) in premium earbuds utilizes feedback and feedforward microphones to capture ambient waveforms. High-speed DSPs generate anti-phase soundwaves at near-zero latency, canceling frequencies between 20Hz and 2kHz by up to 45dB.',
    'electronics',
    'Acoustical Society Journal',
    ARRAY['electronics', 'anc', 'audio', 'earbuds', 'signal processing']
);

-- -------------------------------------------------------------------------
-- STEP 4: Create Performance Indexes
-- -------------------------------------------------------------------------
-- Create single, compound, and array indices to speed up RAG search patterns.

CREATE INDEX IF NOT EXISTS idx_kb_category ON public.knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_kb_topic ON public.knowledge_base(topic);
CREATE INDEX IF NOT EXISTS idx_kb_title ON public.knowledge_base(title);
CREATE INDEX IF NOT EXISTS idx_kb_tags ON public.knowledge_base USING GIN(tags);
