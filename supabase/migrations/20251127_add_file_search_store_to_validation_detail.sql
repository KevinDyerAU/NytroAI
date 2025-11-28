-- Add Gemini File Search Store tracking to validation_detail
-- This allows reusing the same store for all documents in a validation

ALTER TABLE validation_detail
ADD COLUMN IF NOT EXISTS file_search_store_id TEXT,
ADD COLUMN IF NOT EXISTS file_search_store_name TEXT;

COMMENT ON COLUMN validation_detail.file_search_store_id IS 'Gemini File Search Store ID (e.g., fileSearchStores/validation687...)';
COMMENT ON COLUMN validation_detail.file_search_store_name IS 'Gemini File Search Store display name (as returned by API)';
