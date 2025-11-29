-- ============================================================================
-- Add document_type column to validation_detail table
-- ============================================================================
-- Date: 2025-11-30
-- Description: Adds document_type column to track whether validation is for
--              unit assessment or learner guide documents. This aligns with
--              the new prompt system's 3-key lookup.
-- ============================================================================

-- Add document_type column
ALTER TABLE validation_detail
ADD COLUMN IF NOT EXISTS document_type TEXT CHECK (document_type IN ('unit', 'learner_guide', 'both'));

-- Set default value for existing records (assume 'unit' for backwards compatibility)
UPDATE validation_detail
SET document_type = 'unit'
WHERE document_type IS NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_validation_detail_document_type
ON validation_detail(document_type);

-- Add comment
COMMENT ON COLUMN validation_detail.document_type IS 'Type of document being validated: unit (assessment tools), learner_guide (training materials), or both';

-- Verification
DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'validation_detail' 
        AND column_name = 'document_type'
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE 'SUCCESS: document_type column added to validation_detail table';
    ELSE
        RAISE EXCEPTION 'FAILED: document_type column was not created';
    END IF;
END $$;
