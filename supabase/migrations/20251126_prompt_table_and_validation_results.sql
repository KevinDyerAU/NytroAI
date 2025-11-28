-- Migration: Add prompt table and update validation_results for multi-validation support
-- Date: 2025-11-26
-- Description: Creates prompt table for validation type-specific prompts and updates validation_results schema

-- ============================================================================
-- 1. CREATE PROMPT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS prompt (
  id BIGSERIAL PRIMARY KEY,
  validation_type_id INTEGER NOT NULL REFERENCES validation_type(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  current BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure only one current prompt per validation type
  CONSTRAINT unique_current_prompt_per_type UNIQUE NULLS NOT DISTINCT (validation_type_id, current)
);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_prompt_validation_type_current ON prompt(validation_type_id, current) WHERE current = true;

-- Add comments
COMMENT ON TABLE prompt IS 'Stores validation prompts for each validation type with versioning';
COMMENT ON COLUMN prompt.validation_type_id IS 'References validation_type table (1=KE, 2=EPC, 3=PE, 4=AC, 5=FS, 7=AI)';
COMMENT ON COLUMN prompt.current IS 'Only one prompt per validation_type_id can have current=true';
COMMENT ON COLUMN prompt.version IS 'Version number for tracking prompt changes';

-- ============================================================================
-- 2. UPDATE VALIDATION_RESULTS TABLE
-- ============================================================================

-- Add columns if they don't exist
ALTER TABLE validation_results 
ADD COLUMN IF NOT EXISTS unit_link TEXT,
ADD COLUMN IF NOT EXISTS validation_detail_id BIGINT REFERENCES validation_detail(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS grounding_metadata JSONB,
ADD COLUMN IF NOT EXISTS citation_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_confidence NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS citation_coverage NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS quality_flags JSONB;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_validation_results_validation_detail_id ON validation_results(validation_detail_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_unit_link ON validation_results(unit_link);
CREATE INDEX IF NOT EXISTS idx_validation_results_validation_type ON validation_results(validation_type);
CREATE INDEX IF NOT EXISTS idx_validation_results_quality_flags ON validation_results USING GIN (quality_flags);

-- Add comments
COMMENT ON COLUMN validation_results.unit_link IS 'Full URL to training.gov.au unit page';
COMMENT ON COLUMN validation_results.validation_detail_id IS 'Reference to validation_detail for this validation session';
COMMENT ON COLUMN validation_results.grounding_metadata IS 'All citations and grounding supports from Gemini API';
COMMENT ON COLUMN validation_results.citation_count IS 'Number of citations found in grounding chunks';
COMMENT ON COLUMN validation_results.average_confidence IS 'Average confidence score from grounding supports (0-1)';
COMMENT ON COLUMN validation_results.citation_coverage IS 'Percentage of validations with citations (0-100)';
COMMENT ON COLUMN validation_results.quality_flags IS 'Quality assessment flags: {noCitations, lowCoverage, lowConfidence, goodQuality}';

-- ============================================================================
-- 3. INSERT DEFAULT PROMPTS
-- ============================================================================

-- Insert default prompts for each validation type
-- These can be updated later via the application

-- Knowledge Evidence (validation_type_id = 1)
INSERT INTO prompt (validation_type_id, prompt, current, version, description, created_by)
VALUES (
  1,
  'You are validating a VET (Vocational Education and Training) assessment against Knowledge Evidence requirements.

Unit: {unitCode} - {unitTitle}

Requirements to validate (JSON array):
{requirements}

Instructions:
1. For each requirement in the array, check if the assessment document covers it
2. Provide specific evidence with page numbers
3. Rate confidence as high/medium/low
4. Mark status as: covered, partial, not_covered, or unclear

Return JSON with this exact structure:
{
  "validations": [
    {
      "requirementId": <number from requirements array>,
      "status": "covered" | "partial" | "not_covered" | "unclear",
      "evidence": "Specific evidence found in the document",
      "pageNumbers": [3, 4],
      "confidence": "high" | "medium" | "low"
    }
  ],
  "overallStatus": "compliant" | "partial" | "non_compliant",
  "summary": "Overall assessment summary"
}',
  true,
  1,
  'Default Knowledge Evidence validation prompt',
  'system'
) ON CONFLICT (validation_type_id, current) WHERE current = true DO NOTHING;

-- Elements & Performance Criteria (validation_type_id = 2)
INSERT INTO prompt (validation_type_id, prompt, current, version, description, created_by)
VALUES (
  2,
  'You are validating a VET (Vocational Education and Training) assessment against Elements and Performance Criteria requirements.

Unit: {unitCode} - {unitTitle}

Requirements to validate (JSON array):
{requirements}

Instructions:
1. For each element and performance criteria, check if the assessment covers it
2. Look for tasks, questions, or activities that address each criterion
3. Provide specific evidence with page numbers
4. Rate confidence as high/medium/low
5. Mark status as: covered, partial, not_covered, or unclear

Return JSON with this exact structure:
{
  "validations": [
    {
      "requirementId": <number from requirements array>,
      "status": "covered" | "partial" | "not_covered" | "unclear",
      "evidence": "Specific evidence found in the document",
      "pageNumbers": [3, 4],
      "confidence": "high" | "medium" | "low"
    }
  ],
  "overallStatus": "compliant" | "partial" | "non_compliant",
  "summary": "Overall assessment summary"
}',
  true,
  1,
  'Default Elements & Performance Criteria validation prompt',
  'system'
) ON CONFLICT (validation_type_id, current) WHERE current = true DO NOTHING;

-- Performance Evidence (validation_type_id = 3)
INSERT INTO prompt (validation_type_id, prompt, current, version, description, created_by)
VALUES (
  3,
  'You are validating a VET (Vocational Education and Training) assessment against Performance Evidence requirements.

Unit: {unitCode} - {unitTitle}

Requirements to validate (JSON array):
{requirements}

Instructions:
1. For each performance evidence requirement, check if the assessment requires learners to demonstrate it
2. Look for practical tasks, observations, or demonstrations
3. Provide specific evidence with page numbers
4. Rate confidence as high/medium/low
5. Mark status as: covered, partial, not_covered, or unclear

Return JSON with this exact structure:
{
  "validations": [
    {
      "requirementId": <number from requirements array>,
      "status": "covered" | "partial" | "not_covered" | "unclear",
      "evidence": "Specific evidence found in the document",
      "pageNumbers": [3, 4],
      "confidence": "high" | "medium" | "low"
    }
  ],
  "overallStatus": "compliant" | "partial" | "non_compliant",
  "summary": "Overall assessment summary"
}',
  true,
  1,
  'Default Performance Evidence validation prompt',
  'system'
) ON CONFLICT (validation_type_id, current) WHERE current = true DO NOTHING;

-- Assessment Conditions (validation_type_id = 4)
INSERT INTO prompt (validation_type_id, prompt, current, version, description, created_by)
VALUES (
  4,
  'You are validating a VET (Vocational Education and Training) assessment against Assessment Conditions.

Unit: {unitCode} - {unitTitle}

Assessment Conditions from training.gov.au:
{requirements}

Instructions:
1. Check if the assessment document specifies conditions that align with the required assessment conditions
2. Look for information about:
   - Assessment environment (workplace, simulated, classroom)
   - Resources and equipment required
   - Supervision requirements
   - Time constraints
   - Any other specified conditions
3. Provide specific evidence with page numbers
4. Rate confidence as high/medium/low
5. Mark status as: covered, partial, not_covered, or unclear

Return JSON with this exact structure:
{
  "validations": [
    {
      "requirementId": 999999,
      "status": "covered" | "partial" | "not_covered" | "unclear",
      "evidence": "Specific evidence found in the document",
      "pageNumbers": [1, 2],
      "confidence": "high" | "medium" | "low"
    }
  ],
  "overallStatus": "compliant" | "partial" | "non_compliant",
  "summary": "Overall assessment summary"
}',
  true,
  1,
  'Default Assessment Conditions validation prompt',
  'system'
) ON CONFLICT (validation_type_id, current) WHERE current = true DO NOTHING;

-- Foundation Skills (validation_type_id = 5)
INSERT INTO prompt (validation_type_id, prompt, current, version, description, created_by)
VALUES (
  5,
  'You are validating a VET (Vocational Education and Training) assessment against Foundation Skills requirements.

Unit: {unitCode} - {unitTitle}

Requirements to validate (JSON array):
{requirements}

Instructions:
1. For each foundation skill requirement, check if the assessment allows learners to demonstrate it
2. Foundation skills include: reading, writing, oral communication, numeracy, learning, problem solving, initiative and enterprise, teamwork, planning and organizing, self-management, technology
3. Provide specific evidence with page numbers
4. Rate confidence as high/medium/low
5. Mark status as: covered, partial, not_covered, or unclear

Return JSON with this exact structure:
{
  "validations": [
    {
      "requirementId": <number from requirements array>,
      "status": "covered" | "partial" | "not_covered" | "unclear",
      "evidence": "Specific evidence found in the document",
      "pageNumbers": [3, 4],
      "confidence": "high" | "medium" | "low"
    }
  ],
  "overallStatus": "compliant" | "partial" | "non_compliant",
  "summary": "Overall assessment summary"
}',
  true,
  1,
  'Default Foundation Skills validation prompt',
  'system'
) ON CONFLICT (validation_type_id, current) WHERE current = true DO NOTHING;

-- Assessment Instructions (validation_type_id = 7)
INSERT INTO prompt (validation_type_id, prompt, current, version, description, created_by)
VALUES (
  7,
  'You are validating a VET (Vocational Education and Training) assessment against Assessment Instructions.

Unit: {unitCode} - {unitTitle}

Assessment Instructions (Assessment Conditions + Elements & Performance Criteria):
{requirements}

Instructions:
1. Check if the assessment document provides clear instructions that align with the unit requirements
2. Look for:
   - Clear task instructions
   - Guidance on how to complete the assessment
   - Instructions that cover all elements and performance criteria
   - Instructions that reflect the assessment conditions
3. Provide specific evidence with page numbers
4. Rate confidence as high/medium/low
5. Mark status as: covered, partial, not_covered, or unclear

Return JSON with this exact structure:
{
  "validations": [
    {
      "requirementId": 999998,
      "status": "covered" | "partial" | "not_covered" | "unclear",
      "evidence": "Specific evidence found in the document",
      "pageNumbers": [1, 2],
      "confidence": "high" | "medium" | "low"
    }
  ],
  "overallStatus": "compliant" | "partial" | "non_compliant",
  "summary": "Overall assessment summary"
}',
  true,
  1,
  'Default Assessment Instructions validation prompt',
  'system'
) ON CONFLICT (validation_type_id, current) WHERE current = true DO NOTHING;

-- ============================================================================
-- 4. CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to get active prompt for validation type
CREATE OR REPLACE FUNCTION get_active_prompt(p_validation_type_id INTEGER)
RETURNS TEXT AS $$
DECLARE
  v_prompt TEXT;
BEGIN
  SELECT prompt INTO v_prompt
  FROM prompt
  WHERE validation_type_id = p_validation_type_id
    AND current = true
  LIMIT 1;
  
  RETURN v_prompt;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_active_prompt IS 'Returns the active prompt for a given validation type ID';

-- Function to create new prompt version
CREATE OR REPLACE FUNCTION create_prompt_version(
  p_validation_type_id INTEGER,
  p_prompt TEXT,
  p_description TEXT DEFAULT NULL,
  p_created_by TEXT DEFAULT 'system',
  p_make_current BOOLEAN DEFAULT false
)
RETURNS BIGINT AS $$
DECLARE
  v_next_version INTEGER;
  v_new_id BIGINT;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM prompt
  WHERE validation_type_id = p_validation_type_id;
  
  -- If making this current, unset current flag on existing prompts
  IF p_make_current THEN
    UPDATE prompt
    SET current = false
    WHERE validation_type_id = p_validation_type_id
      AND current = true;
  END IF;
  
  -- Insert new prompt
  INSERT INTO prompt (
    validation_type_id,
    prompt,
    current,
    version,
    description,
    created_by
  ) VALUES (
    p_validation_type_id,
    p_prompt,
    p_make_current,
    v_next_version,
    p_description,
    p_created_by
  ) RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_prompt_version IS 'Creates a new version of a prompt for a validation type';

-- Function to set current prompt
CREATE OR REPLACE FUNCTION set_current_prompt(p_prompt_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  v_validation_type_id INTEGER;
BEGIN
  -- Get validation_type_id for this prompt
  SELECT validation_type_id INTO v_validation_type_id
  FROM prompt
  WHERE id = p_prompt_id;
  
  IF v_validation_type_id IS NULL THEN
    RAISE EXCEPTION 'Prompt ID % not found', p_prompt_id;
  END IF;
  
  -- Unset current flag on all prompts for this validation type
  UPDATE prompt
  SET current = false
  WHERE validation_type_id = v_validation_type_id
    AND current = true;
  
  -- Set current flag on specified prompt
  UPDATE prompt
  SET current = true
  WHERE id = p_prompt_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_current_prompt IS 'Sets a prompt as the current active prompt for its validation type';

-- ============================================================================
-- 5. CREATE VIEWS FOR EASY QUERYING
-- ============================================================================

-- View: Active prompts only
CREATE OR REPLACE VIEW active_prompts AS
SELECT 
  p.id,
  p.validation_type_id,
  vt.name as validation_type_name,
  p.prompt,
  p.version,
  p.description,
  p.created_by,
  p.created_at,
  p.updated_at
FROM prompt p
INNER JOIN validation_type vt ON p.validation_type_id = vt.id
WHERE p.current = true
ORDER BY p.validation_type_id;

COMMENT ON VIEW active_prompts IS 'Shows only the current active prompts for each validation type';

-- View: Validation results with quality summary
CREATE OR REPLACE VIEW validation_results_summary AS
SELECT 
  vr.id,
  vr.validation_detail_id,
  vr.unit_code,
  vr.unit_link,
  vr.validation_type,
  vr.citation_count,
  vr.citation_coverage,
  vr.average_confidence,
  vr.quality_flags,
  (vr.quality_flags->>'goodQuality')::boolean as is_good_quality,
  (vr.quality_flags->>'noCitations')::boolean as has_no_citations,
  (vr.quality_flags->>'lowCoverage')::boolean as has_low_coverage,
  (vr.quality_flags->>'lowConfidence')::boolean as has_low_confidence,
  vr.created_at
FROM validation_results vr
ORDER BY vr.created_at DESC;

COMMENT ON VIEW validation_results_summary IS 'Summary view of validation results with quality flags expanded';

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions to authenticated users (adjust as needed)
GRANT SELECT, INSERT, UPDATE ON prompt TO authenticated;
GRANT SELECT ON active_prompts TO authenticated;
GRANT SELECT ON validation_results_summary TO authenticated;
GRANT USAGE ON SEQUENCE prompt_id_seq TO authenticated;

-- ============================================================================
-- 7. SAMPLE QUERIES
-- ============================================================================

-- Example: Get active prompt for Knowledge Evidence
-- SELECT * FROM active_prompts WHERE validation_type_id = 1;

-- Example: Get all prompts for a validation type (including inactive)
-- SELECT * FROM prompt WHERE validation_type_id = 1 ORDER BY version DESC;

-- Example: Create new prompt version
-- SELECT create_prompt_version(1, 'New prompt text...', 'Updated for better accuracy', 'admin', true);

-- Example: Set a specific prompt as current
-- SELECT set_current_prompt(15);

-- Example: Get validation results with good quality
-- SELECT * FROM validation_results_summary WHERE is_good_quality = true;

-- Example: Get validation results with low coverage
-- SELECT * FROM validation_results_summary WHERE has_low_coverage = true;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
