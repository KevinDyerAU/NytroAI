-- Reset stuck indexing operations
-- Run this in Supabase SQL Editor to immediately unblock stuck operations

-- 1. Find and reset stuck operations
UPDATE gemini_operations
SET 
  status = 'pending',
  error_message = NULL,
  updated_at = NOW()
WHERE status = 'processing'
AND updated_at < NOW() - INTERVAL '1 minute';

-- 2. Reset any documents stuck in pending
UPDATE documents
SET 
  embedding_status = 'pending',
  updated_at = NOW()
WHERE embedding_status = 'pending'
AND id IN (
  SELECT document_id 
  FROM gemini_operations 
  WHERE status = 'pending'
);

-- 3. Show results
SELECT 
  d.file_name,
  d.embedding_status,
  g.status as gemini_status,
  g.progress_percentage,
  d.extractStatus,
  g.updated_at,
  EXTRACT(EPOCH FROM (NOW() - g.updated_at))/60 as minutes_ago
FROM documents d
LEFT JOIN gemini_operations g ON g.document_id = d.id
WHERE d.embedding_status IN ('pending', 'processing')
   OR g.status IN ('pending', 'processing')
ORDER BY g.updated_at DESC
LIMIT 10;
