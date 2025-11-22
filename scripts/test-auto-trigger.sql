-- ============================================================================
-- Test Script: Auto-Trigger Validation Database Trigger
-- ============================================================================
-- Description: Tests the automatic validation trigger functionality
--
-- Usage:
-- 1. Run this script in Supabase SQL Editor
-- 2. Check the results
-- 3. Verify trigger log entries
-- ============================================================================

-- Step 1: Check if trigger exists
-- ============================================================================
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_indexing_complete';

-- Expected: 1 row showing the trigger on gemini_operations table

-- Step 2: Check if trigger function exists
-- ============================================================================
SELECT 
  proname AS function_name,
  pg_get_functiondef(oid) AS function_definition
FROM pg_proc
WHERE proname = 'trigger_validation_on_indexing_complete';

-- Expected: 1 row showing the function definition

-- Step 3: Check if validation_trigger_log table exists
-- ============================================================================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'validation_trigger_log'
ORDER BY ordinal_position;

-- Expected: Multiple rows showing table structure

-- Step 4: Check database settings (credentials)
-- ============================================================================
SELECT 
  CASE 
    WHEN current_setting('app.supabase_url', true) IS NOT NULL 
    THEN '✅ app.supabase_url is set'
    ELSE '❌ app.supabase_url is NOT set'
  END AS supabase_url_status,
  CASE 
    WHEN current_setting('app.supabase_anon_key', true) IS NOT NULL 
    THEN '✅ app.supabase_anon_key is set'
    ELSE '❌ app.supabase_anon_key is NOT set'
  END AS supabase_anon_key_status;

-- Expected: Both should show ✅

-- Step 5: Test get_validation_trigger_status function
-- ============================================================================
-- Replace 123 with a real validation_detail_id from your database
DO $$
DECLARE
  v_validation_detail_id BIGINT;
  v_status RECORD;
BEGIN
  -- Get a recent validation_detail_id
  SELECT id INTO v_validation_detail_id
  FROM validation_detail
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_validation_detail_id IS NULL THEN
    RAISE NOTICE '❌ No validation_detail records found';
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ Testing with validation_detail_id: %', v_validation_detail_id;
  
  -- Get status
  SELECT * INTO v_status FROM get_validation_trigger_status(v_validation_detail_id);
  
  RAISE NOTICE '📊 Status:';
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
    RAISE NOTICE '   Last error: %', v_status.last_trigger_error;
  END IF;
END $$;

-- Step 6: View validation trigger monitor
-- ============================================================================
SELECT 
  validation_detail_id,
  "extractStatus",
  "rtoCode",
  "unitCode",
  total_operations,
  completed_operations,
  failed_operations,
  pending_operations,
  all_complete,
  has_failures,
  trigger_attempted,
  trigger_succeeded,
  last_trigger_at,
  validation_created_at
FROM validation_trigger_monitor
ORDER BY validation_created_at DESC
LIMIT 10;

-- Expected: Recent validations with their trigger status

-- Step 7: View recent trigger log entries
-- ============================================================================
SELECT 
  id,
  validation_detail_id,
  trigger_source,
  request_id,
  error_message,
  triggered_at
FROM validation_trigger_log
ORDER BY triggered_at DESC
LIMIT 10;

-- Expected: Recent trigger attempts (if any)

-- Step 8: Simulate trigger (OPTIONAL - only if you want to test manually)
-- ============================================================================
-- UNCOMMENT AND REPLACE validation_detail_id TO TEST MANUAL TRIGGER
/*
DO $$
DECLARE
  v_validation_detail_id BIGINT := 123; -- REPLACE WITH REAL ID
  v_result JSONB;
BEGIN
  RAISE NOTICE '🧪 Testing manual trigger for validation_detail_id: %', v_validation_detail_id;
  
  SELECT * INTO v_result FROM manually_trigger_validation(v_validation_detail_id);
  
  RAISE NOTICE '📊 Result: %', v_result;
  
  IF (v_result->>'success')::BOOLEAN THEN
    RAISE NOTICE '✅ Manual trigger succeeded!';
    RAISE NOTICE '   Request ID: %', v_result->>'request_id';
  ELSE
    RAISE NOTICE '❌ Manual trigger failed!';
    RAISE NOTICE '   Error: %', v_result->>'error';
  END IF;
END $$;
*/

-- Step 9: Test trigger by simulating operation completion (ADVANCED)
-- ============================================================================
-- ONLY USE THIS IF YOU UNDERSTAND THE IMPLICATIONS
-- This will actually trigger validation if all operations are complete
/*
DO $$
DECLARE
  v_operation_id BIGINT;
  v_validation_detail_id BIGINT;
BEGIN
  -- Find a pending operation
  SELECT id, validation_detail_id INTO v_operation_id, v_validation_detail_id
  FROM gemini_operations
  WHERE status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_operation_id IS NULL THEN
    RAISE NOTICE '❌ No pending operations found to test with';
    RETURN;
  END IF;
  
  RAISE NOTICE '🧪 Simulating completion of operation % for validation_detail %', 
    v_operation_id, v_validation_detail_id;
  
  -- Update operation to completed (this will trigger the trigger)
  UPDATE gemini_operations
  SET status = 'completed'
  WHERE id = v_operation_id;
  
  RAISE NOTICE '✅ Operation marked as completed';
  RAISE NOTICE '⏳ Trigger should fire automatically if all operations complete';
  RAISE NOTICE '📊 Check validation_trigger_log for results';
  
  -- Wait a moment for trigger to execute
  PERFORM pg_sleep(2);
  
  -- Check trigger log
  SELECT 
    CASE 
      WHEN COUNT(*) > 0 THEN '✅ Trigger fired!'
      ELSE '❌ Trigger did not fire'
    END AS trigger_status
  FROM validation_trigger_log
  WHERE validation_detail_id = v_validation_detail_id
    AND triggered_at > NOW() - INTERVAL '10 seconds';
END $$;
*/

-- ============================================================================
-- Troubleshooting
-- ============================================================================

-- If trigger is not firing, check:

-- 1. Is pg_net extension enabled?
SELECT * FROM pg_extension WHERE extname = 'pg_net';
-- Expected: 1 row

-- 2. Are credentials set?
SELECT 
  current_setting('app.supabase_url', true) AS supabase_url,
  current_setting('app.supabase_anon_key', true) AS supabase_anon_key;
-- Expected: Both should have values

-- 3. Check pg_net requests (recent HTTP calls)
SELECT 
  id,
  method,
  url,
  status,
  error_msg,
  created
FROM net._http_response
ORDER BY created DESC
LIMIT 10;
-- Expected: Recent POST requests to trigger-validation endpoint

-- 4. Check PostgreSQL logs for trigger messages
-- Look for messages starting with [Auto-Trigger] in your Supabase logs

-- ============================================================================
-- Cleanup (OPTIONAL - only if you want to remove test data)
-- ============================================================================
/*
-- Delete test trigger log entries
DELETE FROM validation_trigger_log
WHERE trigger_source = 'manual'
  AND triggered_at > NOW() - INTERVAL '1 hour';
*/

-- ============================================================================
-- Success Criteria
-- ============================================================================
-- 
-- ✅ Trigger exists and is enabled
-- ✅ Trigger function exists
-- ✅ validation_trigger_log table exists
-- ✅ Supabase credentials are set
-- ✅ get_validation_trigger_status function works
-- ✅ validation_trigger_monitor view shows data
-- ✅ Manual trigger function works (optional test)
-- ✅ Automatic trigger fires when operation completes (optional test)
-- 
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '✅ Auto-Trigger Validation Test Complete!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Review the results above to verify:';
  RAISE NOTICE '1. Trigger is installed and enabled';
  RAISE NOTICE '2. Credentials are configured';
  RAISE NOTICE '3. Helper functions work correctly';
  RAISE NOTICE '4. Monitoring views show data';
  RAISE NOTICE '';
  RAISE NOTICE 'To test the trigger in action:';
  RAISE NOTICE '1. Upload a document through the UI';
  RAISE NOTICE '2. Wait for indexing to complete';
  RAISE NOTICE '3. Check validation_trigger_log for automatic trigger';
  RAISE NOTICE '4. Verify validation started automatically';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
END $$;
