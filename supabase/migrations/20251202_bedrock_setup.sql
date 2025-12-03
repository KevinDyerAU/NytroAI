-- ============================================================================
-- Bedrock Migration: Database Setup
-- ============================================================================
-- This migration prepares the database for parallel operation of Gemini and
-- Amazon Bedrock, including pgvector support for RAG.
--
-- Date: 2025-12-02
-- Version: 1.0.0
-- ============================================================================

-- ============================================================================
-- PART 1: Enable pgvector Extension
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- PART 2: Add AI Provider Column to validation_detail
-- ============================================================================

-- Add ai_provider column with default 'gemini'
ALTER TABLE validation_detail 
  ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'gemini' 
  CHECK (ai_provider IN ('gemini', 'bedrock'));

-- Add index for filtering by provider
CREATE INDEX IF NOT EXISTS idx_validation_detail_ai_provider 
  ON validation_detail(ai_provider);

-- Add metadata column for provider-specific data
ALTER TABLE validation_detail 
  ADD COLUMN IF NOT EXISTS ai_metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment
COMMENT ON COLUMN validation_detail.ai_provider IS 'AI provider used for this validation (gemini or bedrock)';
COMMENT ON COLUMN validation_detail.ai_metadata IS 'Provider-specific metadata (e.g., model version, token usage)';

-- ============================================================================
-- PART 3: Create document_chunks Table for RAG
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_chunks (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  validation_detail_id BIGINT NOT NULL REFERENCES validation_detail(id) ON DELETE CASCADE,
  
  -- Chunk content
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Vector embedding (1536 dimensions for Amazon Titan Embeddings v1)
  embedding vector(1536),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one chunk per document and index
  CONSTRAINT unique_document_chunk UNIQUE (document_id, chunk_index)
);

-- Add comments
COMMENT ON TABLE document_chunks IS 'Document chunks with vector embeddings for RAG-based validation';
COMMENT ON COLUMN document_chunks.chunk_text IS 'Text content of the chunk (500-1000 tokens)';
COMMENT ON COLUMN document_chunks.chunk_index IS 'Sequential index of the chunk within the document';
COMMENT ON COLUMN document_chunks.chunk_metadata IS 'Metadata about the chunk (page range, section, etc.)';
COMMENT ON COLUMN document_chunks.embedding IS 'Vector embedding of the chunk text (1536 dimensions)';

-- ============================================================================
-- PART 4: Create Indexes for Performance
-- ============================================================================

-- Index for filtering by document
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id 
  ON document_chunks(document_id);

-- Index for filtering by validation
CREATE INDEX IF NOT EXISTS idx_document_chunks_validation_detail_id 
  ON document_chunks(validation_detail_id);

-- Vector similarity search index (HNSW for fast approximate nearest neighbor)
-- This enables efficient cosine similarity searches
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
  ON document_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- PART 5: Create RPC Function for Vector Similarity Search
-- ============================================================================

CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_validation_detail_id bigint DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  document_id bigint,
  chunk_text text,
  chunk_index integer,
  chunk_metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.chunk_text,
    document_chunks.chunk_index,
    document_chunks.chunk_metadata,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  FROM document_chunks
  WHERE 
    (filter_validation_detail_id IS NULL OR document_chunks.validation_detail_id = filter_validation_detail_id)
    AND 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add comment
COMMENT ON FUNCTION match_document_chunks IS 'Find document chunks similar to a query embedding using cosine similarity';

-- ============================================================================
-- PART 6: Update validation_results Table (if needed)
-- ============================================================================

-- Add ai_provider to metadata if not already tracked
-- This allows us to see which provider generated each validation result
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'validation_results' 
    AND column_name = 'ai_provider'
  ) THEN
    ALTER TABLE validation_results 
      ADD COLUMN ai_provider TEXT DEFAULT 'gemini' 
      CHECK (ai_provider IN ('gemini', 'bedrock'));
    
    CREATE INDEX idx_validation_results_ai_provider 
      ON validation_results(ai_provider);
  END IF;
END $$;

-- ============================================================================
-- PART 7: Create Helper Function to Check if Document is Chunked
-- ============================================================================

CREATE OR REPLACE FUNCTION is_document_chunked(p_document_id bigint)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  chunk_count integer;
BEGIN
  SELECT COUNT(*) INTO chunk_count
  FROM document_chunks
  WHERE document_id = p_document_id;
  
  RETURN chunk_count > 0;
END;
$$;

COMMENT ON FUNCTION is_document_chunked IS 'Check if a document has been chunked and indexed';

-- ============================================================================
-- PART 8: Create Function to Get Chunking Status for Validation
-- ============================================================================

CREATE OR REPLACE FUNCTION get_validation_chunking_status(p_validation_detail_id bigint)
RETURNS TABLE (
  document_id bigint,
  file_name text,
  is_chunked boolean,
  chunk_count integer
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.file_name,
    EXISTS(SELECT 1 FROM document_chunks dc WHERE dc.document_id = d.id) as is_chunked,
    COALESCE((SELECT COUNT(*) FROM document_chunks dc WHERE dc.document_id = d.id), 0)::integer as chunk_count
  FROM documents d
  WHERE d.validation_detail_id = p_validation_detail_id;
END;
$$;

COMMENT ON FUNCTION get_validation_chunking_status IS 'Get the chunking status for all documents in a validation';

-- ============================================================================
-- PART 9: Grant Permissions
-- ============================================================================

-- Grant access to the new table and functions
-- Adjust these based on your actual role names

-- For authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON document_chunks TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE document_chunks_id_seq TO authenticated;
GRANT EXECUTE ON FUNCTION match_document_chunks TO authenticated;
GRANT EXECUTE ON FUNCTION is_document_chunked TO authenticated;
GRANT EXECUTE ON FUNCTION get_validation_chunking_status TO authenticated;

-- For service role (used by Edge Functions)
GRANT SELECT, INSERT, UPDATE, DELETE ON document_chunks TO service_role;
GRANT USAGE, SELECT ON SEQUENCE document_chunks_id_seq TO service_role;
GRANT EXECUTE ON FUNCTION match_document_chunks TO service_role;
GRANT EXECUTE ON FUNCTION is_document_chunked TO service_role;
GRANT EXECUTE ON FUNCTION get_validation_chunking_status TO service_role;

-- ============================================================================
-- PART 10: Add Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on document_chunks
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access chunks for their own validations
CREATE POLICY "Users can access their own document chunks"
  ON document_chunks
  FOR ALL
  USING (
    validation_detail_id IN (
      SELECT vd.id 
      FROM validation_detail vd
      JOIN validation_summary vs ON vd.validation_summary_id = vs.id
      WHERE vs.user_id = auth.uid()
    )
  );

-- Policy: Service role has full access
CREATE POLICY "Service role has full access to document chunks"
  ON document_chunks
  FOR ALL
  TO service_role
  USING (true);

-- ============================================================================
-- PART 11: Create Indexes for RLS Performance
-- ============================================================================

-- Index to speed up RLS policy checks
CREATE INDEX IF NOT EXISTS idx_validation_detail_summary_id 
  ON validation_detail(validation_summary_id);

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verify the migration
DO $$
BEGIN
  RAISE NOTICE 'Bedrock migration completed successfully!';
  RAISE NOTICE 'pgvector extension: %', (SELECT extname FROM pg_extension WHERE extname = 'vector');
  RAISE NOTICE 'document_chunks table: %', (SELECT to_regclass('public.document_chunks'));
  RAISE NOTICE 'match_document_chunks function: %', (SELECT to_regprocedure('public.match_document_chunks'));
END $$;
