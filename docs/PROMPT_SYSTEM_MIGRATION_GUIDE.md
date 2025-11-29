# Prompt System Migration Guide: Old Schema → New Schema

**Date**: November 30, 2025
**Author**: Manus AI

## 1. Overview

This guide explains the migration from the old `prompt` table schema to the new `prompts` table schema, and how to update UI components and workflows to use the new system.

---

## 2. Schema Comparison

### Old Schema (`prompt` table)

The old schema used a simple validation_type_id-based lookup:

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | BIGSERIAL | Primary key |
| `validation_type_id` | INTEGER | References validation_type(id) |
| `prompt` | TEXT | The prompt text |
| `current` | BOOLEAN | Whether this is the active prompt |
| `version` | INTEGER | Version number |
| `zod` | TEXT | Zod schema (optional) |

**Lookup Query (Old)**:
```sql
SELECT * FROM prompt
WHERE validation_type_id = 1 AND current = true
LIMIT 1;
```

### New Schema (`prompts` table)

The new schema uses a **3-key lookup system** for much more flexibility:

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | BIGSERIAL | Primary key |
| **`prompt_type`** | TEXT | Type of task (validation, smart_question, report, summary) |
| **`requirement_type`** | TEXT | Evidence type (knowledge_evidence, performance_evidence, etc.) |
| **`document_type`** | TEXT | Document context (unit, learner_guide, both) |
| `name` | TEXT | Human-readable name |
| `prompt_text` | TEXT | The main prompt with {{placeholders}} |
| `system_instruction` | TEXT | AI persona and high-level instructions |
| **`output_schema`** | JSONB | JSON schema for structured output |
| `generation_config` | JSONB | Gemini API parameters |
| `version` | TEXT | Version string (v1.0, v1.1, etc.) |
| **`is_active`** | BOOLEAN | Whether this prompt is available |
| **`is_default`** | BOOLEAN | Whether this is the default for its key combination |

**Lookup Query (New)**:
```sql
SELECT * FROM prompts
WHERE 
  prompt_type = 'validation' AND
  requirement_type = 'knowledge_evidence' AND
  document_type = 'unit' AND
  is_active = true AND
  is_default = true
LIMIT 1;
```

---

## 3. Key Differences

| Feature | Old Schema | New Schema |
| :--- | :--- | :--- |
| **Lookup Keys** | 1 key (`validation_type_id`) | 3 keys (`prompt_type`, `requirement_type`, `document_type`) |
| **Flexibility** | Low (one prompt per validation type) | High (different prompts for different contexts) |
| **Document Type Support** | No | Yes (unit vs learner_guide) |
| **Structured Output** | `zod` (text) | `output_schema` (JSONB) |
| **Versioning** | Integer (`version`) | String (`version`) |
| **Status Flags** | `current` (boolean) | `is_active` + `is_default` (both boolean) |
| **AI Configuration** | Hardcoded in workflow | `generation_config` (JSONB) |

---

## 4. Migration Steps

### Step 1: Run the Migration SQL

Execute the migration script to rename the old table and ensure the new schema exists:

```bash
cd /home/ubuntu/NytroAI
supabase db push
```

Or manually run:
```bash
psql -d your_database -f supabase/migrations/20251130_migrate_to_new_prompts_schema.sql
```

This will:
- Rename `prompt` → `prompt_deprecated`
- Create `prompts` table with new schema
- Add indexes and triggers

### Step 2: Seed the New Table

If you haven't already, run the seed script to populate default prompts:

```bash
psql -d your_database -f supabase/migrations/20250129_seed_prompts.sql
```

This creates 9 default prompts covering:
- Knowledge Evidence (KE) - unit & learner_guide
- Performance Evidence (PE) - unit & learner_guide
- Foundation Skills (FS) - unit & learner_guide
- Assessment Conditions (AC) - unit
- Elements/Performance Criteria (E/PC) - unit
- Generic validation - both

### Step 3: Update UI Components

Replace the old `PromptMaintenance.tsx` with the new version:

```bash
# Backup old version
mv src/components/maintenance/PromptMaintenance.tsx src/components/maintenance/PromptMaintenanceOld.tsx.bak

# Use new version
mv src/components/maintenance/PromptMaintenanceNew.tsx src/components/maintenance/PromptMaintenance.tsx
```

Or update imports in your maintenance page to use `PromptMaintenanceNew`.

### Step 4: Update n8n Workflows

The n8n workflows should already be using the new schema if you're using the latest `AIValidationFlow_Gemini_Enhanced.json`. The "Fetch Prompt Template" node uses:

```sql
SELECT * FROM prompts
WHERE 
  prompt_type = 'validation' AND
  requirement_type = '{{ $json.requirement_type }}' AND
  document_type = '{{ $json.document_type }}' AND
  is_active = true AND
  is_default = true
LIMIT 1;
```

### Step 5: Update Validation Trigger Components

If you have components that trigger validations and allow prompt selection, update them to query the `prompts` table:

**Old Code**:
```typescript
const { data } = await supabase
  .from('prompt')
  .select('id, validation_type_id, name, current')
  .eq('validation_type_id', 10)
  .eq('current', true);
```

**New Code**:
```typescript
const { data } = await supabase
  .from('prompts')
  .select('id, prompt_type, requirement_type, document_type, name, is_active, is_default')
  .eq('prompt_type', 'validation')
  .eq('is_active', true)
  .eq('is_default', true);
```

### Step 6: Verify the Migration

1. **Check the UI**: Open the Prompt Management page and verify you can see all prompts
2. **Check Active/Default Flags**: Ensure only ONE prompt per key combination is marked as default
3. **Test a Validation**: Trigger a validation and verify it uses the correct prompt
4. **Check n8n Logs**: Verify the "Fetch Prompt Template" node retrieves the expected prompt

### Step 7: Clean Up (After Verification)

Once you've verified everything works, you can drop the old table:

```sql
DROP TABLE IF EXISTS prompt_deprecated CASCADE;
```

---

## 5. Mapping Old validation_type_id to New Schema

If you need to migrate data from the old table, here's the mapping:

| Old validation_type_id | New prompt_type | New requirement_type | New document_type |
| :--- | :--- | :--- | :--- |
| 1 | validation | knowledge_evidence | unit |
| 2 | validation | elements_performance_criteria | unit |
| 3 | validation | performance_evidence | unit |
| 4 | validation | assessment_conditions | unit |
| 5 | validation | foundation_skills | unit |
| 7 | validation | all | both |
| 10 | validation | all | both |

---

## 6. Troubleshooting

### Issue: "Table 'prompts' does not exist"

**Solution**: Run the migration SQL script:
```bash
supabase db push
```

### Issue: "No prompts found for validation"

**Solution**: 
1. Check if prompts are seeded: `SELECT COUNT(*) FROM prompts;`
2. If count is 0, run the seed script
3. Verify `is_active = true` and `is_default = true` for at least one prompt per key combination

### Issue: "Multiple default prompts detected"

**Solution**: Run this query to fix duplicates:
```sql
-- Find duplicates
SELECT prompt_type, requirement_type, document_type, COUNT(*)
FROM prompts
WHERE is_default = true
GROUP BY prompt_type, requirement_type, document_type
HAVING COUNT(*) > 1;

-- Fix: Keep only the most recent one as default
WITH ranked AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY prompt_type, requirement_type, document_type 
           ORDER BY created_at DESC
         ) as rn
  FROM prompts
  WHERE is_default = true
)
UPDATE prompts
SET is_default = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
```

### Issue: "UI still shows old prompt table"

**Solution**: Clear browser cache and hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

---

## 7. Rollback Procedure

If you need to rollback to the old schema:

```sql
-- Restore old table
ALTER TABLE prompt_deprecated RENAME TO prompt;

-- Update UI components to use old schema
-- (Restore PromptMaintenanceOld.tsx.bak)
```

**Note**: This will lose any new prompts created in the `prompts` table. Make a backup first!

---

## 8. Benefits of the New Schema

1. **Flexibility**: Different prompts for unit assessments vs learner guides
2. **Clarity**: 3-key system is more explicit than validation_type_id
3. **Structured Output**: JSON schema enforcement ensures clean data
4. **AI Configuration**: Temperature, tokens, etc. stored in database
5. **Better Versioning**: String versions (v1.0, v1.1) are more readable
6. **Dual Flags**: `is_active` and `is_default` provide more control

---

## 9. Next Steps

After migration:
1. Review all prompts in the UI
2. Test validations for each requirement type
3. Update any custom edge functions that query prompts
4. Update documentation and training materials
5. Drop the old `prompt_deprecated` table after 30 days

---

**Migration complete!** The new prompt system is now active and ready for use.
