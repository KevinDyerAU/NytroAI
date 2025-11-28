# NytroAI Architecture

> **Per-Validation Stores** - Isolated, reliable document validation with proven edge function upload pipeline.

## Overview

NytroAI validates training assessments against Australian Training Package requirements using:
- **Gemini File Search** for semantic document grounding
- **Per-validation dedicated stores** for isolation and reliability
- **Edge functions** for proven upload and indexing
- **n8n orchestration** for polling and validation workflow

## Architecture Principles

### ✅ What Works (Keep These)
1. **Edge function uploads** - Proven multipart/related format
2. **Supabase Storage** - Fast, reliable file storage
3. **Database-driven state** - Single source of truth
4. **n8n for orchestration** - Simple polling and status updates

### ❌ What Doesn't Work (Avoid These)
1. **n8n binary uploads** - Complex, error-prone
2. **Shared File Search stores** - Metadata filtering unreliable
3. **Client-side Gemini calls** - CORS and auth issues
4. **Multiple edge function handoffs** - Timing and polling nightmares

---

## Complete Validation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  USER UPLOADS DOCUMENT                                          │
│  React Component: DocumentUploadAdapterSimplified               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: CREATE VALIDATION RECORD                               │
│  Edge Function: create-validation-record                        │
│  • Creates validation_summary                                   │
│  • Creates validation_detail                                    │
│  • Generates unique namespace: rtoCode-unitCode-timestamp       │
│  • Returns: validationDetailId                                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: UPLOAD TO SUPABASE STORAGE                            │
│  Service: DocumentUploadServiceSimplified                       │
│  • Uploads PDF to Supabase Storage bucket                       │
│  • Path: {rtoCode}/{unitCode}/{timestamp}_{fileName}           │
│  • Returns: documentId, fileName, storagePath                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: UPLOAD TO GEMINI FILE SEARCH                          │
│  Edge Function: upload-document                                 │
│  • Creates dedicated File Search store                          │
│    Format: validation-{validationDetailId}-{unitCode}-{ts}      │
│  • Downloads file from Supabase Storage                         │
│  • Uploads to Gemini with metadata (proven multipart code)      │
│  • Saves gemini_operations record (for polling)                 │
│  • Updates documents.file_search_store_id                       │
│  • Returns: operationName, fileSearchStoreName                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: TRIGGER N8N POLLING WORKFLOW                          │
│  Edge Function: trigger-validation-n8n                          │
│  • Fetches document details (file_search_store_id)              │
│  • Fetches operation_name from gemini_operations                │
│  • Fetches unit requirements from database                      │
│  • Calls n8n webhook with all context                           │
│  • Returns: n8n execution started                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: N8N POLLS GEMINI INDEXING STATUS                      │
│  n8n Workflow: Poll-and-Validate                                │
│  • Polls Gemini operation status (5s intervals)                 │
│  • Updates validation_detail.status = "indexing"                │
│  • Waits for operation.done = true                              │
│  • Updates documents.embedding_status = "completed"             │
│  • Proceeds to validation when ready                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: VALIDATE ASSESSMENT                                    │
│  Edge Function: validate-assessment-v2                          │
│  • Receives fileSearchStoreName (no filter needed!)             │
│  • Constructs validation prompt with requirements JSON          │
│  • Calls Gemini generateContent with File Search                │
│  • NO metadata filtering (dedicated store = all docs relevant)  │
│  • Extracts grounding chunks (citations with page numbers)      │
│  • Parses JSON response (requirement validations)               │
│  • Returns: ValidationResponseV2 with citations                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 7: SAVE VALIDATION RESULTS                               │
│  Shared Function: storeValidationResultsV2                      │
│  • Saves to validation_results table                            │
│  • Includes citations with documentName and pageNumbers         │
│  • Updates validation_detail.status = "validated"               │
│  • Updates validation_summary.coveragePercentage                │
│  • Dashboard polls and shows results                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Component Documentation

### Frontend Components

#### `DocumentUploadAdapterSimplified.tsx`
**Purpose:** Orchestrates the complete upload and validation flow

**Key Responsibilities:**
- Creates validation record (`create-validation-record`)
- Uploads files to Supabase Storage (`DocumentUploadServiceSimplified`)
- Calls `upload-document` edge function for each file
- Calls `trigger-validation-n8n` after all uploads complete
- Displays progress and error messages

**State Management:**
```typescript
const [validationDetailId, setValidationDetailId] = useState<number>();
const [uploadedDocuments, setUploadedDocuments] = useState<Array<{
  documentId: number;
  fileName: string;
  storagePath: string;
}>>([]);
const [geminiUploadCount, setGeminiUploadCount] = useState(0);
```

#### `DocumentUploadServiceSimplified.ts`
**Purpose:** Handles file upload to Supabase Storage

**Key Method:**
```typescript
async uploadDocument(
  file: File,
  rtoCode: string,
  unitCode: string,
  documentType: string,
  validationDetailId?: number
): Promise<UploadResult>
```

**Returns:**
- `documentId`: Database record ID
- `fileName`: Original file name
- `storagePath`: Supabase Storage path

---

### Edge Functions

#### `create-validation-record`
**Purpose:** Creates validation_summary and validation_detail records

**Input:**
```typescript
{
  rtoCode: string;
  unitCode: string;
  unitLink: string;  // Required for requirements fetching
  validationType: string;
  pineconeNamespace: string;  // Format: {rtoCode}-{unitCode}-{timestamp}
}
```

**Output:**
```typescript
{
  success: true;
  detailId: number;  // validation_detail.id
  summaryId: number; // validation_summary.id
}
```

#### `upload-document`
**Purpose:** Creates Gemini File Search store and uploads document

**Input:**
```typescript
{
  rtoCode: string;
  unitCode: string;
  documentType: string;
  fileName: string;
  storagePath: string;  // Supabase Storage path
  validationDetailId: number;  // Required for per-validation store
}
```

**Logic:**
1. Creates dedicated File Search store:
   ```typescript
   const storeName = `validation-${validationDetailId}-${unitCode}-${Date.now()}`;
   const store = await gemini.createFileSearchStore(storeName);
   ```

2. Downloads file from Supabase Storage
3. Uploads to Gemini using proven multipart/related format
4. Saves `gemini_operations` record for polling
5. Updates `documents.file_search_store_id`

**Output:**
```typescript
{
  success: true;
  documentId: number;
  operationName: string;  // e.g., "fileSearchStores/.../operations/abc123"
  fileSearchStore: string; // e.g., "fileSearchStores/validation-123-..."
}
```

#### `trigger-validation-n8n`
**Purpose:** Triggers n8n polling workflow after all uploads complete

**Input:**
```typescript
{
  validationDetailId: number;
}
```

**Logic:**
1. Fetches documents for validation
2. Verifies `file_search_store_id` exists
3. Fetches `operation_name` from `gemini_operations` table
4. Fetches unit requirements from database
5. Calls n8n webhook with complete context

**Output:**
```typescript
{
  success: true;
  message: "Validation triggered via n8n";
  result: {
    validationDetailId: number;
    status: string;
    validationsCount: number;
    citations: { count: number };
  }
}
```

**n8n Payload:**
```typescript
{
  validationDetailId: number;
  documentId: number;
  fileName: string;
  operationName: string;  // For polling
  fileSearchStoreName: string;  // For validation
  validationType: string;
  unitCode: string;
  unitLink: string;
  rtoCode: string;
  namespaceCode: string;
  requirements: Requirement[];  // Full requirements array
  requirementsCount: number;
}
```

#### `validate-assessment-v2`
**Purpose:** Performs AI validation using Gemini File Search

**Input:**
```typescript
{
  documentId: number;
  unitCode: string;
  unitLink?: string;
  validationType: string;
  validationDetailId: number;
  fileSearchStoreName: string;  // Required! Resource name of File Search store
  customPrompt?: string;
}
```

**Key Features:**
- ✅ **No metadata filtering** (dedicated store = all documents relevant)
- ✅ **Direct file search** using `fileSearchStoreName`
- ✅ **Grounding chunks** extracted automatically
- ✅ **Citations** with document names and page numbers

**Logic:**
1. Fetches unit requirements from database
2. Constructs validation prompt with requirements JSON
3. Calls Gemini `generateContent` with File Search:
   ```typescript
   const response = await gemini.generateContentWithFileSearch(
     prompt,
     [fileSearchStoreName],
     undefined  // No metadata filter!
   );
   ```
4. Extracts grounding chunks from response
5. Parses JSON validation response
6. Merges citations into validations
7. Saves results via `storeValidationResultsV2`

**Output:**
```typescript
{
  success: true;
  validationDetailId: number;
  validationsCount: number;
  citationsCount: number;
  groundingChunksCount: number;
}
```

#### `check-operation-status`
**Purpose:** Polls Gemini operation status and updates database

**Input:**
```typescript
{
  operationId?: number;  // Database ID
  operationName?: string;  // Gemini operation name
}
```

**Logic:**
1. Fetches operation record from database
2. Checks if already completed (returns cached status)
3. Calls Gemini API to check current status
4. Updates `gemini_operations` table
5. Updates `documents.embedding_status` when done
6. Updates `validation_detail.docExtracted` when done

**Output:**
```typescript
{
  success: true;
  operation: {
    id: number;
    name: string;
    status: "processing" | "completed" | "failed" | "timeout";
    progress: number;  // 0-100
    documentId: number;
    elapsedTime: number;
    completedAt?: string;
    error?: string;
  }
}
```

---

### n8n Workflow

#### Poll-and-Validate
**Webhook URL:** `https://n8n-gtoa.onrender.com/webhook/poll-and-validate`

**Node Sequence:**

1. **Webhook Trigger**
   - Receives validation context from `trigger-validation-n8n`

2. **Check Operation Status** (HTTP Request Loop)
   - Method: POST
   - URL: `https://dfqxmjmggokneiuljkta.supabase.co/functions/v1/check-operation-status`
   - Body: `{ "operationName": "{{ $json.operationName }}" }`
   - Repeats every 5 seconds

3. **Is Operation Done?** (IF Node)
   - Condition: `{{ $json.operation.status === 'completed' }}`
   - FALSE: Wait 5s, loop back to Check Operation Status
   - TRUE: Continue to validation

4. **Call validate-assessment-v2** (HTTP Request)
   - Method: POST
   - URL: `https://dfqxmjmggokneiuljkta.supabase.co/functions/v1/validate-assessment-v2`
   - Body:
     ```json
     {
       "validationDetailId": "={{ $node['Webhook Trigger'].json.body.validationDetailId }}",
       "documentId": "={{ $json.operation.documentId }}",
       "unitCode": "={{ $node['Webhook Trigger'].json.body.unitCode }}",
       "validationType": "={{ $node['Webhook Trigger'].json.body.validationType }}",
       "fileSearchStoreName": "={{ $node['Webhook Trigger'].json.body.fileSearchStoreName }}"
     }
     ```

5. **Update Validation Status** (optional)
   - Updates validation_detail status
   - Sends notifications if configured

---

### Database Schema

#### `documents`
**Key Fields:**
- `id`: Primary key
- `file_name`: Original filename
- `storage_path`: Supabase Storage path
- `file_search_store_id`: Gemini File Search store resource name
- `embedding_status`: `pending` | `processing` | `completed` | `failed`
- `validation_detail_id`: Links to validation

#### `gemini_operations`
**Key Fields:**
- `id`: Primary key
- `operation_name`: Gemini operation resource name
- `document_id`: Links to document
- `validation_detail_id`: Links to validation
- `status`: `processing` | `completed` | `failed` | `timeout`
- `progress_percentage`: 0-100
- `started_at`: Timestamp
- `completed_at`: Timestamp
- `error_message`: Error details if failed

#### `validation_detail`
**Key Fields:**
- `id`: Primary key
- `summary_id`: Links to validation_summary
- `namespace_code`: Document isolation namespace
- `validation_type_id`: Type of validation
- `status`: `pending` | `indexing` | `validating` | `validated` | `failed`
- `docExtracted`: Boolean, true when indexing complete

#### `validation_results`
**Key Fields:**
- `id`: Primary key
- `validation_detail_id`: Links to validation
- `requirement_id`: Links to requirement
- `status`: `Met` | `PartiallyMet` | `NotMet`
- `evidence`: Text evidence from document
- `gaps`: Identified gaps
- `recommendations`: Improvement suggestions
- `citations`: JSON array with `{ documentName, pageNumbers }`

---

## Data Flow Diagrams

### Per-Validation Store Creation
```
validationDetailId: 123
unitCode: TLIF0025
timestamp: 1732680000000
              ↓
Store Name: validation-123-tlif0025-1732680000000
              ↓
Gemini API: createFileSearchStore()
              ↓
Resource Name: fileSearchStores/validation123tlif0025173268-abc123def456
              ↓
Saved to: documents.file_search_store_id
```

### Upload and Indexing Flow
```
[React] Upload PDF → [Supabase Storage]
                              ↓
[React] Call upload-document edge function
                              ↓
[Edge Function] Create File Search store
                              ↓
[Edge Function] Upload to Gemini (multipart/related)
                              ↓
[Gemini] Returns operation name
                              ↓
[Edge Function] Save gemini_operations record
                              ↓
[React] Call trigger-validation-n8n
                              ↓
[n8n] Poll operation status every 5s
                              ↓
[Gemini] operation.done = true
                              ↓
[n8n] Call validate-assessment-v2
                              ↓
[Edge Function] Generate validation with File Search
                              ↓
[Edge Function] Extract grounding chunks
                              ↓
[Edge Function] Save results to database
                              ↓
[Dashboard] Display results
```

---

## Performance Metrics

| Operation | Target | Actual |
|-----------|--------|--------|
| Upload to Storage | <2s | ~1s |
| Create File Search Store | <3s | ~2s |
| Upload to Gemini | <10s | ~5-8s |
| Indexing Complete | <60s | ~30-45s |
| Validation Call | <30s | ~15-25s |
| **Total Time** | <2 min | ~1-1.5 min |

---

## Error Handling

### Upload Failures
- **Storage upload fails**: Retry up to 3 times
- **Edge function fails**: Show error toast, allow retry
- **Store creation fails**: Log error, return 500

### Indexing Failures
- **Operation timeout**: After 120s, mark as timeout
- **Gemini API error**: Save error message to `gemini_operations.error_message`
- **Network failure**: n8n retries polling automatically

### Validation Failures
- **No grounding chunks**: Returns error 404, suggests waiting for indexing
- **Parsing error**: Logs JSON parse error, returns partial results if possible
- **Database save error**: Rolls back transaction, returns 500

---

## Monitoring and Logging

### Key Metrics to Track
1. **Upload Success Rate**: `(successful uploads / total attempts) * 100`
2. **Indexing Success Rate**: `(completed operations / total operations) * 100`
3. **Grounding Chunks Found**: Average per validation
4. **Validation Time**: P50, P95, P99
5. **Error Rate**: By component

### Log Aggregation
All edge functions use structured logging:
```
[Function Name] Log Level: Message
Context: { key: value }
```

**Example:**
```
[upload-document] INFO: Starting upload
Context: { fileName: "AT1.pdf", rtoCode: "7148", validationDetailId: 123 }

[upload-document] SUCCESS: Upload complete
Context: { operationName: "fileSearchStores/.../operations/abc123", duration: 5234 }
```

---

## Troubleshooting Guide

### Issue: 0 Grounding Chunks

**Symptoms:**
- `validate-assessment-v2` returns 0 grounding chunks
- Validation response says "No documents provided"

**Causes:**
1. Documents not fully indexed yet
2. Wrong `fileSearchStoreName` passed
3. File Search store empty or deleted

**Solutions:**
1. Wait 30-60 seconds after upload
2. Check `documents.file_search_store_id` matches what was passed
3. Verify store exists: `gemini.listFileSearchStores()`

### Issue: Edge Function Timeout

**Symptoms:**
- Edge function returns 504 Gateway Timeout
- Validation stuck in "indexing" status

**Causes:**
1. Gemini API slow response
2. Large PDF taking long to process
3. Network issues

**Solutions:**
1. Increase edge function timeout (default 60s → 120s)
2. Split large PDFs into smaller files
3. Implement retry logic in n8n

### Issue: Validation Not Triggered

**Symptoms:**
- Documents uploaded successfully
- Status stuck at "indexing"
- No n8n execution started

**Causes:**
1. `trigger-validation-n8n` not called
2. `validationDetailId` missing or incorrect
3. n8n webhook URL incorrect

**Solutions:**
1. Check React component calls `trigger-validation-n8n` after uploads
2. Verify `validationDetailId` is set before upload
3. Test n8n webhook manually with cURL

---

## Security Considerations

### API Keys
- **Gemini API Key**: Stored in Supabase environment variables
- **Supabase Keys**: Anon key for client, service role key for edge functions
- **n8n Webhook**: No authentication (internal network only)

### Access Control
- **Row Level Security (RLS)**: Enabled on all user-facing tables
- **Edge Functions**: Validate user permissions before operations
- **File Upload**: Restricted to authenticated users only

### Data Privacy
- **Document Storage**: Files stored in Supabase Storage with RLS
- **Validation Results**: Only accessible to document owner
- **File Search Stores**: Isolated per validation, no cross-contamination

---

## Deployment Checklist

### Edge Functions
- [ ] Deploy `create-validation-record`
- [ ] Deploy `upload-document`
- [ ] Deploy `trigger-validation-n8n`
- [ ] Deploy `validate-assessment-v2`
- [ ] Deploy `check-operation-status`

### Environment Variables
- [ ] `GEMINI_API_KEY` set in Supabase
- [ ] `N8N_WEBHOOK_URL` configured
- [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set

### Database Migrations
- [ ] `gemini_operations` table exists
- [ ] `documents.file_search_store_id` column added
- [ ] Indexes created on frequently queried columns

### n8n Workflow
- [ ] Import workflow JSON
- [ ] Configure credentials (Supabase, Gemini)
- [ ] Test webhook endpoint
- [ ] Enable workflow

### Frontend Build
- [ ] Update `DocumentUploadAdapterSimplified.tsx`
- [ ] Update `DocumentUploadServiceSimplified.ts`
- [ ] Test upload flow end-to-end
- [ ] Deploy to production

---

## Future Improvements

### Performance
- [ ] Batch upload multiple files in parallel
- [ ] Pre-create File Search stores during validation creation
- [ ] Cache requirements in Redis for faster lookups

### Features
- [ ] Support for multiple document types per validation
- [ ] Real-time progress updates via WebSockets
- [ ] Validation report PDF export

### Reliability
- [ ] Automatic retry on transient failures
- [ ] Dead letter queue for failed operations
- [ ] Monitoring dashboard for system health

---

## Glossary

**File Search Store**: Gemini's RAG index containing uploaded documents
**Grounding Chunks**: Relevant document excerpts returned by Gemini
**Validation Detail**: Individual validation instance (e.g., Knowledge Evidence for TLIF0025)
**Operation**: Gemini's async upload/indexing job
**Namespace**: Unique identifier for document isolation (format: `{rtoCode}-{unitCode}-{timestamp}`)
**Per-Validation Store**: Dedicated File Search store created for each validation
**Edge Function**: Serverless function running on Supabase
**n8n**: Workflow automation tool for orchestration

---

## Support

For issues or questions:
1. Check logs in Supabase Dashboard → Functions → Logs
2. Check n8n execution history
3. Review this documentation
4. Contact development team

---

*Last Updated: November 27, 2025*

- [README.md](README.md) - User guide
- [SIMPLIFIED_UPLOAD_FLOW.md](SIMPLIFIED_UPLOAD_FLOW.md) - Detailed flow
- [docs/FAQ.md](docs/FAQ.md) - Common questions
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - Problem solving
