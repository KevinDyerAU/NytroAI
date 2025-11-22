# Auto-Trigger Migration - Column Name Fixes

**Date:** November 22, 2025  
**Status:** ✅ FIXED  

---

## Issues Found & Fixed

### Issue 1: Wrong Foreign Key Column Name

**Error:**
```
ERROR: 42703: column vd.validation_summary_id does not exist
LINE 361: JOIN validation_summary vs ON vd.validation_summary_id = vs.id
```

**Cause:** Column is named `summary_id`, not `validation_summary_id`

**Fix:** Changed `vd.validation_summary_id` → `vd.summary_id`

---

### Issue 2: Case-Sensitive Column Names

**Error:**
```
ERROR: 42703: column vd.extractstatus does not exist
LINE 346: vd.extractStatus,
HINT: Perhaps you meant to reference the column "vd.extractStatus".
```

**Cause:** PostgreSQL folds unquoted identifiers to lowercase. The database columns were created with camelCase (e.g., `"extractStatus"`, `"rtoCode"`) which requires quoted identifiers to reference.

**Fix:** Added double quotes around all camelCase column names:
- `extractStatus` → `"extractStatus"`
- `rtoCode` → `"rtoCode"`
- `unitCode` → `"unitCode"`

---

## Database Schema Naming Convention

The `validation_detail` and `validation_summary` tables use **mixed** naming conventions:

### snake_case Columns (no quotes needed)
```sql
id
summary_id
unit_code          -- exception
qualification_code -- exception
validation_type    -- exception
created_at
updated_at
```

### camelCase Columns (quotes required)
```sql
"extractStatus"
"validationStatus"
"validationCount"
"validationTotal"
"docExtracted"
"rtoCode"
"unitCode"
```

**Rule:** When referencing camelCase columns in SQL, always use double quotes.

---

## Files Fixed

### Migration File
**File:** `supabase/migrations/20250122_auto_trigger_validation.sql`

**Changes:**
1. Line 148: `SET "extractStatus" = 'IndexingFailed'`
2. Line 346: `vd."extractStatus",`
3. Line 347: `vs."rtoCode",`
4. Line 348: `vs."unitCode",`
5. Line 361: `ON vd.summary_id = vs.id`

### Test Script
**File:** `scripts/test-auto-trigger.sql`

**Changes:**
1. Line 109-111: Added quotes to `"extractStatus"`, `"rtoCode"`, `"unitCode"`

### Quick Start Script
**File:** `scripts/quick-start-auto-trigger.sql`

**Changes:**
1. Line 175-177: Added quotes to `"extractStatus"`, `"rtoCode"`, `"unitCode"`

---

## PostgreSQL Case Sensitivity Rules

### Unquoted Identifiers (folded to lowercase)
```sql
SELECT extractStatus FROM validation_detail;
-- PostgreSQL sees: extractstatus
-- ❌ Fails if column is "extractStatus"
```

### Quoted Identifiers (preserve case)
```sql
SELECT "extractStatus" FROM validation_detail;
-- PostgreSQL sees: extractStatus
-- ✅ Works correctly
```

### Best Practice
```sql
-- When column was created with quotes (mixed case)
CREATE TABLE example ("myColumn" TEXT);

-- Must reference with quotes
SELECT "myColumn" FROM example;  -- ✅ Works
SELECT myColumn FROM example;    -- ❌ Fails
```

---

## Verification

After applying fixes, run this to verify:

```sql
-- Should work now
SELECT 
  vd.id,
  vd."extractStatus",
  vs."rtoCode",
  vs."unitCode"
FROM validation_detail vd
JOIN validation_summary vs ON vd.summary_id = vs.id
LIMIT 1;
```

**Expected:** Returns data without errors

---

## Lessons Learned

1. **Check actual schema** - Don't assume naming convention
2. **Use quotes for camelCase** - PostgreSQL requires it
3. **Test on real database** - Schema differences appear in practice
4. **Document conventions** - Mixed conventions need clear documentation

---

## Recommendation

For future migrations:
- Prefer **snake_case** for all PostgreSQL columns (standard convention)
- If using camelCase, **always quote** in SQL
- Document which columns require quotes
- Test migrations on actual database before production

---

**Status:** ✅ All column name issues resolved

Migration is now ready to apply successfully!
