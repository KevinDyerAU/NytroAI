-- ============================================================================
-- Phase 3.1 Migration Verification Script
-- ============================================================================
-- This script checks if the Phase 3.1 migration has been applied correctly
-- Run this against your Supabase database to verify the migration status
-- ============================================================================

\echo '============================================================================'
\echo 'Phase 3.1 Migration Verification'
\echo '============================================================================'
\echo ''

-- Check 1: Verify new columns exist in validation_detail
\echo 'CHECK 1: Verifying new columns in validation_detail table...'
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'validation_detail'
  AND column_name IN (
    'validation_count',
    'validation_total',
    'validation_progress',
    'validation_status',
    'last_updated_at'
  )
ORDER BY column_name;

\echo ''
\echo 'Expected: 5 rows (validation_count, validation_total, validation_progress, validation_status, last_updated_at)'
\echo ''

-- Check 2: Verify trigger function exists
\echo 'CHECK 2: Verifying trigger function exists...'
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'update_validation_detail_counts';

\echo ''
\echo 'Expected: 1 row (update_validation_detail_counts function)'
\echo ''

-- Check 3: Verify trigger is installed
\echo 'CHECK 3: Verifying trigger is installed on validation_results...'
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'validation_results_update_trigger';

\echo ''
\echo 'Expected: 3 rows (INSERT, UPDATE, DELETE triggers)'
\echo ''

-- Check 4: Verify helper view exists
\echo 'CHECK 4: Verifying validation_detail_with_stats view exists...'
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'validation_detail_with_stats';

\echo ''
\echo 'Expected: 1 row (validation_detail_with_stats VIEW)'
\echo ''

-- Check 5: Verify indexes exist
\echo 'CHECK 5: Verifying indexes on new columns...'
SELECT 
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'validation_detail'
  AND indexname LIKE '%validation_status%' OR indexname LIKE '%validation_progress%';

\echo ''
\echo 'Expected: At least 1-2 indexes on status/progress columns'
\echo ''

-- Check 6: Sample data verification
\echo 'CHECK 6: Verifying data in new columns (sample)...'
SELECT 
  id,
  validation_count,
  validation_total,
  validation_progress,
  validation_status,
  last_updated_at,
  created_at
FROM validation_detail
ORDER BY created_at DESC
LIMIT 5;

\echo ''
\echo 'Expected: Data populated in new columns'
\echo ''

-- Check 7: Trigger test (read-only query to check counts match)
\echo 'CHECK 7: Verifying count accuracy (comparing validation_count to actual records)...'
SELECT 
  vd.id,
  vd.validation_count as stored_count,
  COUNT(vr.id) as actual_count,
  CASE 
    WHEN vd.validation_count = COUNT(vr.id) THEN 'MATCH ✓'
    ELSE 'MISMATCH ✗'
  END as status
FROM validation_detail vd
LEFT JOIN validation_results vr ON vr.validation_detail_id = vd.id
GROUP BY vd.id, vd.validation_count
HAVING vd.validation_count != COUNT(vr.id) OR COUNT(vr.id) > 0
LIMIT 10;

\echo ''
\echo 'Expected: All rows should show MATCH ✓'
\echo ''

\echo '============================================================================'
\echo 'Verification Complete'
\echo '============================================================================'
\echo ''
\echo 'If all checks pass, Phase 3.1 migration is successfully applied.'
\echo 'If any checks fail, run the migration: supabase/migrations/20250122_validation_detail_status_improvements.sql'
\echo ''
