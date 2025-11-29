-- ============================================================================
-- Migration: Deprecate old 'prompt' table and migrate to new 'prompts' schema
-- ============================================================================
-- Date: 2025-11-30
-- Description: This migration deprecates the old 'prompt' table (validation_type_id based)
--              and ensures the new 'prompts' table (prompt_type/requirement_type/document_type based)
--              is the single source of truth for the prompt system.
--
-- IMPORTANT: This migration does NOT drop the old 'prompt' table to preserve data.
--            After verifying the new system works, you can manually drop it.
-- ============================================================================

-- ============================================================================
-- STEP 1: Rename old table for backup (if it exists)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'prompt') THEN
        -- Rename to prompt_deprecated for backup
        ALTER TABLE IF EXISTS prompt RENAME TO prompt_deprecated;
        
        -- Add deprecation comment
        COMMENT ON TABLE prompt_deprecated IS 'DEPRECATED: Old prompt table. Use "prompts" table instead. Safe to drop after migration verification.';
        
        RAISE NOTICE 'Old "prompt" table renamed to "prompt_deprecated"';
    ELSE
        RAISE NOTICE 'Old "prompt" table does not exist, skipping rename';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Ensure new 'prompts' table exists with correct schema
-- ============================================================================

CREATE TABLE IF NOT EXISTS prompts (
  id BIGSERIAL PRIMARY KEY,
  
  -- Prompt identification (3-key lookup system)
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

-- ============================================================================
-- STEP 3: Create indexes for fast lookup
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_prompts_lookup 
  ON prompts(prompt_type, requirement_type, document_type, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_prompts_type 
  ON prompts(prompt_type);

CREATE INDEX IF NOT EXISTS idx_prompts_active 
  ON prompts(is_active) 
  WHERE is_active = true;

-- ============================================================================
-- STEP 4: Create trigger to update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prompts_updated_at ON prompts;
CREATE TRIGGER prompts_updated_at
  BEFORE UPDATE ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_prompts_updated_at();

-- ============================================================================
-- STEP 5: Add comments
-- ============================================================================

COMMENT ON TABLE prompts IS 'NEW SCHEMA: Stores AI prompt templates for validation, question generation, and reporting';
COMMENT ON COLUMN prompts.prompt_type IS 'Type of prompt: validation, smart_question, report, summary';
COMMENT ON COLUMN prompts.requirement_type IS 'Requirement type this prompt applies to, or "all" for generic prompts';
COMMENT ON COLUMN prompts.document_type IS 'Document type: unit, learner_guide, or both';
COMMENT ON COLUMN prompts.prompt_text IS 'Main prompt text with {{variable}} placeholders';
COMMENT ON COLUMN prompts.system_instruction IS 'System instruction for AI model (persona)';
COMMENT ON COLUMN prompts.output_schema IS 'JSON schema for structured output';
COMMENT ON COLUMN prompts.generation_config IS 'Gemini generation configuration (temperature, topP, etc.)';
COMMENT ON COLUMN prompts.is_active IS 'Whether this prompt version is currently active';
COMMENT ON COLUMN prompts.is_default IS 'Whether this is the default prompt for this type/requirement/document combination';

-- ============================================================================
-- STEP 6: Verification query
-- ============================================================================

DO $$
DECLARE
    prompt_count INTEGER;
    deprecated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO prompt_count FROM prompts;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'prompt_deprecated') THEN
        SELECT COUNT(*) INTO deprecated_count FROM prompt_deprecated;
        RAISE NOTICE 'Migration complete: % prompts in new table, % in deprecated table', prompt_count, deprecated_count;
    ELSE
        RAISE NOTICE 'Migration complete: % prompts in new table', prompt_count;
    END IF;
END $$;

-- ============================================================================
-- NOTES FOR MANUAL CLEANUP (After verification)
-- ============================================================================

-- After verifying the new system works correctly, you can drop the old table:
-- DROP TABLE IF EXISTS prompt_deprecated CASCADE;

-- If you need to rollback this migration:
-- ALTER TABLE prompt_deprecated RENAME TO prompt;
-- (Note: This will restore the old table but you'll need to update UI/workflows)
