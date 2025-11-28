# Developer Guide - NytroAI Document Validation

## Quick Start

### Running Locally
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# In another terminal, start Supabase
npx supabase start
```

### Environment Variables
```env
VITE_SUPABASE_URL=https://dfqxmjmggokneiuljkta.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
GEMINI_API_KEY=your_gemini_key (set in Supabase Dashboard)
```

---

## Common Tasks

### Deploy Edge Function
```bash
# Deploy single function
npx supabase functions deploy upload-document

# Deploy all functions
npx supabase functions deploy
```

### View Logs
```bash
# Tail logs for specific function
npx supabase functions logs upload-document --tail

# Tail all function logs
npx supabase functions logs --tail
```

### Test Edge Function Locally
```bash
# Start function locally
npx supabase functions serve upload-document

# In another terminal, test it
curl -X POST http://localhost:54321/functions/v1/upload-document \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

---

## File Upload Flow (Step-by-Step)

### 1. User Selects Files
**Component:** `DocumentUploadAdapterSimplified.tsx`

```typescript
// User selects files via file input or drag-drop
const handleFilesSelected = useCallback(async (files: File[]) => {
  // Create validation record first
  const { data } = await supabase.functions.invoke('create-validation-record', {
    body: {
      rtoCode: selectedRTO.code,
      unitCode: selectedUnit.code,
      unitLink: selectedUnit.Link,
      validationType: 'assessment',
      pineconeNamespace: `${rtoCode}-${unitCode}-${Date.now()}`
    }
  });
  
  setValidationDetailId(data.detailId);
  setSelectedFiles(files); // Triggers upload
}, [selectedRTO, selectedUnit]);
```

### 2. Upload to Supabase Storage
**Service:** `DocumentUploadServiceSimplified.ts`

```typescript
// Uploads PDF to Supabase Storage
const result = await documentUploadService.uploadDocument(
  file,
  rtoCode,
  unitCode,
  'assessment',
  validationDetailId
);

// Returns: { documentId, fileName, storagePath }
```

### 3. Upload to Gemini
**Component:** `DocumentUploadAdapterSimplified.tsx`

```typescript
// After ALL files uploaded to Supabase, upload each to Gemini
for (const doc of uploadedDocuments) {
  const { data, error } = await supabase.functions.invoke('upload-document', {
    body: {
      rtoCode,
      unitCode,
      documentType: 'assessment',
      fileName: doc.fileName,
      storagePath: doc.storagePath,
      validationDetailId,  // Creates per-validation store!
    }
  });
  
  // Gemini uploads happening...
}
```

### 4. Trigger Validation Workflow
**Component:** `DocumentUploadAdapterSimplified.tsx`

```typescript
// After ALL Gemini uploads initiated
await supabase.functions.invoke('trigger-validation-n8n', {
  body: { validationDetailId }
});

// n8n starts polling and will call validation when ready
```

---

## Edge Function Development

### Standard Structure
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  try {
    const requestData = await req.json();
    
    // Validate input
    if (!requestData.requiredField) {
      return createErrorResponse('Missing requiredField', 400);
    }

    // Initialize Supabase client
    const supabase = createSupabaseClient(req);

    // Your logic here
    const result = await doSomething();

    return createSuccessResponse(result);
  } catch (error) {
    console.error('[function-name] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal error',
      500
    );
  }
});
```

### Logging Best Practices
```typescript
// ✅ Good
console.log('[upload-document] Starting upload', { fileName, documentId });
console.log('[upload-document] ✅ Upload complete', { operationName, duration: 5234 });
console.error('[upload-document] ❌ Upload failed:', error);

// ❌ Bad
console.log('upload starting');  // No function name
console.log(fileName);  // No context
```

### Error Handling
```typescript
try {
  // Operation
  const result = await riskyOperation();
  
  if (!result) {
    // Explicit error for client
    return createErrorResponse('Operation returned no result', 404);
  }
  
  return createSuccessResponse(result);
} catch (error) {
  // Log full error for debugging
  console.error('[function-name] Error:', error);
  console.error('[function-name] Stack:', error instanceof Error ? error.stack : 'N/A');
  
  // Return user-friendly message
  return createErrorResponse(
    'Failed to complete operation. Check logs for details.',
    500
  );
}
```

---

## Database Queries

### Fetch Validation Context
```typescript
const { data: validationDetail, error } = await supabase
  .from('validation_detail')
  .select(`
    id,
    summary_id,
    namespace_code,
    validation_type (code),
    validation_summary!inner (
      unitCode,
      unitLink,
      rtoCode
    )
  `)
  .eq('id', validationDetailId)
  .single();
```

### Fetch Documents for Validation
```typescript
const { data: documents, error } = await supabase
  .from('documents')
  .select('id, file_name, storage_path, file_search_store_id, embedding_status')
  .eq('validation_detail_id', validationDetailId)
  .order('created_at', { ascending: true });
```

### Save Validation Results
```typescript
// Use shared function
import { storeValidationResultsV2 } from '../_shared/store-validation-results-v2.ts';

await storeValidationResultsV2(
  supabase,
  validationDetailId,
  validationResponse,
  groundingChunks
);
```

---

## Gemini API

### Create File Search Store
```typescript
import { createDefaultGeminiClient } from '../_shared/gemini.ts';

const gemini = createDefaultGeminiClient();
const storeName = `validation-${validationDetailId}-${unitCode}-${Date.now()}`;
const store = await gemini.createFileSearchStore(storeName);

console.log('Store created:', store.name);
// e.g., "fileSearchStores/validation123tlif0025173268-abc123"
```

### Upload Document to Store
```typescript
// Download from Supabase Storage
const { data: fileData } = await supabase.storage
  .from('documents')
  .download(storagePath);

const fileBytes = new Uint8Array(await fileData.arrayBuffer());

// Upload to Gemini (uses proven multipart/related code)
const operation = await gemini.uploadToFileSearchStore(
  store.name,
  fileName,
  fileBytes,
  {
    'rto-code': rtoCode,
    'unit-code': unitCode.toUpperCase(),
    'document-type': 'assessment',
    'namespace': namespaceCode
  }
);

console.log('Operation started:', operation.name);
```

### Check Operation Status
```typescript
const operation = await gemini.getOperation(operationName);

if (operation.done) {
  console.log('✅ Indexing complete');
} else {
  console.log('⏳ Still indexing...');
}
```

### Call Validation with File Search
```typescript
const response = await gemini.generateContentWithFileSearch(
  prompt,
  [fileSearchStoreName],  // Array of store names
  undefined  // No metadata filter (dedicated store!)
);

// Extract grounding chunks
const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
console.log(`Grounding chunks found: ${groundingChunks.length}`);
```

---

## Testing

### Manual Test: Upload Flow
```bash
# 1. Create validation record
curl -X POST https://dfqxmjmggokneiuljkta.supabase.co/functions/v1/create-validation-record \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "rtoCode": "7148",
    "unitCode": "TLIF0025",
    "unitLink": "https://training.gov.au/training/details/tlif0025/unitdetails",
    "validationType": "assessment",
    "pineconeNamespace": "7148-tlif0025-1732680000000"
  }'

# 2. Upload document (assuming already in Supabase Storage)
curl -X POST https://dfqxmjmggokneiuljkta.supabase.co/functions/v1/upload-document \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "rtoCode": "7148",
    "unitCode": "TLIF0025",
    "documentType": "assessment",
    "fileName": "test.pdf",
    "storagePath": "7148/TLIF0025/1732680000000_test.pdf",
    "validationDetailId": 123
  }'

# 3. Trigger validation
curl -X POST https://dfqxmjmggokneiuljkta.supabase.co/functions/v1/trigger-validation-n8n \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "validationDetailId": 123
  }'
```

### Check Logs
```bash
# Edge function logs
npx supabase functions logs upload-document --tail

# n8n logs
# Check n8n dashboard: Executions tab
```

### Database Checks
```sql
-- Check document upload
SELECT id, file_name, file_search_store_id, embedding_status
FROM documents
WHERE validation_detail_id = 123;

-- Check Gemini operations
SELECT operation_name, status, progress_percentage, error_message
FROM gemini_operations
WHERE document_id = (SELECT id FROM documents WHERE validation_detail_id = 123 LIMIT 1);

-- Check validation results
SELECT COUNT(*) as total_validations
FROM validation_results
WHERE validation_detail_id = 123;
```

---

## Debugging

### Issue: Upload fails
```bash
# Check edge function logs
npx supabase functions logs upload-document --tail

# Look for:
# - [upload-document] Error: ...
# - HTTP error codes
# - Gemini API errors
```

### Issue: 0 grounding chunks
```bash
# Check validate-assessment-v2 logs
npx supabase functions logs validate-assessment-v2 --tail

# Look for:
# - [Validate Assessment] Grounding chunks found: 0
# - [Validate Assessment] ❌ No documents in store
# - Wrong fileSearchStoreName passed
```

### Issue: n8n not triggered
```bash
# Check trigger-validation-n8n logs
npx supabase functions logs trigger-validation-n8n --tail

# Look for:
# - [Trigger Validation N8n] Document missing file_search_store_id
# - [Trigger Validation N8n] No Gemini operation found
# - n8n webhook call failed
```

### Database Inspection
```sql
-- Full validation trace
SELECT 
  vd.id as validation_detail_id,
  vd.status,
  d.id as document_id,
  d.file_name,
  d.file_search_store_id,
  d.embedding_status,
  go.operation_name,
  go.status as operation_status,
  go.progress_percentage
FROM validation_detail vd
LEFT JOIN documents d ON d.validation_detail_id = vd.id
LEFT JOIN gemini_operations go ON go.document_id = d.id
WHERE vd.id = 123;
```

---

## Code Style Guide

### TypeScript
```typescript
// ✅ Good
interface UploadRequest {
  rtoCode: string;
  unitCode: string;
  fileName: string;
  storagePath: string;
  validationDetailId?: number;
}

async function uploadDocument(request: UploadRequest): Promise<UploadResult> {
  // ...
}

// ❌ Bad
function uploadDocument(rtoCode, unitCode, fileName, storagePath, validationDetailId) {
  // No types
}
```

### Edge Functions
```typescript
// ✅ Good
serve(async (req) => {
  const startTime = Date.now();
  console.log('[function-name] START', new Date().toISOString());
  
  try {
    // Logic
    const duration = Date.now() - startTime;
    console.log('[function-name] SUCCESS', { duration });
    return createSuccessResponse(result);
  } catch (error) {
    console.error('[function-name] ERROR:', error);
    return createErrorResponse(error.message, 500);
  }
});

// ❌ Bad
serve(async (req) => {
  // No logging
  // No error handling
  return new Response(JSON.stringify(result));
});
```

---

## Deployment Checklist

Before deploying to production:

- [ ] All edge functions tested locally
- [ ] Environment variables set in Supabase Dashboard
- [ ] Database migrations run
- [ ] n8n workflow updated and tested
- [ ] Error handling in place
- [ ] Logging statements added
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Tests passing

---

## Useful Commands

```bash
# Deploy specific function
npx supabase functions deploy upload-document

# View function logs (last 100 lines)
npx supabase functions logs upload-document --limit 100

# Tail function logs in real-time
npx supabase functions logs upload-document --tail

# Run database migration
npx supabase db push

# Generate TypeScript types from database
npx supabase gen types typescript --local > src/types/database.types.ts

# Start Supabase locally
npx supabase start

# Stop Supabase locally
npx supabase stop
```

---

## Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Gemini API Docs](https://ai.google.dev/docs)
- [n8n Documentation](https://docs.n8n.io/)
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [PER_VALIDATION_STORES.md](PER_VALIDATION_STORES.md) - Store strategy

---

*Last Updated: November 27, 2025*
