-- ============================================================================
-- Migration: Auto-Trigger Validation on Indexing Complete
-- ============================================================================
-- Description: Automatically triggers validation when all document indexing
--              operations complete for a validation_detail record.
--
-- Trigger Flow:
-- 1. gemini_operations.status updated to 'completed'
-- 2. Trigger checks if ALL operations for that validation_detail are complete
-- 3. If all complete, calls trigger-validation edge function
-- 4. Validation starts automatically without client-side polling
--
-- Benefits:
-- - Fully automatic (server-side)
-- - No client-side polling required
-- - Works even if user closes browser
-- - More reliable and efficient
-- - Immediate triggering (no polling delay)
-- ============================================================================

-- Step 1: Create function to call edge function via HTTP
-- ============================================================================
-- Note: This requires the pg_net extension for HTTP requests
-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Create trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_validation_on_indexing_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_validation_detail_id BIGINT;
  v_total_operations INT;
  v_completed_operations INT;
  v_failed_operations INT;
  v_supabase_url TEXT;
  v_supabase_anon_key TEXT;
  v_request_id BIGINT;
BEGIN
  -- Only proceed if status changed to 'completed'
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get validation_detail_id from the updated operation
  v_validation_detail_id := NEW.validation_detail_id;
  
  -- Skip if no validation_detail_id (shouldn't happen, but be safe)
  IF v_validation_detail_id IS NULL THEN
    RAISE NOTICE '[Auto-Trigger] Skipping: No validation_detail_id in operation %', NEW.id;
    RETURN NEW;
  END IF;

  RAISE NOTICE '[Auto-Trigger] Operation % completed for validation_detail %', NEW.id, v_validation_detail_id;

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

  RAISE NOTICE '[Auto-Trigger] Status: total=%, completed=%, failed=%', 
    v_total_operations, v_completed_operations, v_failed_operations;

  -- Check if all operations are complete (and none failed)
  IF v_total_operations > 0 AND 
     v_completed_operations = v_total_operations AND 
     v_failed_operations = 0 THEN
    
    RAISE NOTICE '[Auto-Trigger] All operations complete! Triggering validation for validation_detail %', 
      v_validation_detail_id;

    -- Hardcode Supabase credentials (safe for anon key - it's public anyway)
    -- Note: These are the same credentials used in the frontend
    v_supabase_url := 'https://dfqxmjmggokneiuljkta.supabase.co';
    v_supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmcXhtam1nZ29rbmVpdWxqa3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MDg0NjIsImV4cCI6MjA3NzE4NDQ2Mn0.vPf2oAVXSZPNvWip08QLNvvHGx1dT8njRQdS568OxkE';
    
    -- Validate credentials are set
    IF v_supabase_url IS NULL OR v_supabase_anon_key IS NULL THEN
      RAISE WARNING '[Auto-Trigger] Missing Supabase credentials. Cannot trigger validation.';
      RETURN NEW;
    END IF;

    -- Call trigger-validation edge function via HTTP
    BEGIN
      SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/trigger-validation',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || v_supabase_anon_key,
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'validationDetailId', v_validation_detail_id
        )
      ) INTO v_request_id;

      RAISE NOTICE '[Auto-Trigger] HTTP request sent: request_id=%', v_request_id;
      
      -- Log the trigger event
      INSERT INTO validation_trigger_log (
        validation_detail_id,
        trigger_source,
        request_id,
        triggered_at
      ) VALUES (
        v_validation_detail_id,
        'database_trigger',
        v_request_id,
        NOW()
      );
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[Auto-Trigger] Failed to call edge function: %', SQLERRM;
      
      -- Log the failure
      INSERT INTO validation_trigger_log (
        validation_detail_id,
        trigger_source,
        error_message,
        triggered_at
      ) VALUES (
        v_validation_detail_id,
        'database_trigger',
        SQLERRM,
        NOW()
      );
    END;
    
  ELSIF v_failed_operations > 0 THEN
    RAISE NOTICE '[Auto-Trigger] Some operations failed (failed=%): Not triggering validation', 
      v_failed_operations;
      
    -- Update validation_detail status to indicate failure
    UPDATE validation_detail
    SET "extractStatus" = 'IndexingFailed'
    WHERE id = v_validation_detail_id;
    
  ELSE
    RAISE NOTICE '[Auto-Trigger] Not all operations complete yet (completed=%/%)', 
      v_completed_operations, v_total_operations;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION trigger_validation_on_indexing_complete() IS 
'Automatically triggers validation when all indexing operations complete for a validation_detail';

-- Step 3: Create validation trigger log table
-- ============================================================================
CREATE TABLE IF NOT EXISTS validation_trigger_log (
  id BIGSERIAL PRIMARY KEY,
  validation_detail_id BIGINT NOT NULL REFERENCES validation_detail(id) ON DELETE CASCADE,
  trigger_source TEXT NOT NULL, -- 'database_trigger' or 'manual'
  request_id BIGINT, -- pg_net request ID
  error_message TEXT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT validation_trigger_log_source_check CHECK (trigger_source IN ('database_trigger', 'manual', 'polling'))
);

CREATE INDEX IF NOT EXISTS idx_validation_trigger_log_validation_detail_id 
  ON validation_trigger_log(validation_detail_id);
CREATE INDEX IF NOT EXISTS idx_validation_trigger_log_triggered_at 
  ON validation_trigger_log(triggered_at DESC);

COMMENT ON TABLE validation_trigger_log IS 
'Logs all validation trigger attempts (database trigger, manual, or polling)';

-- Step 4: Create trigger on gemini_operations
-- ============================================================================
DROP TRIGGER IF EXISTS on_indexing_complete ON gemini_operations;

CREATE TRIGGER on_indexing_complete
AFTER UPDATE OF status ON gemini_operations
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
EXECUTE FUNCTION trigger_validation_on_indexing_complete();

COMMENT ON TRIGGER on_indexing_complete ON gemini_operations IS 
'Automatically triggers validation when all indexing operations complete';

-- Step 5: Create helper function to check trigger status
-- ============================================================================
CREATE OR REPLACE FUNCTION get_validation_trigger_status(p_validation_detail_id BIGINT)
RETURNS TABLE (
  total_operations INT,
  completed_operations INT,
  failed_operations INT,
  pending_operations INT,
  all_complete BOOLEAN,
  has_failures BOOLEAN,
  trigger_attempted BOOLEAN,
  trigger_succeeded BOOLEAN,
  last_trigger_at TIMESTAMPTZ,
  last_trigger_error TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INT AS total_operations,
    COUNT(*) FILTER (WHERE go.status = 'completed')::INT AS completed_operations,
    COUNT(*) FILTER (WHERE go.status = 'failed')::INT AS failed_operations,
    COUNT(*) FILTER (WHERE go.status IN ('pending', 'processing'))::INT AS pending_operations,
    (COUNT(*) > 0 AND COUNT(*) = COUNT(*) FILTER (WHERE go.status = 'completed'))::BOOLEAN AS all_complete,
    (COUNT(*) FILTER (WHERE go.status = 'failed') > 0)::BOOLEAN AS has_failures,
    (SELECT COUNT(*) > 0 FROM validation_trigger_log WHERE validation_detail_id = p_validation_detail_id)::BOOLEAN AS trigger_attempted,
    (SELECT COUNT(*) > 0 FROM validation_trigger_log WHERE validation_detail_id = p_validation_detail_id AND error_message IS NULL)::BOOLEAN AS trigger_succeeded,
    (SELECT MAX(triggered_at) FROM validation_trigger_log WHERE validation_detail_id = p_validation_detail_id) AS last_trigger_at,
    (SELECT error_message FROM validation_trigger_log WHERE validation_detail_id = p_validation_detail_id ORDER BY triggered_at DESC LIMIT 1) AS last_trigger_error
  FROM gemini_operations go
  WHERE go.validation_detail_id = p_validation_detail_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_validation_trigger_status(BIGINT) IS 
'Returns detailed status of validation trigger for a validation_detail';

-- Step 6: Create manual trigger function (for fallback/testing)
-- ============================================================================
CREATE OR REPLACE FUNCTION manually_trigger_validation(p_validation_detail_id BIGINT)
RETURNS JSONB AS $$
DECLARE
  v_status RECORD;
  v_supabase_url TEXT;
  v_supabase_anon_key TEXT;
  v_request_id BIGINT;
BEGIN
  -- Get current status
  SELECT * INTO v_status FROM get_validation_trigger_status(p_validation_detail_id);
  
  -- Check if ready to trigger
  IF NOT v_status.all_complete THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not all operations complete',
      'status', row_to_json(v_status)
    );
  END IF;
  
  IF v_status.has_failures THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Some operations failed',
      'status', row_to_json(v_status)
    );
  END IF;
  
  -- Hardcode Supabase credentials (same as trigger function)
  v_supabase_url := 'https://dfqxmjmggokneiuljkta.supabase.co';
  v_supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmcXhtam1nZ29rbmVpdWxqa3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MDg0NjIsImV4cCI6MjA3NzE4NDQ2Mn0.vPf2oAVXSZPNvWip08QLNvvHGx1dT8njRQdS568OxkE';
  
  -- Trigger validation
  BEGIN
    SELECT net.http_post(
      url := v_supabase_url || '/functions/v1/trigger-validation',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_supabase_anon_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'validationDetailId', p_validation_detail_id
      )
    ) INTO v_request_id;
    
    -- Log the trigger
    INSERT INTO validation_trigger_log (
      validation_detail_id,
      trigger_source,
      request_id,
      triggered_at
    ) VALUES (
      p_validation_detail_id,
      'manual',
      v_request_id,
      NOW()
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'request_id', v_request_id,
      'message', 'Validation triggered successfully'
    );
    
  EXCEPTION WHEN OTHERS THEN
    -- Log the failure
    INSERT INTO validation_trigger_log (
      validation_detail_id,
      trigger_source,
      error_message,
      triggered_at
    ) VALUES (
      p_validation_detail_id,
      'manual',
      SQLERRM,
      NOW()
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION manually_trigger_validation(BIGINT) IS 
'Manually trigger validation for a validation_detail (for testing/fallback)';

-- Step 7: Grant necessary permissions
-- ============================================================================
-- Grant execute permission on trigger function to authenticated users
GRANT EXECUTE ON FUNCTION get_validation_trigger_status(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION manually_trigger_validation(BIGINT) TO authenticated;

-- Grant select on trigger log to authenticated users
GRANT SELECT ON validation_trigger_log TO authenticated;

-- Step 8: Create view for monitoring
-- ============================================================================
CREATE OR REPLACE VIEW validation_trigger_monitor AS
SELECT
  vd.id AS validation_detail_id,
  vd."extractStatus",
  vs."rtoCode",
  vs."unitCode",
  vts.total_operations,
  vts.completed_operations,
  vts.failed_operations,
  vts.pending_operations,
  vts.all_complete,
  vts.has_failures,
  vts.trigger_attempted,
  vts.trigger_succeeded,
  vts.last_trigger_at,
  vts.last_trigger_error,
  vd.created_at AS validation_created_at
FROM validation_detail vd
JOIN validation_summary vs ON vd.summary_id = vs.id
CROSS JOIN LATERAL get_validation_trigger_status(vd.id) vts
WHERE vd.created_at > NOW() - INTERVAL '7 days' -- Last 7 days
ORDER BY vd.created_at DESC;

COMMENT ON VIEW validation_trigger_monitor IS 
'Monitor validation trigger status for recent validations';

GRANT SELECT ON validation_trigger_monitor TO authenticated;

-- ============================================================================
-- Setup Instructions
-- ============================================================================
-- 
-- ✅ No additional setup required!
-- 
-- Supabase credentials are hardcoded in the trigger functions.
-- (This is safe - the anon key is already public in your frontend code)
--
-- Next steps:
--
-- 1. Verify trigger exists:
--    SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_indexing_complete';
--
-- 2. Test manual trigger (optional):
--    SELECT * FROM manually_trigger_validation(123); -- Replace with real ID
--
-- 3. Monitor triggers:
--    SELECT * FROM validation_trigger_monitor;
--    SELECT * FROM validation_trigger_log ORDER BY triggered_at DESC LIMIT 10;
--
-- 4. Upload a document and watch it trigger automatically!
--
-- ============================================================================

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '✅ Auto-trigger validation migration complete!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Trigger installed and ready to use!';
  RAISE NOTICE '✅ Credentials are hardcoded in the functions';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Verify: SELECT * FROM information_schema.triggers WHERE trigger_name = ''on_indexing_complete'';';
  RAISE NOTICE '2. Test: Upload a document and check validation_trigger_log';
  RAISE NOTICE '3. Monitor: SELECT * FROM validation_trigger_monitor;';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
END $$;
