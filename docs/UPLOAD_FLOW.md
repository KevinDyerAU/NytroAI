# Document Upload Flow (Simplified & Fast)

## Overview

The new upload flow is designed to be **fast and non-blocking**, providing instant feedback to users while processing happens in the background.

## Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. Upload file to Storage (fast - seconds)
       ▼
┌─────────────────────┐
│ Supabase Storage    │
│ documents/          │
└──────┬──────────────┘
       │
       │ 2. Create document record (instant)
       ▼
┌──────────────────────────┐
│ create-document-record   │
│ Edge Function            │
│ - validation_detail      │
│ - documents (pending)    │
│ - gemini_operations      │
└──────┬───────────────────┘
       │
       │ ✓ Returns immediately
       │
       ▼
┌────────────────────────┐
│ Background Processor   │
│ (every 15 seconds)     │
│                        │
│ process-pending-       │
│ indexing edge function │
└──────┬─────────────────┘
       │
       │ 3. Process pending operations
       ▼
┌──────────────────────────┐
│ Gemini File Search       │
│ - Upload document        │
│ - Index & embed          │
│ - Wait for completion    │
└──────┬───────────────────┘
       │
       │ 4. Trigger validation
       ▼
┌──────────────────────────┐
│ validate-assessment      │
│ Edge Function            │
└──────────────────────────┘
```

## Step-by-Step Flow

### 1. User Uploads Files (Client-Side)

**Component**: `DocumentUploadServiceSimplified.ts`

```typescript
// 1. Upload to Supabase Storage (fast)
const storagePath = await uploadToStorage(file, rtoCode, unitCode);

// 2. Create document record (instant, non-blocking)
const documentId = await triggerIndexingBackground(
  fileName,
  storagePath,
  rtoCode,
  unitCode,
  documentType,
  validationDetailId
);

// User sees "Upload complete" immediately
```

**Timeline**: 1-3 seconds

**User Experience**:
- File selected → "Ready to upload"
- User clicks "Upload" → Progress bar
- File uploaded to storage → "Upload complete - processing in background"
- User can continue working

### 2. Create Document Record (Edge Function)

**Function**: `create-document-record`

**What it does**:
1. Creates/updates `validation_detail` record
2. Creates `documents` record with `embedding_status = 'pending'`
3. Creates `gemini_operations` record with `status = 'pending'`
4. Returns immediately (no waiting)

**Timeline**: < 500ms

**Database Changes**:
```sql
-- validation_detail
INSERT INTO validation_detail (rto_id, unit_code, validation_status)
VALUES (57, 'TLIF0025', 'pending');

-- documents
INSERT INTO documents (
  rto_id, 
  unit_code, 
  file_name, 
  storage_path, 
  embedding_status,
  validation_detail_id
) VALUES (
  57, 
  'TLIF0025', 
  'TLIF0025_AT1.pdf', 
  '57/TLIF0025/1763942920799_TLIF0025_AT1.pdf',
  'pending',
  123
);

-- gemini_operations
INSERT INTO gemini_operations (
  document_id,
  operation_type,
  status,
  metadata
) VALUES (
  456,
  'document_embedding',
  'pending',
  {...}
);
```

### 3. Background Processing (Every 15 Seconds)

**Function**: `process-pending-indexing`

**Triggered by**: Client-side hook (`useIndexingProcessor`)

**What it does**:
1. Query for pending gemini_operations (max 5 at a time)
2. For each operation:
   - Download file from storage
   - Upload to Gemini File Search
   - Wait for indexing to complete (up to 60 seconds)
   - Update statuses
   - Trigger validation

**Timeline**: 10-60 seconds per document (depending on size)

**Status Updates**:
```
pending → processing → completed/failed
```

### 4. Validation Triggered Automatically

**Function**: `validate-assessment`

**When**: After indexing completes successfully

**What it does**:
- Validates document against unit requirements
- Creates validation results
- Updates validation_detail status

## Database Schema

### `validation_detail`
```sql
id                  SERIAL PRIMARY KEY
rto_id              INTEGER
unit_code           VARCHAR
validation_type     VARCHAR ('assessment')
validation_status   VARCHAR ('pending', 'processing', 'completed', 'failed')
created_at          TIMESTAMP
```

### `documents`
```sql
id                      SERIAL PRIMARY KEY
rto_id                  INTEGER
unit_code               VARCHAR
file_name               VARCHAR
storage_path            VARCHAR
embedding_status        VARCHAR ('pending', 'processing', 'completed', 'failed')
validation_detail_id    INTEGER (FK)
file_search_store_id    VARCHAR
file_search_document_id VARCHAR
created_at              TIMESTAMP
```

### `gemini_operations`
```sql
id                  SERIAL PRIMARY KEY
document_id         INTEGER (FK)
operation_type      VARCHAR ('document_embedding')
operation_name      VARCHAR (Gemini operation ID)
status              VARCHAR ('pending', 'processing', 'completed', 'failed')
progress_percentage INTEGER
error_message       TEXT
metadata            JSONB
created_at          TIMESTAMP
```

## User Experience

### Upload Screen

**Before Upload**:
```
┌─────────────────────────────────────┐
│  TLIF0025 AT2.pdf                  │
│  Ready to upload          📄 Remove │
└─────────────────────────────────────┘

        [Upload 3 Files]
```

**During Upload**:
```
┌─────────────────────────────────────┐
│  TLIF0025 AT2.pdf                  │
│  Uploading file...       ⏳         │
│  ████████░░░░░░░░ 45%              │
└─────────────────────────────────────┘
```

**After Upload**:
```
┌─────────────────────────────────────┐
│  TLIF0025 AT2.pdf                  │
│  Upload complete         ✅         │
└─────────────────────────────────────┘

✓ Files uploaded successfully!
  Indexing and validation are running in 
  the background. Check the Dashboard 
  for status updates.
```

### Dashboard - Validation Progress

```
Recent Validations

┌──────────────────────────────────────┐
│ TLIF0025 - Assessment Validation     │
│ Status: Processing                   │
│ Progress: 1/3 documents indexed      │
│ Started: 2 minutes ago               │
└──────────────────────────────────────┘
```

## Error Handling

### Upload Fails
- Error shown immediately
- User can retry
- No DB records created

### Indexing Fails
- Document status: `failed`
- Operation status: `failed`
- Error message stored in `gemini_operations.error_message`
- User can retry from Dashboard

### Validation Fails
- Validation status: `failed`
- User notified via Dashboard
- Can view error details

## Monitoring & Debugging

### Check Pending Operations
```sql
SELECT 
  o.id,
  o.status,
  o.created_at,
  d.file_name,
  d.embedding_status
FROM gemini_operations o
JOIN documents d ON d.id = o.document_id
WHERE o.status = 'pending'
ORDER BY o.created_at DESC;
```

### Check Failed Operations
```sql
SELECT 
  o.id,
  o.error_message,
  d.file_name,
  o.updated_at
FROM gemini_operations o
JOIN documents d ON d.id = o.document_id
WHERE o.status = 'failed'
ORDER BY o.updated_at DESC;
```

### Manual Retry
```sql
-- Reset failed operation to pending
UPDATE gemini_operations
SET status = 'pending', error_message = NULL
WHERE id = 123;

UPDATE documents
SET embedding_status = 'pending'
WHERE id = 456;
```

## Performance Metrics

| Stage | Duration | User Impact |
|-------|----------|-------------|
| Storage upload | 1-3s | User waits |
| Create records | < 500ms | User waits |
| **User sees "Complete"** | **2-4s** | ✅ Can continue |
| Gemini indexing | 10-60s | Background |
| Validation | 5-30s | Background |
| **Total time** | **17-94s** | Mostly background |

## Benefits

✅ **Fast user experience**: Users wait < 5 seconds
✅ **Non-blocking**: Users can continue working
✅ **Scalable**: Background processor handles load
✅ **Resilient**: Failed operations can be retried
✅ **Observable**: Clear status tracking in DB
✅ **Simple**: Clear separation of concerns

## Future Improvements

1. **Supabase Cron**: Replace client polling with server-side cron
2. **Batch processing**: Process multiple files in parallel
3. **Priority queue**: Process urgent files first
4. **Webhooks**: Push notifications when complete
5. **Retry logic**: Automatic retry with exponential backoff
