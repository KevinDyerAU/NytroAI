# n8n Workflow: Multi-File Upload & Operation Polling

## Overview

When uploading multiple files for a single validation, each file creates a separate Gemini operation that must be polled independently. The n8n workflow must wait for ALL operations to complete before triggering validation.

## Critical Bug: Single Operation Polling

### The Problem

**Original Implementation (BROKEN):**
```typescript
// trigger-validation-n8n edge function (OLD)
const { data: geminiOp } = await supabase
  .from('gemini_operations')
  .select('operation_name, status')
  .eq('document_id', document.id)  // ❌ Only ONE document!
  .single();

const n8nRequest = {
  operationName: geminiOp.operation_name,  // ❌ Only ONE operation!
  // ...
};
```

**Why It Failed:**
- User uploads 3 files → 3 documents → 3 Gemini operations
- Edge function only sent 1 operation to n8n
- n8n polled only that 1 operation
- Other 2 operations never got polled
- Validation triggered with incomplete indexing
- **Result:** Gemini couldn't find documents, validation failed

### The Fix

**New Implementation (CORRECT):**
```typescript
// trigger-validation-n8n edge function (NEW)
const { data: geminiOps } = await supabase
  .from('gemini_operations')
  .select('id, operation_name, status, document_id')
  .eq('validation_detail_id', validationDetailId)  // ✅ ALL operations for this validation
  .order('created_at', { ascending: false });

const n8nRequest = {
  validationDetailId: validationDetail.id,
  operations: geminiOps.map(op => ({  // ✅ Array of ALL operations
    id: op.id,
    operationName: op.operation_name,
    status: op.status,
    documentId: op.document_id
  })),
  fileSearchStoreId: validationDetail.file_search_store_id,
  // ...
};
```

## n8n Workflow Requirements

### Input from `trigger-validation-n8n`

The webhook now receives:
```json
{
  "validationDetailId": 692,
  "operations": [
    {
      "id": 1261,
      "operationName": "fileSearchStores/validation692.../upload/operations/file1",
      "status": "pending",
      "documentId": 1050
    },
    {
      "id": 1262,
      "operationName": "fileSearchStores/validation692.../upload/operations/file2",
      "status": "pending",
      "documentId": 1051
    },
    {
      "id": 1263,
      "operationName": "fileSearchStores/validation692.../upload/operations/file3",
      "status": "pending",
      "documentId": 1052
    }
  ],
  "fileSearchStoreId": "fileSearchStores/validation692...",
  "requirements": [...],
  // ...
}
```

### Required n8n Workflow Structure

#### Option 1: Loop Through Operations (Recommended)

```
Webhook Trigger
    ↓
Split In Batches (operations array)
    ↓
For Each Operation:
    ↓
    Check Operation Status (POST to check-operation-status)
        Body: { "operationId": {{ $json.id }} }
    ↓
    Wait for Indexing (Loop until status = completed)
    ↓
Next Operation
    ↓
All Operations Complete?
    ↓
Trigger Validation (POST to validate-assessment-v2)
```

#### Option 2: Validation-Based Polling (Simpler)

Update `check-operation-status` to accept `validationDetailId` and return status for ALL operations:

```
Webhook Trigger
    ↓
Poll All Operations (POST to check-operation-status)
    Body: { "validationDetailId": {{ $json.validationDetailId }} }
    ↓
Response:
{
  "allCompleted": true/false,
  "operations": [
    { "id": 1261, "status": "completed", "progress": 100 },
    { "id": 1262, "status": "completed", "progress": 100 },
    { "id": 1263, "status": "in_progress", "progress": 45 }
  ],
  "completedCount": 2,
  "totalCount": 3
}
    ↓
Loop Until allCompleted = true
    ↓
Trigger Validation
```

### Critical: Status Field Name

**IMPORTANT:** The `check-operation-status` edge function returns:

```json
{
  "operation": {
    "status": "completed",  // ✅ Use this
    "progress": 100
  }
}
```

**NOT:**
```json
{
  "done": true  // ❌ This field doesn't exist
}
```

**n8n Condition Must Be:**
```javascript
{{ $json.operation.status === 'completed' }}
```

## Edge Function: check-operation-status

### Input

**Option A: Single Operation by ID**
```json
{
  "operationId": 1261
}
```

**Option B: Single Operation by Name**
```json
{
  "operationName": "fileSearchStores/.../operations/..."
}
```

**Future Enhancement: All Operations for Validation**
```json
{
  "validationDetailId": 692
}
```

### Output

```json
{
  "success": true,
  "operation": {
    "id": 1261,
    "documentId": 1050,
    "validationDetailId": 692,
    "status": "completed",    // pending | in_progress | completed | failed | timeout
    "progress": 100,
    "operationName": "fileSearchStores/.../operations/...",
    "metadata": { "size": "235.43 KB", "pages": 5 }
  },
  "document": {
    "id": 1050,
    "fileName": "TLIF0025 AT1.pdf"
  }
}
```

## File Search Store Management

### Per-Validation Dedicated Stores

**Key Change:** All files for a validation now share ONE Gemini File Search Store.

**Store Naming:** `validation{validationDetailId}{unitCode}{timestamp}`
- Example: `validation692tlif00251764230567882`
- **NO DASHES** - Gemini strips them

### Store Reuse Logic

```typescript
// First file uploaded:
1. Check validation_detail.file_search_store_id
2. If NULL → Create new store
3. Save store ID to validation_detail
4. Upload file to store

// Subsequent files:
1. Check validation_detail.file_search_store_id
2. If EXISTS → Reuse that store
3. Upload file to same store
```

**Database Schema:**
```sql
ALTER TABLE validation_detail
ADD COLUMN file_search_store_id TEXT,
ADD COLUMN file_search_store_name TEXT;
```

### Why This Matters

**Before (BROKEN):**
- Each file created a separate store
- Validation queried ONE store
- Other files not found → validation failed

**After (CORRECT):**
- All files in ONE store
- Validation queries that ONE store
- All files found → validation succeeds

## Testing Checklist

### Upload 3 Files

**Expected Logs:**

**File 1:**
```
Creating first store for validation 692: validation692tlif00251764230567882
✅ Created new store: fileSearchStores/validation692tlif0025176423-abc123xyz
   Display name returned by Gemini: validation692tlif00251764230567882
✅ Saved store ID to validation_detail
```

**File 2:**
```
♻️ Reusing store from validation_detail: validation692tlif00251764230567882
   Store ID: fileSearchStores/validation692tlif0025176423-abc123xyz
```

**File 3:**
```
♻️ Reusing store from validation_detail: validation692tlif00251764230567882
   Store ID: fileSearchStores/validation692tlif0025176423-abc123xyz
```

### Trigger Validation

**Expected trigger-validation-n8n Logs:**
```
Found 3 Gemini operations for validation 692
Calling n8n webhook: {
  validationDetailId: 692,
  operationCount: 3,
  validationType: 'assessment'
}
✅ N8n workflow triggered successfully
```

### n8n Polling

**Expected Behavior:**
1. n8n receives 3 operations
2. Polls each operation status
3. Waits until all 3 show `status: "completed"`
4. Triggers validation with all files indexed

## Common Errors

### Error: "Store not found in Gemini"

**Cause:** Race condition - trying to verify store existence immediately after creation

**Fix:** Trust the database, don't verify with Gemini API
```typescript
// DON'T DO THIS:
const stores = await gemini.listFileSearchStores();
fileSearchStore = stores.find(s => s.name === validationDetail.file_search_store_id);

// DO THIS:
fileSearchStore = {
  name: validationDetail.file_search_store_id,
  displayName: validationDetail.file_search_store_name,
};
```

### Error: "Validation missing file_search_store_id"

**Cause:** SELECT statement doesn't include new columns

**Fix:**
```typescript
const { data: validationDetail } = await supabase
  .from('validation_detail')
  .select(`
    id,
    file_search_store_id,        // ✅ Add this
    file_search_store_name,       // ✅ Add this
    validation_type (code),
    // ...
  `)
  .eq('id', validationDetailId)
  .single();
```

### Error: Gemini 404 on operation status check

**Cause:** Wrong operation name format

**Verify:**
1. Database has FULL operation name: `fileSearchStores/.../upload/operations/...`
2. n8n sends operation ID, not name
3. check-operation-status normalizes the name

**Debug Logs:**
```
[Check Operation] Original operation name: operations/1764226133262-1042
[Check Operation] Formatted operation name: fileSearchStores/.../operations/...
[Gemini] Request URL: https://generativelanguage.googleapis.com/v1beta/...
```

## Summary

**Critical Changes:**
1. ✅ `trigger-validation-n8n` sends ALL operations (not just one)
2. ✅ All files share ONE File Search Store per validation
3. ✅ Store ID saved to `validation_detail` for reuse
4. ✅ n8n must loop through ALL operations before validation
5. ✅ Check `operation.status === 'completed'` (not `done`)

**Next Steps:**
1. Update n8n workflow to handle `operations` array
2. Test with 3+ file upload
3. Verify all operations complete before validation
4. Monitor for Gemini 404 errors

---

**Last Updated:** 2025-11-27  
**Status:** Implementation complete, n8n workflow needs updating
