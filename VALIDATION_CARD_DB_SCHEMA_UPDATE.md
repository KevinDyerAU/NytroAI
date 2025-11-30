# Validation Card Database Schema Update

## Summary
Updated the `ValidationCard` component and related type definitions to match the actual `validation_results` database table schema.

## Database Schema (validation_results table)
```sql
create table public.validation_results (
  id bigserial not null,
  validation_detail_id bigint not null,
  status text null,
  reasoning text null,
  mapped_content text null,              -- JSON string of mapped questions
  doc_references text null,              -- JSON string of document references
  smart_questions text null,
  benchmark_answer text null,
  citations text null,                   -- JSON string of citations
  requirement_type text null,
  requirement_number text null,
  requirement_text text null,
  created_at timestamp without time zone null default now(),
  updated_at timestamp without time zone null default now(),
  constraint validation_results_pkey primary key (id),
  constraint validation_results_validation_detail_id_fkey foreign KEY (validation_detail_id) 
    references validation_detail (id) on delete CASCADE
);
```

## Files Updated

### 1. `/src/components/ValidationCard.tsx`
**Changes:**
- Updated `ValidationResult` interface to use flat database field names instead of nested objects
- Added helper functions to parse JSON fields:
  - `getMappedQuestions()` - parses `mapped_content` JSON
  - `getDocReferences()` - parses `doc_references` JSON  
  - `getCitations()` - parses `citations` JSON
  - `getRequirementNumber()`, `getRequirementType()`, `getRequirementText()` - field accessors
- Updated all component references to use new field names:
  - `result.smart_questions` instead of `result.aiEnhancement.smartQuestion`
  - `result.benchmark_answer` instead of `result.aiEnhancement.benchmarkAnswer`
  - `result.reasoning` instead of nested structure
  - `result.requirement_number` instead of `result.requirementNumber`
  - `result.requirement_type` instead of `result.type`
  - `result.requirement_text` instead of `result.requirementText`
- Added citations display in the expanded view
- Maintained backward compatibility with legacy field names

### 2. `/src/lib/validationResults.ts`
**Changes:**
- Updated `ValidationEvidenceRecord` interface to match database schema
- Added new required fields: `validation_detail_id`, `requirement_type`, `mapped_content`, `doc_references`, `smart_questions`, `citations`
- Added legacy fields as optional for backward compatibility
- Updated data mapping function to handle both new and legacy field names

### 3. `/src/types/rto.ts`
**Changes:**
- Updated `ValidationEvidenceRecord` interface to match new schema
- Maintained consistency across type definitions

## Field Mapping

### Old Structure (Nested) → New Structure (Flat)
```typescript
// OLD
interface ValidationResult {
  requirementNumber: string;
  type: string;
  requirementText: string;
  evidence: {
    mappedQuestions: string[];
    documentReferences: (string | number)[];
  };
  aiEnhancement: {
    smartQuestion: string;
    benchmarkAnswer: string;
  };
}

// NEW
interface ValidationResult {
  requirement_number: string;
  requirement_type: string;
  requirement_text: string;
  mapped_content: string;     // JSON string
  doc_references: string;      // JSON string
  smart_questions: string;
  benchmark_answer: string;
  citations: string;           // JSON string (NEW)
}
```

## Backward Compatibility
- Helper properties added: `requirementNumber`, `type`, `requirementText`
- Legacy field names preserved as optional in interfaces
- Data mapping functions check both new and legacy field names
- Existing code using old field names will continue to work

## Key Features
- **Citations Support**: New `citations` field displays document references used by AI
- **JSON Field Parsing**: Helper functions safely parse JSON strings with fallback handling
- **Type Safety**: TypeScript interfaces updated to match database schema
- **Flexible Parsing**: Handles both JSON and plain text in `doc_references` field

## Testing Recommendations
1. Test with existing validation results using legacy field names
2. Test with new validation results using database schema field names
3. Verify JSON parsing handles malformed data gracefully
4. Check that citations display correctly when available
5. Ensure backward compatibility with existing validation cards

## Migration Notes
- No database migration required - these are UI-only changes
- Existing data will work due to backward compatibility layer
- New validations should populate new field names directly from database
- Consider gradually migrating old data to use new field names for consistency
