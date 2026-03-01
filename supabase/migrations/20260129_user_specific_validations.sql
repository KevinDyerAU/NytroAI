-- ============================================================================
-- Migration: User-Specific Validations
-- ============================================================================
-- Description: Adds user_id column to validation_detail and validation_summary
-- tables to enable user-specific validation visibility. Users will only see
-- their own validations unless they are admins.
--
-- Date: 2026-01-29
-- Version: 1.0.0
-- ============================================================================

-- ============================================================================
-- PART 1: Add user_id column to validation_summary
-- ============================================================================

-- Add user_id column to validation_summary if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'validation_summary' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE validation_summary ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        
        -- Add index for faster lookups
        CREATE INDEX IF NOT EXISTS idx_validation_summary_user_id ON validation_summary(user_id);
        
        -- Add comment for documentation
        COMMENT ON COLUMN validation_summary.user_id IS 'The user who created this validation. NULL for legacy records or system-created validations.';
    END IF;
END $$;

-- ============================================================================
-- PART 2: Add user_id column to validation_detail
-- ============================================================================

-- Add user_id column to validation_detail if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'validation_detail' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE validation_detail ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        
        -- Add index for faster lookups
        CREATE INDEX IF NOT EXISTS idx_validation_detail_user_id ON validation_detail(user_id);
        
        -- Add comment for documentation
        COMMENT ON COLUMN validation_detail.user_id IS 'The user who created this validation. NULL for legacy records or system-created validations.';
    END IF;
END $$;

-- ============================================================================
-- PART 3: Create function to get user's validations
-- ============================================================================

-- Function to get validations for a specific user (or all if admin)
CREATE OR REPLACE FUNCTION get_user_validations(
    p_rto_code TEXT,
    p_user_id UUID,
    p_is_admin BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id BIGINT,
    summary_id BIGINT,
    unit_code TEXT,
    qualification_code TEXT,
    extract_status TEXT,
    validation_status TEXT,
    doc_extracted BOOLEAN,
    req_extracted BOOLEAN,
    num_of_req INTEGER,
    req_total INTEGER,
    completed_count INTEGER,
    validation_count INTEGER,
    validation_progress NUMERIC,
    created_at TIMESTAMPTZ,
    validation_type TEXT,
    error_message TEXT,
    owner_user_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vd.id,
        vd.summary_id,
        vs."unitCode" AS unit_code,
        NULL::TEXT AS qualification_code,
        COALESCE(vd."extractStatus", 'Pending') AS extract_status,
        COALESCE(vd.validation_status, 'Pending') AS validation_status,
        COALESCE(vd."docExtracted", FALSE) AS doc_extracted,
        FALSE AS req_extracted,
        COALESCE(vd.validation_total, vd."numOfReq", vs."reqTotal", 0) AS num_of_req,
        COALESCE(vd.validation_total, vd."numOfReq", vs."reqTotal", 0) AS req_total,
        COALESCE(vd.validation_count, vd.completed_count, 0) AS completed_count,
        COALESCE(vd.validation_count, vd.completed_count, 0) AS validation_count,
        COALESCE(vd.validation_progress, 0) AS validation_progress,
        vd.created_at,
        vt.code AS validation_type,
        NULL::TEXT AS error_message,
        vd.user_id AS owner_user_id
    FROM validation_detail vd
    LEFT JOIN validation_summary vs ON vd.summary_id = vs.id
    LEFT JOIN validation_type vt ON vd."validationType_id" = vt.id
    WHERE 
        -- Filter by RTO code
        vs."rtoCode" = p_rto_code
        -- Filter by user_id unless admin
        AND (
            p_is_admin = TRUE 
            OR vd.user_id = p_user_id 
            OR vd.user_id IS NULL  -- Include legacy records without user_id
        )
    ORDER BY vd.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_validations(TEXT, UUID, BOOLEAN) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_user_validations(TEXT, UUID, BOOLEAN) IS 
'Returns validations filtered by RTO code and user ownership. Admins can see all validations.';

-- ============================================================================
-- PART 4: Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on validation_detail if not already enabled
ALTER TABLE validation_detail ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own validations" ON validation_detail;
DROP POLICY IF EXISTS "Admins can view all validations" ON validation_detail;
DROP POLICY IF EXISTS "Users can insert their own validations" ON validation_detail;
DROP POLICY IF EXISTS "Service role has full access to validation_detail" ON validation_detail;

-- Policy: Users can view their own validations (or legacy ones without user_id)
CREATE POLICY "Users can view their own validations" ON validation_detail
    FOR SELECT
    USING (
        user_id = auth.uid() 
        OR user_id IS NULL
        OR EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- Policy: Users can insert validations with their own user_id
CREATE POLICY "Users can insert their own validations" ON validation_detail
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid() OR user_id IS NULL
    );

-- Policy: Users can update their own validations
CREATE POLICY "Users can update their own validations" ON validation_detail
    FOR UPDATE
    USING (
        user_id = auth.uid() 
        OR user_id IS NULL
        OR EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- Policy: Service role has full access (for backend operations)
CREATE POLICY "Service role has full access to validation_detail" ON validation_detail
    FOR ALL
    USING (auth.role() = 'service_role');

-- Enable RLS on validation_summary if not already enabled
ALTER TABLE validation_summary ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own validation summaries" ON validation_summary;
DROP POLICY IF EXISTS "Users can insert their own validation summaries" ON validation_summary;
DROP POLICY IF EXISTS "Service role has full access to validation_summary" ON validation_summary;

-- Policy: Users can view their own validation summaries
CREATE POLICY "Users can view their own validation summaries" ON validation_summary
    FOR SELECT
    USING (
        user_id = auth.uid() 
        OR user_id IS NULL
        OR EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- Policy: Users can insert validation summaries with their own user_id
CREATE POLICY "Users can insert their own validation summaries" ON validation_summary
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid() OR user_id IS NULL
    );

-- Policy: Service role has full access
CREATE POLICY "Service role has full access to validation_summary" ON validation_summary
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- PART 5: Verification
-- ============================================================================

-- Verify columns were added
DO $$
DECLARE
    v_detail_has_user_id BOOLEAN;
    v_summary_has_user_id BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'validation_detail' AND column_name = 'user_id'
    ) INTO v_detail_has_user_id;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'validation_summary' AND column_name = 'user_id'
    ) INTO v_summary_has_user_id;
    
    RAISE NOTICE 'Migration verification:';
    RAISE NOTICE '  validation_detail.user_id: %', CASE WHEN v_detail_has_user_id THEN 'EXISTS' ELSE 'MISSING' END;
    RAISE NOTICE '  validation_summary.user_id: %', CASE WHEN v_summary_has_user_id THEN 'EXISTS' ELSE 'MISSING' END;
END $$;

-- ============================================================================
-- End of Migration
-- ============================================================================
