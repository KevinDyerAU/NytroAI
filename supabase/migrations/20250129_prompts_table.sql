-- ============================================================================
-- Prompts Table Migration
-- ============================================================================
-- Creates table for storing AI validation prompt templates
-- Supports individual requirement validation with different prompts per:
-- - Requirement type (KE, PE, FS, E_PC, AC)
-- - Document type (unit, learner_guide)
-- 
-- Date: 2025-01-29
-- ============================================================================

CREATE TABLE IF NOT EXISTS prompts (
  id BIGSERIAL PRIMARY KEY,
  
  -- Prompt identification
  prompt_type TEXT NOT NULL CHECK (prompt_type IN (
    'validation',
    'smart_question',
    'report',
    'summary'
  )),
  
  requirement_type TEXT CHECK (requirement_type IN (
    'knowledge_evidence',
    'performance_evidence',
    'foundation_skills',
    'elements_performance_criteria',
    'assessment_conditions',
    'all'  -- For prompts that apply to all types
  )),
  
  document_type TEXT CHECK (document_type IN (
    'unit',
    'learner_guide',
    'both'  -- For prompts that work with both
  )),
  
  -- Prompt content
  name TEXT NOT NULL,
  description TEXT,
  prompt_text TEXT NOT NULL,
  system_instruction TEXT,
  
  -- Output configuration
  output_schema JSONB,
  generation_config JSONB DEFAULT '{
    "temperature": 0.2,
    "topP": 0.95,
    "topK": 40,
    "maxOutputTokens": 8192,
    "responseMimeType": "application/json"
  }'::jsonb,
  
  -- Versioning and status
  version TEXT DEFAULT 'v1.0',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  
  -- Constraints
  UNIQUE(prompt_type, requirement_type, document_type, version, is_active)
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_prompts_lookup 
  ON prompts(prompt_type, requirement_type, document_type, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_prompts_type 
  ON prompts(prompt_type);

CREATE INDEX IF NOT EXISTS idx_prompts_active 
  ON prompts(is_active) 
  WHERE is_active = true;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prompts_updated_at
  BEFORE UPDATE ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_prompts_updated_at();

-- Comments
COMMENT ON TABLE prompts IS 'Stores AI prompt templates for validation, question generation, and reporting';
COMMENT ON COLUMN prompts.prompt_type IS 'Type of prompt: validation, smart_question, report, summary';
COMMENT ON COLUMN prompts.requirement_type IS 'Requirement type this prompt applies to, or "all" for generic prompts';
COMMENT ON COLUMN prompts.document_type IS 'Document type: unit, learner_guide, or both';
COMMENT ON COLUMN prompts.prompt_text IS 'Main prompt text with {{variable}} placeholders';
COMMENT ON COLUMN prompts.system_instruction IS 'System instruction for AI model';
COMMENT ON COLUMN prompts.output_schema IS 'JSON schema for structured output';
COMMENT ON COLUMN prompts.generation_config IS 'Gemini generation configuration (temperature, topP, etc.)';
COMMENT ON COLUMN prompts.is_active IS 'Whether this prompt version is currently active';
COMMENT ON COLUMN prompts.is_default IS 'Whether this is the default prompt for this type/requirement/document combination';
