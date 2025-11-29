# Prompt Migration Quick Fix Guide

**Issue**: Error when running seed script: `invalid input syntax for type integer: "assessment_conditions"`

**Root Cause**: The old `prompt` table still exists and is conflicting with the new `prompts` table.

---

## Quick Fix Steps

### Option 1: Clean Migration (Recommended)

Run these commands in order:

```sql
-- 1. Drop old prompt table completely
DROP TABLE IF EXISTS prompt CASCADE;

-- 2. Drop old prompt_deprecated if it exists
DROP TABLE IF EXISTS prompt_deprecated CASCADE;

-- 3. Drop and recreate prompts table
DROP TABLE IF EXISTS prompts CASCADE;

-- 4. Run the v2 migration script
\i supabase/migrations/20251130_migrate_to_new_prompts_schema_v2.sql

-- 5. Run the seed script
\i supabase/migrations/20250129_seed_prompts.sql

-- 6. Verify
SELECT COUNT(*), prompt_type, requirement_type, document_type 
FROM prompts 
GROUP BY prompt_type, requirement_type, document_type;
```

### Option 2: Using Supabase CLI

```bash
cd /home/ubuntu/NytroAI

# Reset the database (WARNING: This drops ALL data)
supabase db reset

# Or push only the new migrations
supabase db push
```

### Option 3: Manual Cleanup

```sql
-- Check what tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%prompt%';

-- Drop all prompt-related tables
DROP TABLE IF EXISTS prompt CASCADE;
DROP TABLE IF EXISTS prompt_deprecated CASCADE;
DROP TABLE IF EXISTS prompts CASCADE;

-- Now run the v2 migration
\i supabase/migrations/20251130_migrate_to_new_prompts_schema_v2.sql

-- Then seed
\i supabase/migrations/20250129_seed_prompts.sql
```

---

## Verification

After running the fix, verify with:

```sql
-- Check table structure
\d prompts

-- Check data
SELECT id, name, prompt_type, requirement_type, document_type, is_active, is_default 
FROM prompts 
ORDER BY prompt_type, requirement_type, document_type;

-- Should return 9 rows (9 default prompts)
SELECT COUNT(*) FROM prompts;
```

Expected output: **9 prompts**

---

## What Changed in v2 Migration

The v2 migration script (`20251130_migrate_to_new_prompts_schema_v2.sql`) includes:

1. **Drops existing `prompts` table** before recreating (ensures clean slate)
2. **Better error handling** for conflicting tables
3. **Additional index** for `is_default` lookups
4. **Clearer verification messages**

---

## If You Still Get Errors

### Error: "relation prompts already exists"

```sql
DROP TABLE prompts CASCADE;
-- Then re-run migration
```

### Error: "column validation_type_id does not exist"

This means the old UI is still trying to use the old schema. Update your imports:

```typescript
// Old (WRONG)
import { PromptMaintenance } from './PromptMaintenance';

// New (CORRECT)
import { PromptMaintenanceNew as PromptMaintenance } from './PromptMaintenanceNew';
```

### Error: "duplicate key value violates unique constraint"

You're trying to insert duplicate prompts. Clear the table first:

```sql
TRUNCATE prompts CASCADE;
-- Then re-run seed script
```

---

## Complete Clean Slate Command

If nothing else works, run this complete reset:

```sql
-- Nuclear option: Drop everything and start fresh
DROP TABLE IF EXISTS prompt CASCADE;
DROP TABLE IF EXISTS prompt_deprecated CASCADE;
DROP TABLE IF EXISTS prompts CASCADE;
DROP FUNCTION IF EXISTS update_prompts_updated_at() CASCADE;

-- Run v2 migration
\i supabase/migrations/20251130_migrate_to_new_prompts_schema_v2.sql

-- Seed prompts
\i supabase/migrations/20250129_seed_prompts.sql

-- Verify
SELECT COUNT(*) as total_prompts FROM prompts;
-- Should return: 9
```

---

## Summary

The issue occurs because:
1. Old `prompt` table uses `validation_type_id` (INTEGER)
2. New `prompts` table uses `requirement_type` (TEXT)
3. If both exist, there's confusion about which to use

**Solution**: Use the v2 migration script which ensures a clean slate by dropping and recreating the `prompts` table.

---

**After fixing, the system will be 100% aligned!** ✅
