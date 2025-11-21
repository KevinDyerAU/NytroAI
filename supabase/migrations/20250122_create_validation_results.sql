-- Migration: Consolidate validation tables into single validation_results table
-- Date: 2025-01-22
-- Purpose: Phase 2 - Database Schema Consolidation

-- Create the consolidated validation_results table
CREATE TABLE IF NOT EXISTS public.validation_results (
  id BIGSERIAL PRIMARY KEY,
  
  -- Foreign keys
  validation_detail_id BIGINT NOT NULL REFERENCES public.validation_detail(id) ON DELETE CASCADE,
  validation_type_id BIGINT REFERENCES public.validation_type(id),
  requirement_id BIGINT,  -- Generic reference to any requirement table
  
  -- Requirement information
  requirement_type TEXT CHECK (requirement_type IN ('ke', 'pe', 'fs', 'epc', 'ac', 'ai', 'learner')),
  requirement_number TEXT,
  requirement_text TEXT,
  
  -- Validation results
  status TEXT CHECK (status IN ('met', 'not-met', 'partial', 'pending')),
  reasoning TEXT,
  mapped_content TEXT,
  unmapped_content TEXT,
  recommendations TEXT,
  doc_references TEXT,
  
  -- Smart Q&A (optional, generated separately)
  smart_questions JSONB DEFAULT '[]',
  
  -- Metadata and tracking
  confidence_score DECIMAL(3,2),
  validation_method TEXT DEFAULT 'single_prompt' CHECK (validation_method IN ('single_prompt', 'individual_prompt', 'hybrid')),
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_validation_results_detail_id 
  ON public.validation_results(validation_detail_id);

CREATE INDEX IF NOT EXISTS idx_validation_results_type_id 
  ON public.validation_results(validation_type_id);

CREATE INDEX IF NOT EXISTS idx_validation_results_requirement 
  ON public.validation_results(requirement_id, requirement_type);

CREATE INDEX IF NOT EXISTS idx_validation_results_status 
  ON public.validation_results(status);

CREATE INDEX IF NOT EXISTS idx_validation_results_created_at 
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

-- Add comment to table
COMMENT ON TABLE public.validation_results IS 
  'Consolidated validation results table for all requirement types (KE, PE, FS, EPC, AC). 
   Replaces multiple separate validation tables with a single flexible schema.';

-- Add comments to key columns
COMMENT ON COLUMN public.validation_results.requirement_type IS 
  'Type of requirement: ke=Knowledge Evidence, pe=Performance Evidence, fs=Foundation Skills, epc=Elements & Performance Criteria, ac=Assessment Conditions';

COMMENT ON COLUMN public.validation_results.smart_questions IS 
  'JSONB array of smart questions generated for this requirement. Format: [{question: string, benchmark_answer: string, type: string}]';

COMMENT ON COLUMN public.validation_results.validation_method IS 
  'Method used for validation: single_prompt (all requirements at once), individual_prompt (one at a time), hybrid (combination)';
