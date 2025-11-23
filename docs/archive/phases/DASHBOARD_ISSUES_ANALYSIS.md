# Dashboard Issues Analysis

**Date:** November 22, 2025  
**Issues Reported:**
1. Dashboard_v3 is poorly formatted compared to original Dashboard
2. No validation results come through when available
3. Results page has similar issues
4. Status updates skip steps from indexing → validation → complete

---

## Issue 1: Dashboard_v3 Formatting

### Problems Identified:

1. **Missing Components:**
   - No StatusBadge component (original has it)
   - No pagination controls (ChevronLeft/ChevronRight)
   - No validation success dialog
   - No pie chart visualization

2. **Different Data Structure:**
   - Dashboard_v3 uses `extractStatus` (camelCase)
   - Original uses `extract_status` (snake_case)
   - This causes data mismatch

3. **Column Name Mismatch:**
   ```typescript
   // Dashboard_v3 (WRONG):
   extractStatus: v.extractStatus || 'pending',
   docExtracted: v.docExtracted || false,
   
   // Should be (CORRECT):
   extract_status: v.extract_status || 'pending',
   doc_extracted: v.doc_extracted || false,
   ```

4. **Missing Features:**
   - No "Validate" button
   - No detailed status tracking
   - No error display
   - Simplified UI without original styling

---

## Issue 2: Validation Results Not Displaying

### Root Cause:

**Column Name Mismatch in Query:**

```typescript
// Dashboard_v3 line 91-92 (WRONG):
extractStatus: v.extractStatus || 'pending',
docExtracted: v.docExtracted || false,

// Database has:
extract_status (snake_case)
doc_extracted (snake_case)
```

**Impact:**
- `v.extractStatus` returns `undefined`
- `v.docExtracted` returns `undefined`
- All validations appear as "pending"
- Completed validations don't show

### Fix Required:

```typescript
const formatted = data?.map(v => ({
  id: v.id,
  unit_code: v.validation_summary?.unitCode || 'N/A',
  validation_type: v.validation_type?.validation_type || 'Unknown',
  extract_status: v.extract_status || 'pending',  // FIXED
  doc_extracted: v.doc_extracted || false,        // FIXED
  req_extracted: v.req_extracted || false,
  num_of_req: v.num_of_req || 0,
  req_total: v.req_total || 0,
  completed_count: v.completed_count || 0,
  created_at: v.created_at,
  error_message: v.error_message,
})) || [];
```

---

## Issue 3: Status Update Flow Skipping Steps

### Expected Flow:
1. **Pending** → Initial state
2. **DocumentProcessing** → Documents being indexed
3. **ProcessingInBackground** → Validation running
4. **Completed** → All done

### Current Problem:

**Status jumps from indexing directly to complete, skipping validation step**

### Root Causes:

1. **Database Trigger Issue:**
   - Trigger may be setting status to 'Completed' immediately
   - Missing intermediate 'ProcessingInBackground' status

2. **Status Update Logic:**
   ```typescript
   // In trigger-validation edge function:
   // May be setting status to 'Completed' too early
   ```

3. **Missing Status Transitions:**
   - No update to 'ProcessingInBackground' when validation starts
   - Direct jump from 'DocumentProcessing' to 'Completed'

### Fix Required:

1. **Update trigger-validation edge function:**
   ```typescript
   // Set status to 'ProcessingInBackground' when validation starts
   await supabase
     .from('validation_detail')
     .update({ extract_status: 'ProcessingInBackground' })
     .eq('id', validationDetailId);
   ```

2. **Update validate-assessment edge function:**
   ```typescript
   // Set status to 'Completed' only after all validations done
   await supabase
     .from('validation_detail')
     .update({ extract_status: 'Completed' })
     .eq('id', validationDetailId);
   ```

---

## Issue 4: Results Page Issues

### Similar Problems:

1. **Column Name Mismatch:**
   - Results page likely using camelCase
   - Database has snake_case
   - Results don't load

2. **Status Check Issues:**
   - Checking wrong status field
   - Results appear unavailable when they exist

### Fix Required:

Review all components that query `validation_detail` table and ensure they use:
- `extract_status` (not `extractStatus`)
- `doc_extracted` (not `docExtracted`)
- `req_extracted` (not `reqExtracted`)
- `num_of_req` (not `numOfReq`)
- `req_total` (not `reqTotal`)
- `completed_count` (not `completedCount`)

---

## Recommended Fixes

### Priority 1: Fix Column Names (CRITICAL)

**Files to Update:**
1. `src/components/Dashboard_v3.tsx` - Lines 91-102
2. `src/components/ResultsExplorer.tsx` - All queries
3. `src/services/ValidationWorkflowService.ts` - All queries
4. `src/hooks/useValidationProgress.ts` - All queries

### Priority 2: Fix Status Flow

**Files to Update:**
1. `supabase/functions/trigger-validation/index.ts`
   - Add status update to 'ProcessingInBackground'
2. `supabase/functions/validate-assessment/index.ts`
   - Add status update to 'Completed' at end

### Priority 3: Restore Dashboard Features

**Add Back to Dashboard_v3:**
1. StatusBadge component
2. Pagination controls
3. Validation success dialog
4. Pie chart visualization
5. "Validate" button
6. Error display

---

## Testing Checklist

- [ ] Dashboard displays all validations
- [ ] Completed validations show correct status
- [ ] Status transitions: Pending → DocumentProcessing → ProcessingInBackground → Completed
- [ ] Validation results display when available
- [ ] Results page shows data correctly
- [ ] Column names match database schema
- [ ] Real-time updates work
- [ ] Pagination works
- [ ] Double-click opens results

---

## Next Steps

1. Fix column name mismatches in Dashboard_v3
2. Fix status update flow in edge functions
3. Test end-to-end validation workflow
4. Restore missing Dashboard features
5. Fix Results page column names
6. Deploy and verify
