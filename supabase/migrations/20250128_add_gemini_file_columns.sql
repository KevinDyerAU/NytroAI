-- Migration: Add Gemini File API support to documents table
-- Date: 2025-01-28
-- Purpose: Enable direct Gemini File API integration, eliminating Unstructured.io dependency

-- Add Gemini File API columns to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS gemini_file_uri TEXT,
ADD COLUMN IF NOT EXISTS gemini_file_name TEXT,
ADD COLUMN IF NOT EXISTS gemini_upload_timestamp TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS gemini_expiry_timestamp TIMESTAMPTZ;

-- Add index for quick lookup by Gemini file URI
CREATE INDEX IF NOT EXISTS idx_documents_gemini_uri ON documents(gemini_file_uri);

-- Add index for expiry monitoring
CREATE INDEX IF NOT EXISTS idx_documents_gemini_expiry ON documents(gemini_expiry_timestamp) 
WHERE gemini_expiry_timestamp IS NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN documents.gemini_file_uri IS 'Gemini File API URI (e.g., files/abc123). Valid for 48 hours from upload.';
COMMENT ON COLUMN documents.gemini_file_name IS 'Display name used in Gemini File API';
COMMENT ON COLUMN documents.gemini_upload_timestamp IS 'Timestamp when file was uploaded to Gemini';
COMMENT ON COLUMN documents.gemini_expiry_timestamp IS 'Timestamp when Gemini file will expire (48 hours from upload)';

-- Optional: Create view for expired files that need re-upload
CREATE OR REPLACE VIEW documents_gemini_expired AS
SELECT 
  d.id,
  d.validation_detail_id,
  d.file_name,
  d.storage_path,
  d.gemini_file_uri,
  d.gemini_expiry_timestamp,
  vd.status as validation_status
FROM documents d
JOIN validation_detail vd ON vd.id = d.validation_detail_id
WHERE d.gemini_expiry_timestamp < NOW()
  AND d.gemini_file_uri IS NOT NULL
  AND vd.status != 'completed';

COMMENT ON VIEW documents_gemini_expired IS 'Documents with expired Gemini files that may need re-upload for incomplete validations';

-- Optional: Function to check if Gemini file is expired
CREATE OR REPLACE FUNCTION is_gemini_file_expired(document_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  expiry_time TIMESTAMPTZ;
BEGIN
  SELECT gemini_expiry_timestamp INTO expiry_time
  FROM documents
  WHERE id = document_id;
  
  IF expiry_time IS NULL THEN
    RETURN TRUE; -- No Gemini file uploaded
  END IF;
  
  RETURN expiry_time < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_gemini_file_expired IS 'Check if a document''s Gemini file has expired (returns true if expired or no file)';

-- Optional: Update embedding_status to 'completed' when Gemini file uploaded
-- This maintains compatibility with existing code that checks embedding_status
CREATE OR REPLACE FUNCTION update_embedding_status_on_gemini_upload()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.gemini_file_uri IS NOT NULL AND OLD.gemini_file_uri IS NULL THEN
    NEW.embedding_status = 'completed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_embedding_status_on_gemini_upload
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_embedding_status_on_gemini_upload();

COMMENT ON TRIGGER trigger_update_embedding_status_on_gemini_upload ON documents IS 'Automatically set embedding_status to completed when Gemini file is uploaded';
