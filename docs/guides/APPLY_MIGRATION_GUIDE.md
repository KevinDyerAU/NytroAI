# How to Apply Database Migration

## Current Issue
`supabase db push` fails because project is not linked to Supabase CLI.

## ✅ Recommended: Use Supabase Dashboard

### Steps:
1. Go to https://app.supabase.com
2. Select your NytroAI project
3. Click **SQL Editor** in left sidebar
4. Click **New Query**
5. Copy contents of: `supabase/migrations/20250122_fix_validation_results_function.sql`
6. Paste into SQL Editor
7. Click **Run** (or Ctrl+Enter)
8. Verify success with: `SELECT * FROM get_validation_results(587);`

### Expected Result:
- Function drops and recreates successfully
- Verification query at end shows: "Found 1 get_validation_results function(s)"
- No errors

---

## Alternative: Link Supabase CLI (Optional)

If you want to use CLI for future migrations:

### Find Your Project Reference:
1. Go to Supabase Dashboard
2. Project Settings > General
3. Copy **Project Reference ID**

### Link Project:
```bash
npx supabase link --project-ref [your-project-ref]
```

You'll be prompted for:
- Database password
- Confirmation

### Then Apply Migration:
```bash
npx supabase db push
```

---

## What This Migration Does

**Problem Solved:**
- PostgreSQL couldn't decide between `get_validation_results(integer)` and `get_validation_results(bigint)`
- JavaScript numbers caused ambiguity

**Solution:**
1. Drops all overloaded versions
2. Creates single `bigint` version
3. Adds legacy `integer` wrapper for backward compatibility
4. Uses new `validation_results` table

**Frontend Changes:**
- Already updated to use `BigInt()` casting
- `ResultsExplorer_v2` properly handles errors

---

## After Migration Applied

### Test These Scenarios:
1. Open application
2. Double-click a validation
3. Check for these states:
   - ✅ Loading spinner appears
   - ✅ Results load without console errors
   - ✅ Processing validations show "In Progress" message
   - ✅ No "Could not choose best candidate function" errors

### Verify in Console:
```javascript
// Should see no errors in browser console
// Check Network tab: RPC call to get_validation_results should succeed
```

---

## Troubleshooting

### If Migration Fails:
- Check if `validation_results` table exists
- Check database permissions
- Run migrations in order: validation_results tables first, then this function

### If Still Getting Errors:
- Clear browser cache
- Hard refresh (Ctrl+F5)
- Check that frontend code is using updated version
- Verify `ResultsExplorer_v2` is being used in dashboard

---

## Quick Reference

**Migration File:**
`supabase/migrations/20250122_fix_validation_results_function.sql`

**Frontend Files Updated:**
- `src/pages/dashboard.tsx` - Now uses ResultsExplorer_v2
- `src/types/rto.ts` - Uses BigInt() casting
- `src/lib/validationResults.ts` - New error handling
- `src/components/ResultsExplorer_v2.tsx` - Comprehensive error UI
- `src/components/ValidationStatusMessage.tsx` - Status messages

**Status:** All code complete, migration pending ✅
