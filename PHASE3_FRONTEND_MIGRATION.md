# Phase 3: Frontend Migration Guide

## Overview

This guide explains how to update frontend components to use the new consolidated `validation_results` schema.

## Key Changes

### 1. Database Schema
**Old:** 9 separate validation tables with inconsistent naming
**New:** Single `validation_results` table with consistent snake_case naming

### 2. Hook Updates

#### useValidationProgress Hook

**Old Hook (`useValidationProgress.ts`):**
- Queries 5+ separate tables
- Uses camelCase column names (`valDetail_id`, `requirementId`)
- Subscribes to 5+ separate table channels
- Complex mapping logic for each table

**New Hook (`useValidationProgress_v2.ts`):**
- Queries single `validation_results` table
- Uses snake_case column names (`validation_detail_id`, `requirement_id`)
- Subscribes to single `validation_results` channel
- Unified mapping logic

## Migration Steps

### Step 1: Update Hook Import

**Before:**
```typescript
import { useValidationProgress } from '../hooks/useValidationProgress';
```

**After:**
```typescript
import { useValidationProgress } from '../hooks/useValidationProgress_v2';
```

### Step 2: Replace Old Hook File

Once testing is complete:

```bash
# Backup old hook
mv src/hooks/useValidationProgress.ts src/hooks/useValidationProgress_old.ts

# Rename new hook
mv src/hooks/useValidationProgress_v2.ts src/hooks/useValidationProgress.ts
```

### Step 3: Update Components

The hook interface remains the same, so no component changes are needed:

```typescript
const { validationProgress, validationResults, isLoading, error } = useValidationProgress(validationId);
```

## Schema Mapping Reference

### Column Name Changes

| Old Column (camelCase) | New Column (snake_case) |
|------------------------|-------------------------|
| `valDetail_id` | `validation_detail_id` |
| `requirementId` | `requirement_id` |
| `ke_number` | `requirement_number` |
| `ke_requirement` | `requirement_text` |
| `mapped_questions` | `mapped_content` |
| `unmappedContent` | `unmapped_content` |
| `unmappedRecommendations` | `recommendations` |
| `docReferences` | `doc_references` |
| `smart_question` | `smart_questions[0].question` |
| `benchmarkAnswer` | `smart_questions[0].benchmark_answer` |

### Requirement Type Mapping

| Old Table | `requirement_type` Value | Display Name |
|-----------|-------------------------|--------------|
| `knowledge_evidence_validations` | `ke` | Knowledge Evidence |
| `performance_evidence_validations` | `pe` | Performance Evidence |
| `foundation_skills_validations` | `fs` | Foundation Skills |
| `elements_performance_criteria_validations` | `epc` | Elements & Performance Criteria |
| `assessment_conditions_validations` | `ac` | Assessment Conditions |
| `knowledge_evidence_learner_validations` | `learner` | Learner Guide |

## Benefits of New Hook

### 1. Simpler Code
- **Old:** 5+ separate queries
- **New:** 1 query

### 2. Better Performance
- **Old:** 5+ database queries
- **New:** 1 database query with single index lookup

### 3. Easier Maintenance
- **Old:** Update 5+ table queries when schema changes
- **New:** Update 1 query

### 4. Real-time Updates
- **Old:** Subscribe to 5+ channels
- **New:** Subscribe to 1 channel

### 5. Consistent Data Structure
- All validation types use the same structure
- No need for type-specific mapping logic

## Testing Checklist

### Unit Testing
- [ ] Hook returns correct data structure
- [ ] Status normalization works correctly
- [ ] Smart questions parsing works
- [ ] Document references parsing works
- [ ] Type name mapping is correct

### Integration Testing
- [ ] Hook fetches data from correct table
- [ ] Real-time subscriptions work
- [ ] Error handling works correctly
- [ ] Loading states work correctly

### UI Testing
- [ ] Validation results display correctly
- [ ] All requirement types show properly
- [ ] Smart questions display correctly
- [ ] Document references display correctly
- [ ] Status colors/badges work correctly

## Rollback Plan

If issues are found:

1. **Revert Hook Import:**
   ```typescript
   import { useValidationProgress } from '../hooks/useValidationProgress_old';
   ```

2. **Keep Both Hooks:**
   - Old hook queries old tables (still exist as backup)
   - New hook queries new table
   - Switch between them as needed

3. **Database Rollback:**
   - Old tables still exist
   - Can switch back to old schema if needed
   - Data is preserved in both old and new tables

## Performance Comparison

### Old Hook Performance
```
- 5 separate database queries
- ~200-500ms total query time
- 5 real-time subscriptions
- High memory usage for multiple channels
```

### New Hook Performance
```
- 1 database query
- ~50-100ms query time
- 1 real-time subscription
- Lower memory usage
```

**Expected improvement:** 3-5x faster data fetching

## Common Issues & Solutions

### Issue 1: Missing Data
**Symptom:** Some validation results don't appear
**Solution:** Check that data migration completed successfully
```bash
node scripts/test-phase2-migration.js
```

### Issue 2: Wrong Status Values
**Symptom:** Status shows as "partial" when it should be "met"
**Solution:** Status normalization function handles this automatically
```typescript
function normalizeStatus(status: string | null | undefined): 'met' | 'not-met' | 'partial' {
  if (!status) return 'partial';
  const normalized = status.toLowerCase().trim().replace(/\s+/g, '-');
  if (['met', 'not-met', 'partial'].includes(normalized)) {
    return normalized as 'met' | 'not-met' | 'partial';
  }
  return 'partial';
}
```

### Issue 3: Smart Questions Not Showing
**Symptom:** Smart questions are empty
**Solution:** Check JSONB parsing function
```typescript
function parseSmartQuestions(smartQuestions: any): { question: string; answer: string } {
  if (!smartQuestions || !Array.isArray(smartQuestions) || smartQuestions.length === 0) {
    return { question: '', answer: '' };
  }
  const first = smartQuestions[0];
  return {
    question: first.question || '',
    answer: first.benchmark_answer || '',
  };
}
```

### Issue 4: Document References Not Parsing
**Symptom:** Document references show as JSON string
**Solution:** parseDocReferences function handles this
```typescript
function parseDocReferences(docReferences: string | null): string[] {
  if (!docReferences) return [];
  try {
    const parsed = JSON.parse(docReferences);
    if (Array.isArray(parsed)) {
      return parsed.map((ref: any) => {
        if (typeof ref === 'string') return ref;
        if (ref.documentName && ref.pageNumbers) {
          return `${ref.documentName} (Pages: ${ref.pageNumbers.join(', ')})`;
        }
        return JSON.stringify(ref);
      });
    }
    return [docReferences];
  } catch {
    return [docReferences];
  }
}
```

## Next Steps

After frontend migration:

1. **Monitor for 24-48 hours**
   - Check error logs
   - Monitor query performance
   - Gather user feedback

2. **Drop Old Tables (After 1-2 Weeks)**
   ```sql
   DROP TABLE knowledge_evidence_validations CASCADE;
   DROP TABLE performance_evidence_validations CASCADE;
   DROP TABLE foundation_skills_validations CASCADE;
   DROP TABLE elements_performance_criteria_validations CASCADE;
   DROP TABLE assessment_conditions_validations CASCADE;
   DROP TABLE knowledge_evidence_learner_validations CASCADE;
   DROP TABLE performance_evidence_learner_validations CASCADE;
   DROP TABLE elements_performance_criteria_learner_validations CASCADE;
   ```

3. **Remove Old Hook**
   ```bash
   rm src/hooks/useValidationProgress_old.ts
   ```

4. **Update Documentation**
   - Update API documentation
   - Update developer guides
   - Update user documentation

## Support

If you encounter issues:
1. Check `PHASE2_TEST_RESULTS.md` for migration status
2. Run verification: `node scripts/test-phase2-migration.js`
3. Check browser console for errors
4. Check Supabase logs for database errors
