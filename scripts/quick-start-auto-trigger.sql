-- ============================================================================
-- Quick Start: Auto-Trigger Validation Setup
-- ============================================================================
-- Description: Quick start script to set up and verify auto-trigger system
-- Usage: Copy this entire file and run in Supabase SQL Editor
-- ============================================================================

-- STEP 1: No setup required!
-- ============================================================================
-- Credentials are hardcoded in the migration (safe - anon key is public)

-- ============================================================================
-- STEP 2: Verify Migration Applied
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'STEP 2: Verifying Auto-Trigger Installation';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '';
END $$;

-- Check trigger exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'on_indexing_complete'
    )
    THEN '✅ Trigger installed'
    ELSE '❌ Trigger NOT installed - Run migration first!'
  END AS trigger_status;

-- Check trigger function exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'trigger_validation_on_indexing_complete'
    )
    THEN '✅ Trigger function exists'
    ELSE '❌ Trigger function missing - Run migration first!'
  END AS function_status;

-- Check validation_trigger_log table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'validation_trigger_log'
    )
    THEN '✅ Trigger log table exists'
    ELSE '❌ Trigger log table missing - Run migration first!'
  END AS table_status;

-- Check pg_net extension
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_extension 
      WHERE extname = 'pg_net'
    )
    THEN '✅ pg_net extension enabled'
    ELSE '❌ pg_net extension missing - Run migration first!'
  END AS pgnet_status;

-- ============================================================================
-- STEP 3: Credentials (No Action Needed)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'STEP 3: Credentials Status';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Credentials are hardcoded in the trigger functions';
  RAISE NOTICE '✅ Using: https://dfqxmjmggokneiuljkta.supabase.co';
  RAISE NOTICE '✅ Anon key: Configured (safe - already public in frontend)';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 4: Test Helper Functions
-- ============================================================================

DO $$
DECLARE
  v_validation_detail_id BIGINT;
  v_status RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'STEP 4: Testing Helper Functions';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '';
  
  -- Get most recent validation
  SELECT id INTO v_validation_detail_id
  FROM validation_detail
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_validation_detail_id IS NULL THEN
    RAISE NOTICE '⚠️  No validation_detail records found - Upload a document first';
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ Found recent validation: ID=%', v_validation_detail_id;
  RAISE NOTICE '';
  
  -- Test get_validation_trigger_status
  SELECT * INTO v_status FROM get_validation_trigger_status(v_validation_detail_id);
  
  RAISE NOTICE '📊 Validation Status:';
  RAISE NOTICE '   Total operations: %', v_status.total_operations;
  RAISE NOTICE '   Completed: %', v_status.completed_operations;
  RAISE NOTICE '   Failed: %', v_status.failed_operations;
  RAISE NOTICE '   Pending: %', v_status.pending_operations;
  RAISE NOTICE '   All complete: %', v_status.all_complete;
  RAISE NOTICE '   Has failures: %', v_status.has_failures;
  RAISE NOTICE '   Trigger attempted: %', v_status.trigger_attempted;
  RAISE NOTICE '   Trigger succeeded: %', v_status.trigger_succeeded;
  
  IF v_status.last_trigger_at IS NOT NULL THEN
    RAISE NOTICE '   Last trigger: %', v_status.last_trigger_at;
  END IF;
  
  IF v_status.last_trigger_error IS NOT NULL THEN
    RAISE NOTICE '   ⚠️  Last error: %', v_status.last_trigger_error;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Helper functions working correctly';
  
END $$;

-- ============================================================================
-- STEP 5: View Monitoring Dashboard
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'STEP 5: Recent Validations (Monitoring Dashboard)';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '';
END $$;

SELECT 
  validation_detail_id AS "ID",
  "extractStatus" AS "Extract Status",
  COALESCE("rtoCode", 'N/A') AS "RTO",
  COALESCE("unitCode", 'N/A') AS "Unit",
  total_operations AS "Total Ops",
  completed_operations AS "Completed",
  failed_operations AS "Failed",
  pending_operations AS "Pending",
  CASE WHEN all_complete THEN '✅' ELSE '⏳' END AS "Complete?",
  CASE WHEN trigger_attempted THEN '✅' ELSE '❌' END AS "Triggered?",
  CASE WHEN trigger_succeeded THEN '✅' ELSE '❌' END AS "Success?",
  TO_CHAR(validation_created_at, 'YYYY-MM-DD HH24:MI:SS') AS "Created"
FROM validation_trigger_monitor
ORDER BY validation_created_at DESC
LIMIT 10;

-- ============================================================================
-- STEP 6: View Trigger Log
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'STEP 6: Recent Trigger Attempts';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '';
END $$;

SELECT 
  id AS "Log ID",
  validation_detail_id AS "Validation ID",
  trigger_source AS "Source",
  request_id AS "Request ID",
  CASE 
    WHEN error_message IS NULL THEN '✅ Success'
    ELSE '❌ ' || error_message
  END AS "Result",
  TO_CHAR(triggered_at, 'YYYY-MM-DD HH24:MI:SS') AS "Triggered At"
FROM validation_trigger_log
ORDER BY triggered_at DESC
LIMIT 10;

-- ============================================================================
-- STEP 7: Test Manual Trigger (Optional)
-- ============================================================================

DO $$
DECLARE
  v_validation_detail_id BIGINT;
  v_result JSONB;
  v_status RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'STEP 7: Manual Trigger Test (Optional)';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '';
  
  -- Find a validation that's ready to trigger
  SELECT vd.id INTO v_validation_detail_id
  FROM validation_detail vd
  WHERE EXISTS (
    SELECT 1 FROM gemini_operations go
    WHERE go.validation_detail_id = vd.id
  )
  ORDER BY vd.created_at DESC
  LIMIT 1;
  
  IF v_validation_detail_id IS NULL THEN
    RAISE NOTICE '⚠️  No validations found to test - Upload documents first';
    RETURN;
  END IF;
  
  -- Get status
  SELECT * INTO v_status FROM get_validation_trigger_status(v_validation_detail_id);
  
  RAISE NOTICE '🧪 Testing manual trigger for validation_detail_id: %', v_validation_detail_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Status before trigger:';
  RAISE NOTICE '   All complete: %', v_status.all_complete;
  RAISE NOTICE '   Has failures: %', v_status.has_failures;
  RAISE NOTICE '';
  
  -- Attempt manual trigger
  SELECT * INTO v_result FROM manually_trigger_validation(v_validation_detail_id);
  
  RAISE NOTICE '📊 Trigger Result:';
  RAISE NOTICE '%', v_result;
  RAISE NOTICE '';
  
  IF (v_result->>'success')::BOOLEAN THEN
    RAISE NOTICE '✅ Manual trigger succeeded!';
    IF v_result->>'request_id' IS NOT NULL THEN
      RAISE NOTICE '   Request ID: %', v_result->>'request_id';
    END IF;
  ELSE
    RAISE NOTICE '❌ Manual trigger failed or not ready';
    IF v_result->>'error' IS NOT NULL THEN
      RAISE NOTICE '   Reason: %', v_result->>'error';
    END IF;
    IF v_result->>'status' IS NOT NULL THEN
      RAISE NOTICE '   Status: %', v_result->>'status';
    END IF;
  END IF;
  
END $$;

-- ============================================================================
-- STEP 8: Check Recent HTTP Requests
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'STEP 8: Recent HTTP Requests to trigger-validation';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '';
END $$;

SELECT 
  id AS "Request ID",
  method AS "Method",
  status AS "HTTP Status",
  CASE 
    WHEN error_msg IS NULL THEN '✅ Success'
    ELSE '❌ ' || error_msg
  END AS "Result",
  TO_CHAR(created, 'YYYY-MM-DD HH24:MI:SS') AS "Created"
FROM net._http_response
WHERE url LIKE '%trigger-validation%'
ORDER BY created DESC
LIMIT 10;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
DECLARE
  v_trigger_exists BOOLEAN;
  v_credentials_set BOOLEAN;
  v_recent_triggers INT;
  v_successful_triggers INT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '📋 SETUP SUMMARY';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '';
  
  -- Check trigger
  SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'on_indexing_complete'
  ) INTO v_trigger_exists;
  
  -- Credentials are hardcoded, so always true
  v_credentials_set := true;
  
  -- Check recent triggers
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE error_message IS NULL)
  INTO v_recent_triggers, v_successful_triggers
  FROM validation_trigger_log
  WHERE triggered_at > NOW() - INTERVAL '7 days';
  
  -- Print summary
  RAISE NOTICE '✅ Trigger installed: %', v_trigger_exists;
  RAISE NOTICE '✅ Credentials: Hardcoded (safe - anon key is public)';
  RAISE NOTICE '📊 Recent triggers (7 days): % (% successful)', 
    v_recent_triggers, v_successful_triggers;
  RAISE NOTICE '';
  
  IF NOT v_trigger_exists THEN
    RAISE NOTICE '❌ ACTION REQUIRED: Run migration first!';
    RAISE NOTICE '   File: supabase/migrations/20250122_auto_trigger_validation.sql';
  ELSE
    RAISE NOTICE '✅ Setup complete! Auto-trigger is ready to use.';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Upload a document through the UI';
    RAISE NOTICE '2. Wait for indexing to complete';
    RAISE NOTICE '3. Check validation_trigger_log for automatic trigger';
    RAISE NOTICE '4. Verify validation started automatically';
    RAISE NOTICE '';
    RAISE NOTICE 'Monitoring queries:';
    RAISE NOTICE '   SELECT * FROM validation_trigger_monitor;';
    RAISE NOTICE '   SELECT * FROM validation_trigger_log ORDER BY triggered_at DESC;';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  
END $$;
