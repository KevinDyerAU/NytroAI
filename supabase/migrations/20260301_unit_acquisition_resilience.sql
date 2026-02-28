-- =============================================================================
-- Unit Acquisition Resilience: Queue Table & Completeness Flags
-- =============================================================================
-- This migration adds:
-- 1. unit_acquisition_queue table for resilient, retry-capable acquisition
-- 2. Completeness flags on UnitOfCompetency for per-section tracking
-- 3. RLS policies for both tables
-- 4. Indexes for performance
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Create the unit_acquisition_queue table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.unit_acquisition_queue (
    id              BIGSERIAL PRIMARY KEY,
    unit_code       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'in_progress', 'completed', 'partial_success', 'failed', 'retry')),
    retry_count     INTEGER NOT NULL DEFAULT 0,
    max_retries     INTEGER NOT NULL DEFAULT 5,
    last_error      TEXT,
    error_history   JSONB NOT NULL DEFAULT '[]'::jsonb,
    sections_captured JSONB NOT NULL DEFAULT '{"ke": false, "pe": false, "fs": false, "epc": false, "ac": false}'::jsonb,
    requested_by    UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    next_retry_at   TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_acquisition_queue_status ON public.unit_acquisition_queue(status);
CREATE INDEX IF NOT EXISTS idx_acquisition_queue_unit_code ON public.unit_acquisition_queue(unit_code);
CREATE INDEX IF NOT EXISTS idx_acquisition_queue_next_retry ON public.unit_acquisition_queue(next_retry_at)
    WHERE status IN ('queued', 'retry');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_acquisition_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_acquisition_queue_updated_at ON public.unit_acquisition_queue;
CREATE TRIGGER trigger_update_acquisition_queue_updated_at
    BEFORE UPDATE ON public.unit_acquisition_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_acquisition_queue_updated_at();

-- Enable RLS
ALTER TABLE public.unit_acquisition_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies: authenticated users can read all, insert, and update their own
CREATE POLICY "Authenticated users can read queue"
    ON public.unit_acquisition_queue FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert into queue"
    ON public.unit_acquisition_queue FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update queue items"
    ON public.unit_acquisition_queue FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can delete from queue"
    ON public.unit_acquisition_queue FOR DELETE
    TO authenticated
    USING (true);

-- Service role can do everything (for edge functions / n8n callbacks)
CREATE POLICY "Service role full access to queue"
    ON public.unit_acquisition_queue FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable Realtime for the queue table
ALTER PUBLICATION supabase_realtime ADD TABLE public.unit_acquisition_queue;

-- ---------------------------------------------------------------------------
-- 2. Add completeness flags to UnitOfCompetency
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'UnitOfCompetency'
                   AND column_name = 'has_knowledge_evidence') THEN
        ALTER TABLE public."UnitOfCompetency"
            ADD COLUMN has_knowledge_evidence BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN has_performance_evidence BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN has_foundation_skills BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN has_elements_performance_criteria BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN has_assessment_conditions BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN acquisition_status TEXT NOT NULL DEFAULT 'pending'
                CHECK (acquisition_status IN ('pending', 'partial', 'complete', 'error')),
            ADD COLUMN last_acquisition_error TEXT,
            ADD COLUMN last_acquired_at TIMESTAMPTZ;
    END IF;
END $$;

-- Index for filtering by acquisition status
CREATE INDEX IF NOT EXISTS idx_unit_acquisition_status ON public."UnitOfCompetency"(acquisition_status);

-- ---------------------------------------------------------------------------
-- 3. Backfill completeness flags for existing units
-- ---------------------------------------------------------------------------
-- Check each requirement table and set the flag if rows exist
UPDATE public."UnitOfCompetency" u SET
    has_knowledge_evidence = EXISTS (
        SELECT 1 FROM public.knowledge_evidence_requirements r WHERE r.unit_url = u."Link"
    ),
    has_performance_evidence = EXISTS (
        SELECT 1 FROM public.performance_evidence_requirements r WHERE r.unit_url = u."Link"
    ),
    has_foundation_skills = EXISTS (
        SELECT 1 FROM public.foundation_skills_requirements r WHERE r.unit_url = u."Link"
    ),
    has_elements_performance_criteria = EXISTS (
        SELECT 1 FROM public.elements_performance_criteria_requirements r WHERE r.unit_url = u."Link"
    ),
    has_assessment_conditions = EXISTS (
        SELECT 1 FROM public.assessment_conditions_requirements r WHERE r.unit_url = u."Link"
    );

-- Set acquisition_status based on flags
UPDATE public."UnitOfCompetency" SET
    acquisition_status = CASE
        WHEN has_knowledge_evidence
             AND has_performance_evidence
             AND has_foundation_skills
             AND has_elements_performance_criteria
             AND has_assessment_conditions THEN 'complete'
        WHEN has_knowledge_evidence
             OR has_performance_evidence
             OR has_foundation_skills
             OR has_elements_performance_criteria
             OR has_assessment_conditions THEN 'partial'
        ELSE 'pending'
    END;
