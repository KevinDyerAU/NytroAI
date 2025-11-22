# Document Upload Stuck at 50% - Fix

**Date:** November 22, 2025
**Status:** 🔧 IN PROGRESS

---

## Problem Statement

Documents get stuck at "Indexing in progress... 50%" with no errors shown to the user. The UI shows "Ready to Start Validation" even though files are still indexing.

**Evidence from Screenshot:**
- AT3.pdf: ✅ 100% - "Document indexed and ready for validation"
- TLIF0025 AT1.pdf: ⏳ 50% - "Indexing in progress..."
- UI shows: "Ready to Start Validation" (INCORRECT - should wait for all files)

**Console Logs:**
```
[Upload] Progress update for TLIF0025_AT1.pdf: 
  {stage: 'indexing', progress: 50, message: 'Indexing in progress...', 
   documentId: 717, operationId: 94}
```

---

## Root Causes

### 1. Silent Polling Failure

**File:** `src/services/DocumentUploadService.ts` (Line 254-261)

```typescript
const { data, error } = await supabase.functions.invoke('check-operation-status', {
  body: { operationId },
});

if (error) {
  console.error('Error checking operation status:', error);
  continue; // ❌ PROBLEM: Just continues retrying forever, no user feedback
}
```

**Issue:**
- If `check-operation-status` edge function fails, it silently retries
- No error shown to user
- Progress stuck at 50%
- Appears to be working but nothing is happening

**Possible Causes:**
1. Edge function not deployed
2. Edge function timing out
3. Database connection issues
4. Invalid operationId

### 2. Premature "Ready for Validation"

**File:** `src/components/DocumentUploadAdapter.tsx` or validation logic

**Issue:**
- UI shows "Ready to Start Validation" before all files finish indexing
- Validation button enabled when it should be disabled
- No check for "all files at 100%" before allowing validation

---

## ✅ Solutions

### Solution 1: Better Error Handling in Polling

**File:** `src/services/DocumentUploadService.ts`

Add error tracking and timeout handling:

```typescript
private async pollOperationStatus(
  operationId: number,
  onProgress?: (progress: number) => void
): Promise<void> {
  let attempts = 0;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5; // Fail after 5 consecutive errors

  while (attempts < this.maxPollAttempts) {
    await this.sleep(this.pollInterval);
    attempts++;

    try {
      const { data, error } = await supabase.functions.invoke('check-operation-status', {
        body: { operationId },
      });

      if (error) {
        consecutiveErrors++;
        console.error(`[Upload] Error checking operation status (attempt ${consecutiveErrors}/${maxConsecutiveErrors}):`, error);
        
        // ✅ Fail fast after multiple consecutive errors
        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw new Error(
            `❌ Unable to check indexing status: ${error.message}. ` +
            `The 'check-operation-status' function may not be deployed. ` +
            `Please check Supabase dashboard.`
          );
        }
        continue;
      }

      // ✅ Reset error counter on success
      consecutiveErrors = 0;

      const operation = data?.operation;
      if (!operation) {
        throw new Error('⚠️ Invalid operation status response - operation data missing');
      }

      console.log(`[Upload] Operation ${operationId} status: ${operation.status}, progress: ${operation.progress || 0}%`);
      onProgress?.(operation.progress || 0);

      if (operation.status === 'completed') {
        console.log(`[Upload] ✅ Operation ${operationId} completed successfully`);
        return;
      }

      if (operation.status === 'failed' || operation.status === 'timeout') {
        throw new Error(`❌ Indexing failed: ${operation.error || 'Unknown error'}`);
      }

      // Continue polling if status is 'processing' or 'pending'
    } catch (err) {
      // If we explicitly threw an error, re-throw it
      if (err instanceof Error && err.message.includes('❌')) {
        throw err;
      }
      // Otherwise log and continue
      console.error('[Upload] Unexpected error in polling:', err);
      consecutiveErrors++;
      if (consecutiveErrors >= maxConsecutiveErrors) {
        throw err;
      }
    }
  }

  throw new Error(
    `⏱️ Indexing timeout: Exceeded ${this.maxPollAttempts * this.pollInterval / 1000}s waiting for indexing to complete. ` +
    `The operation may still be processing. Please check the dashboard.`
  );
}
```

### Solution 2: Check All Files Before Enabling Validation

**File:** Create or update validation readiness check

```typescript
// In DocumentUploadAdapter or wherever validation readiness is checked

const areAllFilesIndexed = (files: FileState[]): boolean => {
  if (files.length === 0) return false;
  
  return files.every(f => 
    f.progress.stage === 'completed' && 
    f.progress.progress === 100
  );
};

const getIndexingStatus = (files: FileState[]): {
  total: number;
  completed: number;
  inProgress: number;
  failed: number;
  message: string;
} => {
  const total = files.length;
  const completed = files.filter(f => f.progress.stage === 'completed').length;
  const inProgress = files.filter(f => 
    f.progress.stage === 'indexing' || f.progress.stage === 'uploading'
  ).length;
  const failed = files.filter(f => f.progress.stage === 'failed').length;
  
  let message = '';
  if (completed === total) {
    message = `✅ All ${total} documents indexed and ready`;
  } else if (failed > 0) {
    message = `⚠️ ${failed} document(s) failed. ${completed}/${total} ready.`;
  } else if (inProgress > 0) {
    message = `⏳ Indexing ${inProgress} document(s)... ${completed}/${total} complete`;
  }
  
  return { total, completed, inProgress, failed, message };
};

// Use in UI:
const indexingStatus = getIndexingStatus(files);
const canStartValidation = areAllFilesIndexed(files) && hasSelectedUnit;

// Show in UI:
{!canStartValidation && indexingStatus.inProgress > 0 && (
  <div className="flex items-center gap-2 text-blue-600">
    <Loader2 className="w-4 h-4 animate-spin" />
    <span>{indexingStatus.message}</span>
  </div>
)}
```

### Solution 3: Deploy Missing Edge Function

**Check if edge function is deployed:**

```bash
supabase functions list
```

**If `check-operation-status` is missing, deploy it:**

```bash
supabase functions deploy check-operation-status
```

**Verify deployment:**

```bash
# Check function logs
supabase functions logs check-operation-status --follow

# Test the function
curl -i --location --request POST \
  'https://dfqxmjmggokneiuljkta.supabase.co/functions/v1/check-operation-status' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"operationId": 94}'
```

### Solution 4: Add Timeout and Retry UI Feedback

**Show user what's happening:**

```typescript
// In DocumentUploadRefactored.tsx

{files.map((fileState, index) => (
  <div key={index}>
    {/* Existing file preview */}
    
    {/* ✅ Add timeout warning */}
    {fileState.progress.stage === 'indexing' && 
     fileState.progress.progress === 50 && 
     Date.now() - fileState.uploadStartTime > 30000 && (
      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
        <div className="flex items-center gap-2 text-yellow-800">
          <AlertTriangle className="w-4 h-4" />
          <span>
            Indexing is taking longer than expected. This may indicate:
          </span>
        </div>
        <ul className="ml-6 mt-1 text-yellow-700 text-xs list-disc">
          <li>Large file size (processing may take several minutes)</li>
          <li>Edge function deployment issues</li>
          <li>Temporary network issues</li>
        </ul>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => checkOperationStatus(fileState.operationId!)}
            className="text-xs px-2 py-1 bg-yellow-100 hover:bg-yellow-200 rounded"
          >
            Check Status
          </button>
          <a
            href={`https://supabase.com/dashboard/project/dfqxmjmggokneiuljkta/functions`}
            target="_blank"
            className="text-xs px-2 py-1 bg-yellow-100 hover:bg-yellow-200 rounded"
          >
            Check Functions
          </a>
        </div>
      </div>
    )}
  </div>
))}
```

---

## Implementation Priority

### 🔴 Critical (Do First)

1. **Add Error Tracking to Polling** - Prevents infinite silent retries
2. **Deploy check-operation-status** - If not deployed
3. **Fix Validation Button** - Don't enable until all files at 100%

### 🟡 Important (Do Next)

4. **Add Timeout Warning UI** - Show user when stuck
5. **Better Logging** - Console logs for debugging
6. **Error Toast on Failure** - User feedback when polling fails

### 🟢 Enhancement (Nice to Have)

7. **Retry Button** - Manual retry for stuck files
8. **Operation Status Checker** - Debug tool to check operation manually
9. **Progress Estimation** - Show estimated time remaining

---

## Testing Checklist

### Verify Edge Function Deployment

- [ ] Run `supabase functions list`
- [ ] Confirm `check-operation-status` is ACTIVE
- [ ] Check function logs for errors
- [ ] Test function with sample operationId

### Test Upload Flow

- [ ] Upload single file, verify reaches 100%
- [ ] Upload multiple files, verify all reach 100%
- [ ] Validation button disabled until all files complete
- [ ] Indexing status message updates correctly
- [ ] Console shows polling progress logs

### Test Error Scenarios

- [ ] Undeploy edge function, verify error shown to user
- [ ] Network disconnect during indexing, verify error handling
- [ ] Invalid operationId, verify clear error message
- [ ] Timeout scenario, verify user sees timeout warning

### Test UI Feedback

- [ ] Files show correct progress percentages
- [ ] Error messages display in UI (not just console)
- [ ] Timeout warning appears after 30 seconds
- [ ] Retry/Check Status buttons work
- [ ] Validation button state correct

---

## Monitoring & Debugging

### Console Logs to Add

```typescript
// At start of polling
console.log(`[Upload] Starting to poll operation ${operationId}, max attempts: ${this.maxPollAttempts}`);

// During polling
console.log(`[Upload] Poll attempt ${attempts}/${this.maxPollAttempts} for operation ${operationId}`);
console.log(`[Upload] Operation status:`, {
  id: operationId,
  status: operation.status,
  progress: operation.progress,
  error: operation.error
});

// On error
console.error(`[Upload] Polling error (consecutive: ${consecutiveErrors}/${maxConsecutiveErrors}):`, error);

// On completion
console.log(`[Upload] ✅ Operation ${operationId} completed after ${attempts} attempts (${attempts * this.pollInterval / 1000}s)`);

// On timeout
console.error(`[Upload] ⏱️ Operation ${operationId} timed out after ${attempts} attempts (${attempts * this.pollInterval / 1000}s)`);
```

### Database Query to Check Stuck Operations

```sql
-- Check operation status
SELECT 
  id,
  status,
  progress,
  error,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) as age_seconds
FROM gemini_operations
WHERE id = 94; -- Replace with actual operationId

-- Check if operation is stuck
SELECT 
  id,
  status,
  progress,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) as seconds_since_update
FROM gemini_operations
WHERE status = 'processing'
  AND EXTRACT(EPOCH FROM (NOW() - updated_at)) > 300 -- Stuck for > 5 minutes
ORDER BY created_at DESC;
```

---

## Quick Fixes

### If Upload is Currently Stuck

1. **Check the operation status in database:**
   ```sql
   SELECT * FROM gemini_operations WHERE id = 94;
   ```

2. **If status is 'failed' or very old, manually mark as failed:**
   ```sql
   UPDATE gemini_operations 
   SET status = 'failed', error = 'Manual intervention - stuck at 50%'
   WHERE id = 94;
   ```

3. **Re-upload the file:**
   - Remove the stuck file from UI
   - Upload again

4. **Check edge function deployment:**
   ```bash
   supabase functions list
   supabase functions deploy check-operation-status
   ```

---

## Related Issues

- **Error Handling** - See ERROR_HANDLING_IMPROVEMENTS.md
- **Dashboard Refresh** - See DASHBOARD_REFRESH_FIXES.md
- **Edge Function Deployment** - See DEPLOY_EDGE_FUNCTIONS.md

---

## Success Criteria

- [ ] No files stuck at 50% indefinitely
- [ ] Clear error messages when polling fails
- [ ] User sees progress updates
- [ ] Validation button only enabled when all files at 100%
- [ ] Timeout warnings appear after reasonable time
- [ ] Manual retry option available
- [ ] Edge functions properly deployed
- [ ] Comprehensive logging for debugging

---

**Status:** 🔧 Needs implementation and edge function verification

**Next Steps:**
1. Verify `check-operation-status` is deployed
2. Implement error tracking in polling
3. Add validation readiness check
4. Add timeout warning UI
5. Test with multiple files
