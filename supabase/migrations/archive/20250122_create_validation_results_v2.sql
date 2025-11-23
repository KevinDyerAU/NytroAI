-- Migration: Consolidate validation tables into single validation_results table
-- Date: 2025-01-22
-- Purpose: Phase 2 - Database Schema Consolidation with Consistent Naming Conventions
-- Version: 2 (Updated with consistent snake_case naming)

-- NAMING CONVENTIONS APPLIED:
-- 1. All column names use snake_case (e.g., validation_detail_id, not valDetail_id)
-- 2. Foreign key columns end with _id (e.g., requirement_id, validation_type_id)
-- 3. Text content columns are descriptive (e.g., requirement_text, not ke_requirement)
-- 4. Boolean columns use is_ prefix where appropriate
-- 5. Timestamp columns use _at suffix (e.g., created_at, updated_at)
-- 6. JSONB columns use plural for arrays (e.g., smart_questions, not smart_question)

-- Drop existing table if it exists (for clean migration)
DROP TABLE IF EXISTS public.validation_results CASCADE;

-- Create the consolidated validation_results table
CREATE TABLE public.validation_results (
  id BIGSERIAL PRIMARY KEY,
  
  -- Foreign keys (consistent snake_case with _id suffix)
  validation_detail_id BIGINT NOT NULL REFERENCES public.validation_detail(id) ON DELETE CASCADE,
  validation_type_id BIGINT REFERENCES public.validation_type(id),
  requirement_id BIGINT,  -- Generic reference to any requirement table
  
  -- Requirement information (consistent naming across all types)
  requirement_type TEXT CHECK (requirement_type IN ('ke', 'pe', 'fs', 'epc', 'ac', 'ai', 'learner')),
  requirement_number TEXT,  -- Replaces: ke_number, pe_number, fs_number, epc_number, ac_number
  requirement_text TEXT,    -- Replaces: ke_requirement, pe_requirement, fs_requirement, performance_criteria, ac_point
  
  -- Validation results (consistent naming)
  status TEXT CHECK (status IN ('met', 'not-met', 'partial', 'pending')),
  reasoning TEXT,                    -- Explanation of the validation result
  mapped_content TEXT,               -- Content that maps to the requirement (replaces: mapped_questions, mapped_content)
  unmapped_content TEXT,             -- Content that doesn't map (replaces: unmappedContent, unmappedContentExplanation)
  recommendations TEXT,              -- Recommendations for improvement (replaces: unmappedRecommendations, unmappedContentRecommendation, recommendation)
  doc_references TEXT,               -- Document references (replaces: docReferences - keeping snake_case)
  
  -- Smart Q&A (JSONB array for flexibility)
  smart_questions JSONB DEFAULT '[]',  -- Replaces: smart_question, benchmarkAnswer as separate columns
  -- Format: [{"question": "...", "benchmark_answer": "...", "type": "smart|mapped|unmapped"}]
  
  -- Metadata and tracking
  confidence_score DECIMAL(3,2),     -- AI confidence in the validation result (0.00 to 1.00)
  validation_method TEXT DEFAULT 'single_prompt' CHECK (validation_method IN ('single_prompt', 'individual_prompt', 'hybrid')),
  metadata JSONB DEFAULT '{}',       -- Additional flexible metadata
  
  -- Timestamps (consistent _at suffix)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_validation_results_validation_detail_id 
  ON public.validation_results(validation_detail_id);

CREATE INDEX idx_validation_results_validation_type_id 
  ON public.validation_results(validation_type_id);

CREATE INDEX idx_validation_results_requirement 
  ON public.validation_results(requirement_id, requirement_type);

CREATE INDEX idx_validation_results_status 
  ON public.validation_results(status);

CREATE INDEX idx_validation_results_requirement_type 
  ON public.validation_results(requirement_type);

CREATE INDEX idx_validation_results_created_at 
  ON public.validation_results(created_at DESC);

-- Enable RLS
ALTER TABLE public.validation_results ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to view validation results" ON public.validation_results;
DROP POLICY IF EXISTS "Allow authenticated users to insert validation results" ON public.validation_results;
DROP POLICY IF EXISTS "Allow authenticated users to update validation results" ON public.validation_results;
DROP POLICY IF EXISTS "Allow service role to manage validation results" ON public.validation_results;

-- Create RLS policies
CREATE POLICY "Allow authenticated users to view validation results" 
  ON public.validation_results FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert validation results" 
  ON public.validation_results FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update validation results" 
  ON public.validation_results FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow service role to manage validation results" 
  ON public.validation_results FOR ALL TO service_role USING (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_validation_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_validation_results_updated_at_trigger ON public.validation_results;
CREATE TRIGGER update_validation_results_updated_at_trigger
  BEFORE UPDATE ON public.validation_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_validation_results_updated_at();

-- Add comments to table
COMMENT ON TABLE public.validation_results IS 
  'Consolidated validation results table for all requirement types (KE, PE, FS, EPC, AC). 
   Replaces multiple separate validation tables with a single flexible schema using consistent snake_case naming.';

-- Add comments to key columns
COMMENT ON COLUMN public.validation_results.validation_detail_id IS 
  'Foreign key to validation_detail table (replaces inconsistent valDetail_id)';

COMMENT ON COLUMN public.validation_results.requirement_type IS 
  'Type of requirement: ke=Knowledge Evidence, pe=Performance Evidence, fs=Foundation Skills, epc=Elements & Performance Criteria, ac=Assessment Conditions, learner=Learner Guide';

COMMENT ON COLUMN public.validation_results.requirement_number IS 
  'Requirement identifier (replaces type-specific columns: ke_number, pe_number, fs_number, epc_number, ac_number)';

COMMENT ON COLUMN public.validation_results.requirement_text IS 
  'Full text of the requirement (replaces type-specific columns: ke_requirement, pe_requirement, fs_requirement, performance_criteria, ac_point, condition_point, knowled_point, skill_point)';

COMMENT ON COLUMN public.validation_results.mapped_content IS 
  'Content from assessment that maps to this requirement (replaces: mapped_questions in some tables, mapped_content in learner tables)';

COMMENT ON COLUMN public.validation_results.unmapped_content IS 
  'Content that is missing or doesn''t map to the requirement (replaces: unmappedContent, unmappedContentExplanation)';

COMMENT ON COLUMN public.validation_results.recommendations IS 
  'Recommendations for addressing unmapped content (replaces: unmappedRecommendations, unmappedContentRecommendation, recommendation)';

COMMENT ON COLUMN public.validation_results.doc_references IS 
  'References to source documents (replaces: docReferences - standardized to snake_case)';

COMMENT ON COLUMN public.validation_results.smart_questions IS 
  'JSONB array of smart questions generated for this requirement. 
   Format: [{"question": "string", "benchmark_answer": "string", "type": "smart|mapped|unmapped"}]
   Replaces separate columns: smart_question, benchmarkAnswer';

COMMENT ON COLUMN public.validation_results.validation_method IS 
  'Method used for validation: single_prompt (all requirements at once), individual_prompt (one at a time), hybrid (combination)';

COMMENT ON COLUMN public.validation_results.metadata IS 
  'Flexible JSONB field for additional metadata (namespace, custom prompts, etc.)';

-- Create view for backward compatibility with old column names (optional)
CREATE OR REPLACE VIEW public.validation_results_legacy AS
SELECT 
  id,
  validation_detail_id as "valDetail_id",  -- Legacy camelCase
  validation_type_id,
  requirement_id as "requirementId",       -- Legacy camelCase
  requirement_type,
  requirement_number,
  requirement_text,
  status,
  reasoning,
  mapped_content as mapped_questions,      -- Legacy column name
  unmapped_content as "unmappedContent",   -- Legacy camelCase
  recommendations as "unmappedRecommendations",  -- Legacy name
  doc_references as "docReferences",       -- Legacy camelCase
  smart_questions,
  confidence_score,
  validation_method,
  metadata,
  created_at,
  updated_at
FROM public.validation_results;

COMMENT ON VIEW public.validation_results_legacy IS 
  'Backward compatibility view that maps new snake_case columns to legacy camelCase names. 
   Use this view if you need to maintain compatibility with old queries during migration.';
