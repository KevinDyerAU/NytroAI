-- ============================================================================
-- Migration: N8n Integration
-- ============================================================================
-- Description: Update database triggers and schema to use n8n workflow
--              instead of edge functions for validation
--
-- Changes:
-- 1. Add unit_link column to validation_results
-- 2. Add citation columns to validation_results
-- 3. Update auto-trigger function to call n8n webhook
-- 4. Add n8n_webhook_url configuration
-- ============================================================================

-- Step 1: Add unit_link column to validation_results
-- ============================================================================
ALTER TABLE validation_results 
ADD COLUMN IF NOT EXISTS unit_link TEXT,
ADD COLUMN IF NOT EXISTS validation_detail_id BIGINT REFERENCES validation_detail(id);

CREATE INDEX IF NOT EXISTS idx_validation_results_unit_link 
ON validation_results(unit_link);

CREATE INDEX IF NOT EXISTS idx_validation_results_validation_detail_id 
ON validation_results(validation_detail_id);

-- Step 2: Add citation columns (if not already added)
-- ============================================================================
ALTER TABLE validation_results 
ADD COLUMN IF NOT EXISTS grounding_metadata JSONB,
ADD COLUMN IF NOT EXISTS citation_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_confidence NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS citation_coverage NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS quality_flags JSONB;

-- Add indexes for citation columns
CREATE INDEX IF NOT EXISTS idx_validation_results_grounding 
ON validation_results USING GIN (grounding_metadata);

CREATE INDEX IF NOT EXISTS idx_validation_results_quality 
ON validation_results(citation_coverage, average_confidence) 
WHERE citation_count > 0;

CREATE INDEX IF NOT EXISTS idx_validation_results_citation_count 
ON validation_results(citation_count);

-- Step 3: Create configuration table for n8n webhook URL
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert n8n webhook URL
INSERT INTO app_config (key, value, description)
VALUES (
  'n8n_webhook_url',
  'https://n8n-gtoa.onrender.com/webhook/validate-document',
  'N8n workflow webhook URL for validation'
)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Step 4: Update auto-trigger function to call n8n webhook
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_validation_on_indexing_complete_n8n()
RETURNS TRIGGER AS $$
DECLARE
  v_validation_detail_id BIGINT;
  v_total_operations INT;
  v_completed_operations INT;
  v_failed_operations INT;
  v_n8n_webhook_url TEXT;
  v_request_id BIGINT;
BEGIN
  -- Only proceed if status changed to 'completed'
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get validation_detail_id from the updated operation
  v_validation_detail_id := NEW.validation_detail_id;
  
  -- Skip if no validation_detail_id
  IF v_validation_detail_id IS NULL THEN
    RAISE NOTICE '[Auto-Trigger N8n] Skipping: No validation_detail_id in operation %', NEW.id;
    RETURN NEW;
  END IF;

  RAISE NOTICE '[Auto-Trigger N8n] Operation % completed for validation_detail %', NEW.id, v_validation_detail_id;

  -- Count total, completed, and failed operations for this validation
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'failed')
  INTO 
    v_total_operations,
    v_completed_operations,
    v_failed_operations
  FROM gemini_operations
  WHERE validation_detail_id = v_validation_detail_id;

  RAISE NOTICE '[Auto-Trigger N8n] Status: total=%, completed=%, failed=%', 
    v_total_operations, v_completed_operations, v_failed_operations;

  -- Check if all operations are complete (and none failed)
  IF v_total_operations > 0 AND 
     v_completed_operations = v_total_operations AND 
     v_failed_operations = 0 THEN
    
    RAISE NOTICE '[Auto-Trigger N8n] All operations complete! Triggering n8n validation for validation_detail %', 
      v_validation_detail_id;

    -- Get n8n webhook URL from config
    SELECT value INTO v_n8n_webhook_url
    FROM app_config
    WHERE key = 'n8n_webhook_url';

    IF v_n8n_webhook_url IS NULL THEN
      RAISE WARNING '[Auto-Trigger N8n] N8n webhook URL not configured';
      RETURN NEW;
    END IF;

    -- Call n8n webhook via HTTP (requires pg_net extension)
    BEGIN
      SELECT net.http_post(
        url := v_n8n_webhook_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'validationDetailId', v_validation_detail_id
        )
      ) INTO v_request_id;

      RAISE NOTICE '[Auto-Trigger N8n] HTTP request sent to n8n, request_id: %', v_request_id;

      -- Update validation_detail status to 'validating'
      UPDATE validation_detail
      SET status = 'validating', updated_at = NOW()
      WHERE id = v_validation_detail_id;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[Auto-Trigger N8n] Failed to call n8n webhook: %', SQLERRM;
      
      -- Update validation_detail status to 'failed'
      UPDATE validation_detail
      SET status = 'failed', 
          error_message = 'Failed to trigger n8n validation: ' || SQLERRM,
          updated_at = NOW()
      WHERE id = v_validation_detail_id;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Drop old trigger and create new one
-- ============================================================================
DROP TRIGGER IF EXISTS auto_trigger_validation ON gemini_operations;

CREATE TRIGGER auto_trigger_validation_n8n
  AFTER UPDATE ON gemini_operations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_validation_on_indexing_complete_n8n();

-- Step 6: Add comments
-- ============================================================================
COMMENT ON FUNCTION trigger_validation_on_indexing_complete_n8n() IS 
'Automatically triggers n8n validation workflow when all document indexing operations complete';

COMMENT ON TRIGGER auto_trigger_validation_n8n ON gemini_operations IS 
'Calls n8n webhook to trigger validation when indexing completes';

COMMENT ON TABLE app_config IS 
'Application configuration key-value store';

COMMENT ON COLUMN validation_results.unit_link IS 
'Full URL to unit on training.gov.au (from UnitOfCompetency.Link)';

COMMENT ON COLUMN validation_results.validation_detail_id IS 
'Reference to validation_detail record that generated this result';

COMMENT ON COLUMN validation_results.grounding_metadata IS 
'Contains allCitations array and groundingSupports from Gemini response';

COMMENT ON COLUMN validation_results.citation_count IS 
'Total number of grounding chunks/citations found';

COMMENT ON COLUMN validation_results.average_confidence IS 
'Average confidence score across all grounding supports (0-1)';

COMMENT ON COLUMN validation_results.citation_coverage IS 
'Percentage of validations that have citations (0-100)';

COMMENT ON COLUMN validation_results.quality_flags IS 
'Quality flags: {noCitations, lowCoverage, lowConfidence, goodQuality}';

-- Step 7: Verification queries
-- ============================================================================
-- Verify columns added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'validation_results' 
  AND column_name IN ('unit_link', 'validation_detail_id', 'grounding_metadata', 'citation_count');

-- Verify trigger created
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'auto_trigger_validation_n8n';

-- Verify config table
SELECT * FROM app_config WHERE key = 'n8n_webhook_url';

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================
/*
-- Drop new trigger
DROP TRIGGER IF EXISTS auto_trigger_validation_n8n ON gemini_operations;

-- Drop new function
DROP FUNCTION IF EXISTS trigger_validation_on_indexing_complete_n8n();

-- Restore old trigger (if you have the old function)
-- CREATE TRIGGER auto_trigger_validation ...

-- Remove new columns (WARNING: This will delete data)
ALTER TABLE validation_results 
DROP COLUMN IF EXISTS unit_link,
DROP COLUMN IF EXISTS validation_detail_id,
DROP COLUMN IF EXISTS grounding_metadata,
DROP COLUMN IF EXISTS citation_count,
DROP COLUMN IF EXISTS average_confidence,
DROP COLUMN IF EXISTS citation_coverage,
DROP COLUMN IF EXISTS quality_flags;

-- Drop config table
DROP TABLE IF EXISTS app_config;
*/

-- ============================================================================
-- End of Migration
-- ============================================================================
