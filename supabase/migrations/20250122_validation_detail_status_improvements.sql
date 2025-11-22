-- ============================================================================
-- Phase 3.1: Validation Detail Status Improvements
-- ============================================================================
-- This migration adds computed columns and triggers to validation_detail
-- to ensure status consistency with validation_results table
-- ============================================================================

-- Step 1: Add new status tracking columns
-- ============================================================================

ALTER TABLE validation_detail
ADD COLUMN IF NOT EXISTS validation_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS validation_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS validation_progress DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP DEFAULT NOW();

COMMENT ON COLUMN validation_detail.validation_count IS 'Auto-updated count of validation results';
COMMENT ON COLUMN validation_detail.validation_total IS 'Total validation results expected';
COMMENT ON COLUMN validation_detail.validation_progress IS 'Percentage of validations marked as met (0-100)';
COMMENT ON COLUMN validation_detail.validation_status IS 'Current validation status: pending, in_progress, partial, completed, failed';
COMMENT ON COLUMN validation_detail.last_updated_at IS 'Timestamp of last status update';

-- Step 2: Create status enum for better type safety (optional, can be added later)
-- ============================================================================
-- Keeping as TEXT for now to avoid breaking changes, but documenting valid values:
-- Valid validation_status values:
-- - 'pending': No validation results yet
-- - 'in_progress': Some validation results exist, not all completed
-- - 'partial': All validations complete, some not-met
-- - 'completed': All validations complete, all met
-- - 'failed': Validation process failed

-- Step 3: Create function to update validation_detail counts
-- ============================================================================

CREATE OR REPLACE FUNCTION update_validation_detail_counts()
RETURNS TRIGGER AS $$
DECLARE
  v_detail_id BIGINT;
  v_total_count INTEGER;
  v_met_count INTEGER;
  v_not_met_count INTEGER;
  v_partial_count INTEGER;
  v_progress DECIMAL(5,2);
  v_status TEXT;
BEGIN
  -- Get the validation_detail_id from the affected row
  v_detail_id := COALESCE(NEW.validation_detail_id, OLD.validation_detail_id);
  
  IF v_detail_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Calculate counts
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'met'),
    COUNT(*) FILTER (WHERE status = 'not-met'),
    COUNT(*) FILTER (WHERE status = 'partial')
  INTO 
    v_total_count,
    v_met_count,
    v_not_met_count,
    v_partial_count
  FROM validation_results
  WHERE validation_detail_id = v_detail_id;
  
  -- Calculate progress (percentage of met validations)
  IF v_total_count > 0 THEN
    v_progress := ROUND((v_met_count::DECIMAL / v_total_count) * 100, 2);
  ELSE
    v_progress := 0.00;
  END IF;
  
  -- Determine status
  IF v_total_count = 0 THEN
    v_status := 'pending';
  ELSIF v_met_count = v_total_count THEN
    v_status := 'completed';
  ELSIF v_not_met_count > 0 OR v_partial_count > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'in_progress';
  END IF;
  
  -- Update validation_detail
  UPDATE validation_detail
  SET 
    validation_count = v_total_count,
    validation_total = v_total_count,
    validation_progress = v_progress,
    validation_status = v_status,
    last_updated_at = NOW()
  WHERE id = v_detail_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_validation_detail_counts() IS 'Automatically updates validation_detail counts and status when validation_results change';

-- Step 4: Create trigger on validation_results
-- ============================================================================

DROP TRIGGER IF EXISTS validation_results_update_trigger ON validation_results;

CREATE TRIGGER validation_results_update_trigger
AFTER INSERT OR UPDATE OR DELETE ON validation_results
FOR EACH ROW
EXECUTE FUNCTION update_validation_detail_counts();

COMMENT ON TRIGGER validation_results_update_trigger ON validation_results IS 'Keeps validation_detail status in sync with validation_results';

-- Step 5: Backfill existing data
-- ============================================================================

DO $$
DECLARE
  v_detail RECORD;
  v_total_count INTEGER;
  v_met_count INTEGER;
  v_not_met_count INTEGER;
  v_partial_count INTEGER;
  v_progress DECIMAL(5,2);
  v_status TEXT;
BEGIN
  RAISE NOTICE 'Backfilling validation_detail status fields...';
  
  FOR v_detail IN 
    SELECT DISTINCT validation_detail_id 
    FROM validation_results
    WHERE validation_detail_id IS NOT NULL
  LOOP
    -- Calculate counts for this validation_detail
    SELECT 
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'met'),
      COUNT(*) FILTER (WHERE status = 'not-met'),
      COUNT(*) FILTER (WHERE status = 'partial')
    INTO 
      v_total_count,
      v_met_count,
      v_not_met_count,
      v_partial_count
    FROM validation_results
    WHERE validation_detail_id = v_detail.validation_detail_id;
    
    -- Calculate progress
    IF v_total_count > 0 THEN
      v_progress := ROUND((v_met_count::DECIMAL / v_total_count) * 100, 2);
    ELSE
      v_progress := 0.00;
    END IF;
    
    -- Determine status
    IF v_total_count = 0 THEN
      v_status := 'pending';
    ELSIF v_met_count = v_total_count THEN
      v_status := 'completed';
    ELSIF v_not_met_count > 0 OR v_partial_count > 0 THEN
      v_status := 'partial';
    ELSE
      v_status := 'in_progress';
    END IF;
    
    -- Update validation_detail
    UPDATE validation_detail
    SET 
      validation_count = v_total_count,
      validation_total = v_total_count,
      validation_progress = v_progress,
      validation_status = v_status,
      last_updated_at = NOW()
    WHERE id = v_detail.validation_detail_id;
    
  END LOOP;
  
  RAISE NOTICE 'Backfill complete';
END $$;

-- Step 6: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_validation_detail_status 
ON validation_detail(validation_status);

CREATE INDEX IF NOT EXISTS idx_validation_detail_progress 
ON validation_detail(validation_progress);

CREATE INDEX IF NOT EXISTS idx_validation_detail_last_updated 
ON validation_detail(last_updated_at DESC);

-- Step 7: Add helper view for dashboard queries
-- ============================================================================

CREATE OR REPLACE VIEW validation_detail_with_stats AS
SELECT 
  vd.*,
  vt.name as validation_type_name,
  vs.rtoCode,
  vs.unitCode,
  CASE 
    WHEN vd.validation_status = 'completed' THEN 'success'
    WHEN vd.validation_status = 'partial' THEN 'warning'
    WHEN vd.validation_status = 'failed' THEN 'error'
    WHEN vd.validation_status = 'in_progress' THEN 'info'
    ELSE 'default'
  END as status_variant,
  CASE
    WHEN vd.validation_count = 0 THEN 'No validations yet'
    WHEN vd.validation_status = 'completed' THEN 'All requirements met'
    WHEN vd.validation_status = 'partial' THEN format('%s of %s requirements met', 
      (SELECT COUNT(*) FROM validation_results WHERE validation_detail_id = vd.id AND status = 'met'),
      vd.validation_total)
    WHEN vd.validation_status = 'in_progress' THEN format('%s of %s validated', 
      vd.validation_count, vd.validation_total)
    ELSE 'Pending'
  END as status_description
FROM validation_detail vd
LEFT JOIN validation_type vt ON vd.validation_type_id = vt.id
LEFT JOIN validation_summary vs ON vd.validation_summary_id = vs.id;

COMMENT ON VIEW validation_detail_with_stats IS 'Enhanced view of validation_detail with computed statistics for dashboard display';

-- Step 8: Verification query
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER;
  v_mismatch INTEGER;
BEGIN
  -- Count total validation_details
  SELECT COUNT(*) INTO v_count FROM validation_detail;
  RAISE NOTICE 'Total validation_detail records: %', v_count;
  
  -- Check for mismatches
  SELECT COUNT(*) INTO v_mismatch
  FROM validation_detail vd
  WHERE vd.validation_count != (
    SELECT COUNT(*) 
    FROM validation_results vr 
    WHERE vr.validation_detail_id = vd.id
  );
  
  IF v_mismatch > 0 THEN
    RAISE WARNING 'Found % validation_detail records with mismatched counts', v_mismatch;
  ELSE
    RAISE NOTICE 'All validation_detail counts are accurate';
  END IF;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Summary of changes:
-- ✅ Added validation_count, validation_total, validation_progress, validation_status columns
-- ✅ Created trigger function to auto-update counts
-- ✅ Created trigger on validation_results table
-- ✅ Backfilled existing data
-- ✅ Created performance indexes
-- ✅ Created helper view for dashboard queries
-- ✅ Verified data accuracy

-- Next steps:
-- 1. Update frontend to use new validation_status and validation_progress fields
-- 2. Remove old num_of_req and completed_count fields (after verification)
-- 3. Update dashboard components to subscribe to validation_detail changes
