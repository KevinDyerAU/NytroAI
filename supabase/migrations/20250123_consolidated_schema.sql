-- ============================================================================
-- NytroAI Consolidated Database Schema
-- ============================================================================
-- This migration consolidates all previous migrations into a single file
-- for easier deployment and maintenance.
--
-- Date: 2025-01-23
-- Version: 1.0.0
-- ============================================================================

-- ============================================================================
-- PART 1: Consolidated Validation Results Table
-- ============================================================================
-- Replaces: 20250122_create_validation_results_v2.sql

CREATE TABLE IF NOT EXISTS validation_results (
  id BIGSERIAL PRIMARY KEY,
  validation_detail_id BIGINT NOT NULL REFERENCES validation_detail(id) ON DELETE CASCADE,
  
  -- Requirement identification
  requirement_type TEXT NOT NULL CHECK (requirement_type IN (
    'knowledge_evidence',
    'performance_evidence',
    'foundation_skills',
    'elements_performance_criteria',
    'assessment_conditions'
  )),
  requirement_number TEXT NOT NULL,
  requirement_text TEXT NOT NULL,
  
  -- Validation results
  status TEXT NOT NULL CHECK (status IN ('met', 'partial', 'not_met')),
  reasoning TEXT,
  citations JSONB DEFAULT '[]'::jsonb,
  
  -- Smart questions (JSONB array for flexibility)
  smart_questions JSONB DEFAULT '[]'::jsonb,
  
  -- Document reference (for multi-document validations)
  document_namespace TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT unique_validation_requirement UNIQUE (
    validation_detail_id,
    requirement_type,
    requirement_number,
    COALESCE(document_namespace, '')
  )
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_validation_results_detail_id 
  ON validation_results(validation_detail_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_type 
  ON validation_results(requirement_type);
CREATE INDEX IF NOT EXISTS idx_validation_results_status 
  ON validation_results(status);
CREATE INDEX IF NOT EXISTS idx_validation_results_namespace 
  ON validation_results(document_namespace) WHERE document_namespace IS NOT NULL;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_validation_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validation_results_updated_at
  BEFORE UPDATE ON validation_results
  FOR EACH ROW
  EXECUTE FUNCTION update_validation_results_updated_at();

-- ============================================================================
-- PART 2: Validation Detail Status Improvements
-- ============================================================================
-- Replaces: 20250122_validation_detail_status_improvements.sql

-- Add computed columns to validation_detail table
ALTER TABLE validation_detail 
  ADD COLUMN IF NOT EXISTS validation_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validation_total INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validation_progress NUMERIC(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'pending';

-- Function to update validation_detail status automatically
CREATE OR REPLACE FUNCTION update_validation_detail_status()
RETURNS TRIGGER AS $$
DECLARE
  v_total INTEGER;
  v_count INTEGER;
  v_progress NUMERIC(5,2);
  v_status TEXT;
BEGIN
  -- Count total and completed validations
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('met', 'partial', 'not_met'))
  INTO v_total, v_count
  FROM validation_results
  WHERE validation_detail_id = COALESCE(NEW.validation_detail_id, OLD.validation_detail_id);
  
  -- Calculate progress
  IF v_total > 0 THEN
    v_progress := (v_count::NUMERIC / v_total::NUMERIC) * 100;
  ELSE
    v_progress := 0;
  END IF;
  
  -- Determine status
  IF v_count = 0 THEN
    v_status := 'pending';
  ELSIF v_count < v_total THEN
    v_status := 'in_progress';
  ELSE
    v_status := 'completed';
  END IF;
  
  -- Update validation_detail
  UPDATE validation_detail
  SET 
    validation_count = v_count,
    validation_total = v_total,
    validation_progress = v_progress,
    validation_status = v_status
  WHERE id = COALESCE(NEW.validation_detail_id, OLD.validation_detail_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update status on validation_results changes
DROP TRIGGER IF EXISTS validation_results_status_update ON validation_results;
CREATE TRIGGER validation_results_status_update
  AFTER INSERT OR UPDATE OR DELETE ON validation_results
  FOR EACH ROW
  EXECUTE FUNCTION update_validation_detail_status();

-- Helper view for dashboard queries
CREATE OR REPLACE VIEW validation_detail_with_stats AS
SELECT 
  vd.*,
  vd.validation_count || ' / ' || vd.validation_total AS progress_text,
  CASE vd.validation_status
    WHEN 'pending' THEN 'Waiting to start'
    WHEN 'in_progress' THEN 'Validating (' || vd.validation_count || '/' || vd.validation_total || ')'
    WHEN 'completed' THEN 'Complete'
    ELSE 'Unknown'
  END AS status_description
FROM validation_detail vd;

-- ============================================================================
-- PART 3: Automatic Validation Trigger
-- ============================================================================
-- Replaces: 20250122_auto_trigger_validation.sql

-- Table to log trigger attempts
CREATE TABLE IF NOT EXISTS validation_trigger_log (
  id BIGSERIAL PRIMARY KEY,
  validation_detail_id BIGINT NOT NULL,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL,
  response_code INTEGER,
  response_body TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_validation_trigger_log_detail_id 
  ON validation_trigger_log(validation_detail_id);
CREATE INDEX IF NOT EXISTS idx_validation_trigger_log_triggered_at 
  ON validation_trigger_log(triggered_at DESC);

-- Function to trigger validation via edge function
CREATE OR REPLACE FUNCTION trigger_validation_on_indexing_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_validation_detail_id BIGINT;
  v_total_operations INTEGER;
  v_completed_operations INTEGER;
  v_http_response RECORD;
  v_supabase_url TEXT;
  v_supabase_key TEXT;
BEGIN
  -- Only proceed if operation just completed
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  
  -- Get validation_detail_id from operation
  v_validation_detail_id := NEW.validation_detail_id;
  
  -- Skip if no validation_detail_id
  IF v_validation_detail_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if ALL operations for this validation are complete
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed')
  INTO v_total_operations, v_completed_operations
  FROM gemini_operations
  WHERE validation_detail_id = v_validation_detail_id;
  
  -- Only trigger if all operations are complete
  IF v_completed_operations < v_total_operations THEN
    RETURN NEW;
  END IF;
  
  -- Get Supabase credentials
  v_supabase_url := current_setting('app.supabase_url', true);
  v_supabase_key := current_setting('app.supabase_anon_key', true);
  
  -- Skip if credentials not configured
  IF v_supabase_url IS NULL OR v_supabase_key IS NULL THEN
    INSERT INTO validation_trigger_log (
      validation_detail_id, status, error_message
    ) VALUES (
      v_validation_detail_id, 'error', 'Supabase credentials not configured'
    );
    RETURN NEW;
  END IF;
  
  -- Call trigger-validation edge function
  SELECT * INTO v_http_response FROM http((
    'POST',
    v_supabase_url || '/functions/v1/trigger-validation',
    ARRAY[
      http_header('Authorization', 'Bearer ' || v_supabase_key),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    json_build_object('validationDetailId', v_validation_detail_id)::text
  )::http_request);
  
  -- Log the trigger attempt
  INSERT INTO validation_trigger_log (
    validation_detail_id,
    status,
    response_code,
    response_body
  ) VALUES (
    v_validation_detail_id,
    CASE WHEN v_http_response.status BETWEEN 200 AND 299 
      THEN 'success' ELSE 'error' END,
    v_http_response.status,
    v_http_response.content
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on gemini_operations completion
DROP TRIGGER IF EXISTS auto_trigger_validation ON gemini_operations;
CREATE TRIGGER auto_trigger_validation
  AFTER UPDATE ON gemini_operations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_validation_on_indexing_complete();

-- Helper function to check trigger status
CREATE OR REPLACE FUNCTION get_validation_trigger_status(p_validation_detail_id BIGINT)
RETURNS TABLE (
  total_attempts INTEGER,
  successful_attempts INTEGER,
  last_attempt_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER AS total_attempts,
    COUNT(*) FILTER (WHERE status = 'success')::INTEGER AS successful_attempts,
    MAX(triggered_at) AS last_attempt_at,
    (SELECT status FROM validation_trigger_log 
     WHERE validation_detail_id = p_validation_detail_id 
     ORDER BY triggered_at DESC LIMIT 1) AS last_status,
    (SELECT error_message FROM validation_trigger_log 
     WHERE validation_detail_id = p_validation_detail_id 
       AND error_message IS NOT NULL
     ORDER BY triggered_at DESC LIMIT 1) AS last_error
  FROM validation_trigger_log
  WHERE validation_detail_id = p_validation_detail_id;
END;
$$ LANGUAGE plpgsql;

-- Helper function to manually trigger validation
CREATE OR REPLACE FUNCTION manually_trigger_validation(p_validation_detail_id BIGINT)
RETURNS TEXT AS $$
DECLARE
  v_http_response RECORD;
  v_supabase_url TEXT;
  v_supabase_key TEXT;
BEGIN
  -- Get Supabase credentials
  v_supabase_url := current_setting('app.supabase_url', true);
  v_supabase_key := current_setting('app.supabase_anon_key', true);
  
  IF v_supabase_url IS NULL OR v_supabase_key IS NULL THEN
    RETURN 'ERROR: Supabase credentials not configured';
  END IF;
  
  -- Call edge function
  SELECT * INTO v_http_response FROM http((
    'POST',
    v_supabase_url || '/functions/v1/trigger-validation',
    ARRAY[
      http_header('Authorization', 'Bearer ' || v_supabase_key),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    json_build_object('validationDetailId', p_validation_detail_id)::text
  )::http_request);
  
  -- Log the attempt
  INSERT INTO validation_trigger_log (
    validation_detail_id,
    status,
    response_code,
    response_body
  ) VALUES (
    p_validation_detail_id,
    CASE WHEN v_http_response.status BETWEEN 200 AND 299 
      THEN 'success' ELSE 'error' END,
    v_http_response.status,
    v_http_response.content
  );
  
  IF v_http_response.status BETWEEN 200 AND 299 THEN
    RETURN 'SUCCESS: Validation triggered';
  ELSE
    RETURN 'ERROR: ' || v_http_response.status || ' - ' || v_http_response.content;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Monitoring view
CREATE OR REPLACE VIEW validation_trigger_monitor AS
SELECT 
  vd.id AS validation_detail_id,
  vd.rto_code,
  vd.unit_code,
  vd.extractStatus,
  COUNT(vtl.id) AS trigger_attempts,
  COUNT(vtl.id) FILTER (WHERE vtl.status = 'success') AS successful_triggers,
  MAX(vtl.triggered_at) AS last_trigger_at,
  (SELECT status FROM validation_trigger_log 
   WHERE validation_detail_id = vd.id 
   ORDER BY triggered_at DESC LIMIT 1) AS last_trigger_status
FROM validation_detail vd
LEFT JOIN validation_trigger_log vtl ON vd.id = vtl.validation_detail_id
GROUP BY vd.id, vd.rto_code, vd.unit_code, vd.extractStatus
ORDER BY vd.created_at DESC;

-- ============================================================================
-- PART 4: Fix Validation Results Function
-- ============================================================================
-- Replaces: 20250122_fix_validation_results_function.sql

-- Drop old overloaded functions to avoid ambiguity
DROP FUNCTION IF EXISTS get_validation_results(INTEGER);
DROP FUNCTION IF EXISTS get_validation_results(BIGINT);

-- Create single function with explicit type
CREATE OR REPLACE FUNCTION get_validation_results(p_val_detail_id BIGINT)
RETURNS TABLE (
  id BIGINT,
  validation_detail_id BIGINT,
  requirement_type TEXT,
  requirement_number TEXT,
  requirement_text TEXT,
  status TEXT,
  reasoning TEXT,
  citations JSONB,
  smart_questions JSONB,
  document_namespace TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vr.id,
    vr.validation_detail_id,
    vr.requirement_type,
    vr.requirement_number,
    vr.requirement_text,
    vr.status,
    vr.reasoning,
    vr.citations,
    vr.smart_questions,
    vr.document_namespace,
    vr.metadata,
    vr.created_at,
    vr.updated_at
  FROM validation_results vr
  WHERE vr.validation_detail_id = p_val_detail_id
  ORDER BY 
    vr.requirement_type,
    vr.requirement_number;
END;
$$ LANGUAGE plpgsql;

-- Legacy wrapper for backward compatibility (auto-converts INTEGER to BIGINT)
CREATE OR REPLACE FUNCTION get_validation_results_legacy(p_val_detail_id INTEGER)
RETURNS TABLE (
  id BIGINT,
  validation_detail_id BIGINT,
  requirement_type TEXT,
  requirement_number TEXT,
  requirement_text TEXT,
  status TEXT,
  reasoning TEXT,
  citations JSONB,
  smart_questions JSONB,
  document_namespace TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM get_validation_results(p_val_detail_id::BIGINT);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 5: Data Migration (Optional - Only if upgrading from old schema)
-- ============================================================================
-- This section can be run separately if you have existing data in old tables

-- Note: Uncomment and run this section only if you have data in the old tables:
-- - knowledge_evidence_validations
-- - performance_evidence_validations
-- - foundation_skills_validations
-- - elements_performance_criteria_validations
-- - assessment_conditions_validations

/*
-- Migrate knowledge evidence
INSERT INTO validation_results (
  validation_detail_id, requirement_type, requirement_number, 
  requirement_text, status, reasoning, smart_questions, created_at
)
SELECT 
  valDetail_id, 'knowledge_evidence', ke_number,
  ke_requirement, 
  CASE 
    WHEN ke_status = 'Met' THEN 'met'
    WHEN ke_status = 'Partial' THEN 'partial'
    ELSE 'not_met'
  END,
  reasoning,
  CASE 
    WHEN smart_question IS NOT NULL THEN 
      jsonb_build_array(
        jsonb_build_object(
          'question', smart_question,
          'benchmark_answer', benchmarkAnswer
        )
      )
    ELSE '[]'::jsonb
  END,
  created_at
FROM knowledge_evidence_validations
ON CONFLICT (validation_detail_id, requirement_type, requirement_number, document_namespace) 
DO NOTHING;

-- Similar migrations for other tables...
-- (Add similar INSERT statements for other validation types)
*/

-- ============================================================================
-- PART 6: Permissions and Security
-- ============================================================================

-- Grant permissions (adjust based on your auth setup)
GRANT SELECT, INSERT, UPDATE, DELETE ON validation_results TO authenticated;
GRANT SELECT ON validation_detail_with_stats TO authenticated;
GRANT SELECT ON validation_trigger_monitor TO authenticated;
GRANT EXECUTE ON FUNCTION get_validation_results(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_validation_trigger_status(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION manually_trigger_validation(BIGINT) TO authenticated;

-- ============================================================================
-- PART 7: Configuration
-- ============================================================================

-- Set Supabase credentials for trigger function
-- Replace with your actual values
ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
ALTER DATABASE postgres SET app.supabase_anon_key = 'your_anon_key_here';

-- ============================================================================
-- END OF CONSOLIDATED MIGRATION
-- ============================================================================

-- Verification queries (optional - comment out for production)
/*
SELECT 'Validation Results Table' AS check_name, COUNT(*) AS count FROM validation_results;
SELECT 'Trigger Log Table' AS check_name, COUNT(*) AS count FROM validation_trigger_log;
SELECT 'Validation Detail Stats' AS check_name, COUNT(*) AS count FROM validation_detail_with_stats;
*/
