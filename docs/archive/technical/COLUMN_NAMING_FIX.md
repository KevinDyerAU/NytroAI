# Column Naming Convention Fix

**Date:** November 22, 2025
**Status:** ✅ FIXED

---

## Problem Statement

Validation results were failing to load with a database error:

```
column validation_detail.extract_status does not exist
hint: 'Perhaps you meant to reference the column "validation_detail.extractStatus".'
```

**Error Details:**
- **Error Code:** 42703 (PostgreSQL: undefined column)
- **Query:** `SELECT extract_status, validation_status, validation_count, validation_total FROM validation_detail WHERE id = 591`
- **Issue:** Code using snake_case but database has camelCase

---

## Root Cause

**Database Schema:** Uses **camelCase** column names
- `extractStatus`
- `validationStatus`
- `validationCount`
- `validationTotal`

**Code Query:** Was using **snake_case**
```typescript
// ❌ WRONG - snake_case
.select('extract_status, validation_status, validation_count, validation_total')

// Access with snake_case
data.extract_status
data.validation_status
data.validation_count
```

**Why This Happened:**
This is a common inconsistency in the codebase. Some parts use snake_case (typical PostgreSQL convention), while others use camelCase (JavaScript/TypeScript convention). The `validation_detail` table was created with camelCase column names.

---

## ✅ Solution

**File:** `src/lib/validationResults.ts`

### Changed Lines 49, 72-73, 81, 91

**Before:**
```typescript
// Line 49 - SELECT query
.select('extract_status, validation_status, validation_count, validation_total')

// Line 72 - Check processing status
if (processingStatuses.includes(data.extract_status)) {
  return {
    isReady: false,
    status: data.extract_status,
    message: 'Validation is still processing. Please check back in a moment.',
  };
}

// Line 81 - Check validation count
if (data.validation_count === 0) {
  return {
    isReady: false,
    status: 'no_results',
    message: 'No validation results available yet.',
  };
}

// Line 91 - Return validation status
return {
  isReady: true,
  status: data.validation_status || 'completed',
  message: 'Validation results are ready',
};
```

**After:**
```typescript
// Line 49 - SELECT query with camelCase
.select('extractStatus, validationStatus, validationCount, validationTotal')

// Line 72 - Check processing status with camelCase
if (processingStatuses.includes(data.extractStatus)) {
  return {
    isReady: false,
    status: data.extractStatus,
    message: 'Validation is still processing. Please check back in a moment.',
  };
}

// Line 81 - Check validation count with camelCase
if (data.validationCount === 0) {
  return {
    isReady: false,
    status: 'no_results',
    message: 'No validation results available yet.',
  };
}

// Line 91 - Return validation status with camelCase
return {
  isReady: true,
  status: data.validationStatus || 'completed',
  message: 'Validation results are ready',
};
```

---

## Database Schema Reference

### `validation_detail` Table Columns (camelCase)

```sql
-- Key columns in validation_detail table
id                 -- integer (primary key)
unit_code          -- text (snake_case exception)
qualification_code -- text (snake_case exception)
validation_type    -- text (snake_case exception)
extractStatus      -- text (camelCase) ✅
validationStatus   -- text (camelCase) ✅
validationCount    -- integer (camelCase) ✅
validationTotal    -- integer (camelCase) ✅
docExtracted       -- boolean (camelCase) ✅
created_at         -- timestamp (snake_case exception)
updated_at         -- timestamp (snake_case exception)
```

**Note:** The table has mixed conventions:
- Most columns use **camelCase** (JavaScript style)
- Some columns use **snake_case** (PostgreSQL style)
- This is inconsistent but we must follow the actual schema

---

## Related Issues

This same issue appeared earlier in other files:

### 1. `ValidationWorkflowService.ts`
**Fixed Previously:** Used `doc_extracted` and `extract_status` when creating records
**Correct:** Should use `docExtracted` and `extractStatus`

### 2. Other Potential Issues
Need to audit the codebase for similar snake_case usage:

```bash
# Search for potential issues
grep -r "extract_status" src/
grep -r "validation_status" src/
grep -r "validation_count" src/
grep -r "validation_total" src/
grep -r "doc_extracted" src/
```

---

## Prevention Strategy

### 1. Type Definitions
**Recommendation:** Create TypeScript interfaces that match database schema exactly

```typescript
// src/types/validation.ts

export interface ValidationDetail {
  id: number;
  unit_code: string;          // snake_case
  qualification_code?: string; // snake_case
  validation_type?: string;    // snake_case
  extractStatus: string;       // camelCase
  validationStatus: string;    // camelCase
  validationCount: number;     // camelCase
  validationTotal: number;     // camelCase
  docExtracted: boolean;       // camelCase
  created_at: string;          // snake_case
  updated_at: string;          // snake_case
}
```

**Usage:**
```typescript
const { data, error } = await supabase
  .from('validation_detail')
  .select('*')
  .eq('id', validationDetailId)
  .single() as { data: ValidationDetail | null, error: any };

// TypeScript will now enforce correct property names
console.log(data.extractStatus);  // ✅ Valid
console.log(data.extract_status); // ❌ TypeScript error
```

### 2. Database Naming Convention Standardization
**Recommendation:** Migrate all columns to snake_case (PostgreSQL standard)

```sql
-- Migration to standardize naming
ALTER TABLE validation_detail 
  RENAME COLUMN extractStatus TO extract_status,
  RENAME COLUMN validationStatus TO validation_status,
  RENAME COLUMN validationCount TO validation_count,
  RENAME COLUMN validationTotal TO validation_total,
  RENAME COLUMN docExtracted TO doc_extracted;
```

**Benefits:**
- Consistent with PostgreSQL conventions
- Consistent with other tables in the schema
- Prevents confusion between code and database

**Trade-offs:**
- Requires updating all queries
- Might break existing edge functions
- Need to coordinate with frontend changes

### 3. Code Review Checklist
When writing Supabase queries:
- [ ] Check actual column names in Supabase Dashboard
- [ ] Match exact case (camelCase vs snake_case)
- [ ] Use TypeScript interfaces for type safety
- [ ] Test queries with actual database
- [ ] Document any naming inconsistencies

---

## Testing

### Verify Fix Works

1. **Open Dashboard**
2. **Click on validation record with ID 591**
3. **Verify results load without error**
4. **Check console - should see:**
   ```
   [ResultsExplorer] Found validation record: {...}
   [ResultsExplorer] Fetching validation results for ID: 591
   [checkValidationStatus] Status check successful
   ```

### Test Cases

- [x] Load validation with `extractStatus = 'DocumentProcessing'`
- [x] Load validation with `extractStatus = 'Completed'`
- [x] Load validation with `validationCount = 0`
- [x] Load validation with `validationCount > 0`
- [x] No database errors in console
- [x] Results display correctly

---

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| `src/lib/validationResults.ts` | 49, 72-73, 81, 91 | Changed snake_case to camelCase |

---

## Success Criteria

- [x] No "column does not exist" errors
- [x] Validation results load successfully
- [x] Console shows correct data
- [x] TypeScript compiles without errors
- [x] UI displays validation details

---

**Status:** ✅ Complete - Column naming fixed, validation results now loading

**Next Steps:**
1. Consider creating TypeScript interfaces for all database tables
2. Audit codebase for similar naming issues
3. Consider database migration to standardize naming convention
4. Document table schemas with actual column names
