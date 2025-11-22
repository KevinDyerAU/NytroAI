# Phase 3.3: Validation Kickoff Analysis

## Issue: Validation Not Being Triggered

**Reported Problem:** Validation is not being kicked off after document upload and processing.

---

## Current Validation Workflow

### Expected Flow

1. **User Uploads Documents** → Dashboard
2. **Create Validation Record** → `create-validation-record` edge function
   - Creates `validation_summary`
   - Creates `validation_type`
   - Creates `validation_detail`
   - Returns `detailId`, `summaryId`, `typeId`
3. **Upload Documents** → Documents uploaded with `validation_detail_id`
4. **Document Processing** → Gemini File API indexes documents
   - Status tracked in `gemini_operations` table
   - Each document gets a `file_search_store_id`
5. **Wait for Indexing** → `ValidationProgressTracker` monitors completion
6. **Trigger Validation** → `trigger-validation` edge function
   - Calls `validate-assessment` edge function
   - Validation runs against indexed documents
7. **Store Results** → Results stored in `validation_results` table
8. **Update Status** → `extractStatus` updated to 'Completed'

### Current Implementation Analysis

#### 1. Validation Record Creation ✅

**File:** `src/services/ValidationWorkflowService.ts` → `createValidationRecord()`

**Status:** Working correctly

```typescript
async createValidationRecord(params: CreateValidationParams): Promise<ValidationRecord> {
  // Generates unique namespace
  this.currentNamespace = `${params.rtoCode}-${params.unitCode}-${timestamp}`;
  
  // Calls edge function
  const { data, error } = await supabase.functions.invoke('create-validation-record', {
    body: {
      rtoCode: params.rtoCode,
      unitCode: params.unitCode,
      qualificationCode: null,
      validationType: params.validationType,
      pineconeNamespace: this.currentNamespace,
    },
  });
  
  return {
    summaryId,
    typeId,
    detailId,
  };
}
```

**Edge Function:** `supabase/functions/create-validation-record/index.ts`

Creates all required database records and returns IDs.

#### 2. Document Upload ✅

**Status:** Working correctly

Documents are uploaded with `validation_detail_id` and sent to Gemini File API for indexing.

#### 3. Document Processing Monitoring ✅

**Component:** `ValidationProgressTracker`

**Status:** Working correctly

Monitors `gemini_operations` table for indexing completion.

#### 4. Validation Trigger ⚠️ **POTENTIAL ISSUE**

**File:** `src/components/Dashboard.tsx` (lines 537-548)

```typescript
onComplete={async () => {
  // All documents indexed - auto-trigger validation
  console.log('[Dashboard] Document processing complete! Auto-triggering validation...');
  try {
    // Wait for File Search index to be ready (Google's secondary indexing)
    console.log('[Dashboard] Waiting 15 seconds for File Search index...');
    toast.info('Documents indexed! Starting validation in 15 seconds...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    await validationWorkflowService.triggerValidation(
      selectedValidationData.id  // ⚠️ This is validation_detail.id
    );
    
    console.log('[Dashboard] Validation triggered successfully!');
    toast.success('Validation started!');
```

**Service:** `src/services/ValidationWorkflowService.ts` → `triggerValidation()`

```typescript
async triggerValidation(validationDetailId: number): Promise<void> {
  console.log('[ValidationWorkflow] Triggering validation for:', validationDetailId);

  try {
    // First, get the file_search_store_id from any document in this validation
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('file_search_store_id')
      .eq('validation_detail_id', validationDetailId)
      .limit(1)
      .single();

    if (docsError) {
      throw new Error(`📄 Unable to fetch uploaded documents: ${docsError.message}`);
    }
    
    if (!documents?.file_search_store_id) {
      throw new Error('📄 No documents found for this validation.');
    }

    // Update validation_detail with required fields
    const { error: updateError } = await supabase
      .from('validation_detail')
      .update({
        docExtracted: true,
        file_search_store_id: documents.file_search_store_id,
        extractStatus: 'ProcessingInBackground', // ⚠️ This shows Stage 3
      })
      .eq('id', validationDetailId);

    // Now trigger validation
    const { data, error } = await supabase.functions.invoke('trigger-validation', {
      body: {
        validationDetailId,
      },
    });
```

**Edge Function:** `supabase/functions/trigger-validation/index.ts`

```typescript
// Get validation detail
const { data: validationDetail, error: valDetailError } = await supabase
  .from('validation_detail')
  .select(`
    *,
    validation_summary!inner(rtoCode, unitCode),
    validation_type!inner(code, description)
  `)
  .eq('id', validationDetailId)
  .single();

// Check if documents are uploaded and indexed
if (!validationDetail.docExtracted || !validationDetail.file_search_store_id) {
  return createErrorResponse('Documents not yet indexed. Please wait for upload to complete.');
}

// Call validate-assessment Edge Function
const { data: validationResult, error: validationError } = await supabase.functions.invoke(
  'validate-assessment',
  {
    body: {
      documentId: firstDocument.id,
      unitCode: unitCode,
      validationType: mappedValidationType,
      validationDetailId: validationDetailId,
      namespace: namespace,
    },
  }
);
```

---

## Identified Issues

### Issue 1: Column Name Mismatch ⚠️ **CRITICAL**

**Problem:** Inconsistent column naming between service and database

**Service uses:**
- `docExtracted` (camelCase)
- `extractStatus` (camelCase)
- `file_search_store_id` (snake_case)

**Database likely has:**
- `doc_extracted` (snake_case)
- `extract_status` (snake_case)
- `file_search_store_id` (snake_case)

**Impact:**
- Updates to `validation_detail` may be failing silently
- `docExtracted` and `extractStatus` fields not being set
- Trigger validation edge function checks fail because fields are null

**Evidence:**
```typescript
// In ValidationWorkflowService.ts
await supabase
  .from('validation_detail')
  .update({
    docExtracted: true,  // ⚠️ Should be doc_extracted
    file_search_store_id: documents.file_search_store_id,
    extractStatus: 'ProcessingInBackground',  // ⚠️ Should be extract_status
  })
  .eq('id', validationDetailId);

// In trigger-validation/index.ts
if (!validationDetail.docExtracted || !validationDetail.file_search_store_id) {
  // ⚠️ This check fails if columns don't exist or are null
  return createErrorResponse('Documents not yet indexed...');
}
```

### Issue 2: Error Handling Not Surfaced to UI

**Problem:** Errors in `triggerValidation` are caught but not always shown to user

**Code:**
```typescript
try {
  await validationWorkflowService.triggerValidation(selectedValidationData.id);
  toast.success('Validation started!');
} catch (error) {
  console.error('[Dashboard] Error triggering validation:', error);
  toast.error(`Failed to trigger validation: ${error.message}`);
}
```

**Issue:** If the error occurs inside the edge function, it may not bubble up properly.

### Issue 3: Namespace Handling

**Problem:** Namespace is generated in `createValidationRecord` but may not be properly stored

**Code:**
```typescript
// In ValidationWorkflowService.ts
this.currentNamespace = `${params.rtoCode}-${params.unitCode}-${timestamp}`;

// Sent to edge function
pineconeNamespace: this.currentNamespace,
```

**Question:** Is `namespace_code` being stored in `validation_detail`?

**Edge function reads:**
```typescript
const namespace = validationDetail.namespace_code;
```

If `namespace_code` is null, validation may fail.

### Issue 4: validate-assessment Edge Function

**Problem:** May not be deployed or may have errors

**Need to check:**
1. Is `validate-assessment` edge function deployed?
2. Does it handle the new `validation_results` table?
3. Does it properly validate against Gemini File API?

---

## Root Cause Hypothesis

### Most Likely: Column Name Mismatch

The `validation_detail` table uses snake_case column names, but the code is trying to update camelCase columns:

```typescript
// This update likely fails silently
await supabase
  .from('validation_detail')
  .update({
    docExtracted: true,        // ❌ Column doesn't exist
    extractStatus: 'ProcessingInBackground',  // ❌ Column doesn't exist
  })
```

When `trigger-validation` edge function checks:
```typescript
if (!validationDetail.docExtracted || !validationDetail.file_search_store_id) {
  // These fields are null/undefined
  return createErrorResponse('Documents not yet indexed...');
}
```

**Result:** Validation never triggers because the check fails.

---

## Verification Steps

### Step 1: Check Database Schema

```sql
-- Check actual column names in validation_detail table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'validation_detail'
ORDER BY ordinal_position;
```

Expected columns:
- `id`
- `validation_summary_id`
- `validation_type_id`
- `doc_extracted` (snake_case) or `docExtracted` (camelCase)?
- `extract_status` (snake_case) or `extractStatus` (camelCase)?
- `file_search_store_id`
- `namespace_code`
- `req_extracted`
- `req_total`
- `completed_count`
- `created_at`
- `updated_at`

### Step 2: Check Recent validation_detail Records

```sql
-- Check if fields are being set
SELECT 
  id,
  doc_extracted,
  extract_status,
  file_search_store_id,
  namespace_code,
  created_at
FROM validation_detail
ORDER BY created_at DESC
LIMIT 5;
```

### Step 3: Check Edge Function Logs

```bash
# Check Supabase edge function logs
supabase functions logs trigger-validation
supabase functions logs validate-assessment
```

### Step 4: Test Manual Trigger

```typescript
// In browser console
const { data, error } = await supabase.functions.invoke('trigger-validation', {
  body: { validationDetailId: 587 }
});
console.log({ data, error });
```

---

## Fixes Required

### Fix 1: Standardize Column Names

**Option A: Update Code to Use snake_case** (Recommended)

```typescript
// In ValidationWorkflowService.ts
await supabase
  .from('validation_detail')
  .update({
    doc_extracted: true,  // ✅ snake_case
    file_search_store_id: documents.file_search_store_id,
    extract_status: 'ProcessingInBackground',  // ✅ snake_case
  })
  .eq('id', validationDetailId);
```

**Option B: Update Database to Use camelCase** (Not Recommended)

Requires migration to rename columns.

### Fix 2: Improve Error Handling

```typescript
// In ValidationWorkflowService.ts
async triggerValidation(validationDetailId: number): Promise<void> {
  console.log('[ValidationWorkflow] Triggering validation for:', validationDetailId);

  try {
    // ... existing code ...

    const { data, error } = await supabase.functions.invoke('trigger-validation', {
      body: { validationDetailId },
    });

    if (error) {
      console.error('[ValidationWorkflow] Error from edge function:', error);
      
      // Try to extract actual error message
      let errorMessage = 'Failed to trigger validation';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.context) {
        // Edge function may return error in context
        const responseText = await error.context.text();
        try {
          const responseJson = JSON.parse(responseText);
          errorMessage = responseJson.error || responseJson.message || responseText;
        } catch {
          errorMessage = responseText;
        }
      }
      
      throw new Error(errorMessage);
    }

    if (!data?.success) {
      const errorMsg = data?.error || 'Validation trigger returned success=false';
      throw new Error(errorMsg);
    }

    console.log('[ValidationWorkflow] Validation triggered successfully:', data);
  } catch (err) {
    console.error('[ValidationWorkflow] Exception in triggerValidation:', err);
    throw err; // Re-throw to surface to UI
  }
}
```

### Fix 3: Ensure namespace_code is Stored

```typescript
// In create-validation-record edge function
// Make sure namespace is stored in validation_detail

const { data: validationDetail, error: detailError } = await supabase
  .from('validation_detail')
  .insert({
    validation_summary_id: summaryId,
    validation_type_id: typeId,
    namespace_code: pineconeNamespace,  // ✅ Store namespace
    extract_status: 'pending',
    doc_extracted: false,
  })
  .select()
  .single();
```

### Fix 4: Add Validation Status Checks

```typescript
// In Dashboard.tsx
onComplete={async () => {
  console.log('[Dashboard] Document processing complete! Auto-triggering validation...');
  try {
    // Check validation status before triggering
    const { data: validationCheck } = await supabase
      .from('validation_detail')
      .select('id, doc_extracted, extract_status, file_search_store_id, namespace_code')
      .eq('id', selectedValidationData.id)
      .single();
    
    console.log('[Dashboard] Validation status before trigger:', validationCheck);
    
    if (!validationCheck?.file_search_store_id) {
      throw new Error('No file_search_store_id found. Documents may not be properly indexed.');
    }
    
    if (!validationCheck?.namespace_code) {
      throw new Error('No namespace_code found. Validation record may be incomplete.');
    }
    
    // Wait for File Search index
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    await validationWorkflowService.triggerValidation(selectedValidationData.id);
    
    toast.success('Validation started!');
  } catch (error) {
    console.error('[Dashboard] Error triggering validation:', error);
    toast.error(`Failed to trigger validation: ${error.message}`);
    
    // Update status to show error
    await supabase
      .from('validation_detail')
      .update({ extract_status: 'ValidationFailed' })
      .eq('id', selectedValidationData.id);
  }
}
```

---

## Phase 4 Preparation

### Validation Prompt Analysis

For Phase 4 (prompt optimization), we need to understand:

1. **Current Prompt Structure**
   - Where are validation prompts defined?
   - Are they in `_shared/validation-prompts.ts`?
   - Do they use single comprehensive prompt or individual requirement prompts?

2. **Prompt Performance**
   - How long does validation take?
   - What's the token usage?
   - Are there timeout issues?

3. **Validation vs Smart Questions**
   - Are they combined in one prompt?
   - Should they be separated?

4. **Validation Accuracy**
   - Does single prompt work well?
   - Would individual requirement validation be better?

### Files to Review for Phase 4

- `supabase/functions/_shared/validation-prompts.ts`
- `supabase/functions/validate-assessment/index.ts`
- `supabase/functions/validate-assessment-v2/index.ts`

---

## Action Plan

### Immediate (Phase 3.3)

1. ✅ **Verify Database Schema**
   - Check actual column names in `validation_detail`
   - Identify camelCase vs snake_case mismatches

2. ✅ **Fix Column Name Mismatches**
   - Update all code to use correct column names
   - Test that updates work

3. ✅ **Improve Error Handling**
   - Surface edge function errors to UI
   - Add validation status checks before triggering

4. ✅ **Test Validation Trigger**
   - Manually trigger validation
   - Verify it reaches validate-assessment
   - Confirm results are stored

5. ✅ **Document Validation Flow**
   - Create flow diagram
   - Document all edge functions involved
   - Prepare for Phase 4 prompt optimization

### Next (Phase 4)

1. Review validation prompts
2. Analyze prompt performance
3. Separate validation from smart question generation
4. Optimize for accuracy and speed

---

## Success Criteria

- [ ] Validation triggers successfully after document processing
- [ ] Status updates correctly through all stages
- [ ] Errors are surfaced to UI with clear messages
- [ ] Results are stored in validation_results table
- [ ] Dashboard shows completed validation
- [ ] No column name mismatch errors
- [ ] Namespace is properly stored and used
