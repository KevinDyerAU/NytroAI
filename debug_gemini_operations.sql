-- Debug: Check gemini_operations for these documents
SELECT 
  go.id,
  go.operation_name,
  go.status,
  go.document_id,
  go.error_message,
  go.created_at,
  d.file_name,
  d.embedding_status
FROM gemini_operations go
LEFT JOIN documents d ON d.id = go.document_id
WHERE d.file_name IN ('TLIF0025_AT1.pdf', 'AT3.pdf', 'TLIF0025_AT2.pdf')
ORDER BY go.created_at DESC;

-- Check if operations exist at all
SELECT COUNT(*) as total_pending_operations
FROM gemini_operations
WHERE status = 'pending';

-- Check if documents have operations
SELECT 
  d.id,
  d.file_name,
  d.embedding_status,
  COUNT(go.id) as operation_count
FROM documents d
LEFT JOIN gemini_operations go ON go.document_id = d.id
WHERE d.file_name IN ('TLIF0025_AT1.pdf', 'AT3.pdf', 'TLIF0025_AT2.pdf')
GROUP BY d.id, d.file_name, d.embedding_status;
