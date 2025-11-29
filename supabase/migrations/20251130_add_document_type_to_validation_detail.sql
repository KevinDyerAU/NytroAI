-- ============================================================================
-- Add document_type column to validation_detail table
-- ============================================================================
-- Date: 2025-11-30
-- Description: Adds document_type column to track whether validation is for
--              unit of competency, learner guide, or both
-- ============================================================================

-- Add document_type column
ALTER TABLE validation_detail
ADD COLUMN IF NOT EXISTS document_type TEXT CHECK (document_type IN ('unit', 'learner_guide', 'both'));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_validation_detail_document_type 
  ON validation_detail(document_type) WHERE document_type IS NOT NULL;

-- Add comment
COMMENT ON COLUMN validation_detail.document_type IS 'Type of document being validated: unit, learner_guide, or both';
