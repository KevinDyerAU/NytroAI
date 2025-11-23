# Validation Requirements Refactoring

## Overview

This refactoring improves the validation system to retrieve all requirements from database tables as structured JSON arrays and pass them to edge functions for processing. This enables more precise validation, better requirement tracking, and consistent handling across validation and smart question generation.

## Problem Statement

### Previous Implementation Issues

1. **Text-based Requirements**: Requirements were formatted as text strings and embedded in prompts, making it difficult for the AI to track individual requirements
2. **Inconsistent Schemas**: Different requirement tables had different column names, causing confusion
3. **No Requirement Linking**: Validation results couldn't be easily linked back to specific requirement IDs
4. **Duplicate Logic**: Requirements fetching logic was duplicated across multiple edge functions
5. **Limited Smart Questions**: Smart question generation didn't have structured access to requirement metadata

### Example of Old Approach

```typescript
// Old way - text formatting
const requirementsText = requirements
  .map((r, i) => `${i + 1}. ${r.description || r.text || r.knowledge_point}`)
  .join('\n');
prompt = prompt.replace(/{requirements}/g, requirementsText);
```

## New Implementation

### Architecture Changes

```
┌─────────────────────────────────────────────────────────────┐
│                    Edge Function Layer                       │
│  ┌─────────────────────┐    ┌──────────────────────────┐   │
│  │ validate-assessment │    │ generate-smart-questions │   │
│  │      (updated)      │    │          -v2             │   │
│  └──────────┬──────────┘    └────────────┬─────────────┘   │
└─────────────┼──────────────────────────────┼─────────────────┘
              │                              │
              ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Shared Utilities Layer                      │
│  ┌──────────────────────┐    ┌──────────────────────────┐  │
│  │ requirements-fetcher │    │ validation-prompts-v2    │  │
│  │  - fetchRequirements │    │  - JSON-aware prompts    │  │
│  │  - normalizeData     │    │  - Structured responses  │  │
│  └──────────────────────┘    └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                            │
│  ┌──────────────────────┐    ┌──────────────────────────┐  │
│  │ knowledge_evidence_  │    │ performance_evidence_    │  │
│  │    requirements      │    │     requirements         │  │
│  └──────────────────────┘    └──────────────────────────┘  │
│  ┌──────────────────────┐    ┌──────────────────────────┐  │
│  │ foundation_skills_   │    │ elements_performance_    │  │
│  │    requirements      │    │  criteria_requirements   │  │
│  └──────────────────────┘    └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### New Components

#### 1. Requirements Fetcher (`requirements-fetcher.ts`)

**Purpose**: Centralized utility for fetching and normalizing requirements from database tables.

**Key Features**:
- Fetches requirements from any requirement type table
- Normalizes different table schemas into consistent structure
- Supports fetching all requirements for full validation
- Provides JSON formatting for prompt injection

**Interface**:
```typescript
interface Requirement {
  id: number;
  unitCode: string;
  type: 'knowledge_evidence' | 'performance_evidence' | 'foundation_skills' | 
        'elements_performance_criteria' | 'assessment_conditions';
  number: string;
  text: string;
  description?: string;
  metadata?: Record<string, any>;
}
```

**Functions**:
- `fetchRequirements(supabase, unitCode, validationType)` - Fetch requirements for specific type
- `fetchAllRequirements(supabase, unitCode)` - Fetch all requirements for full validation
- `fetchRequirementsByType(supabase, unitCode)` - Fetch requirements grouped by type
- `formatRequirementsAsJSON(requirements)` - Format as JSON string for prompts

#### 2. Validation Prompts V2 (`validation-prompts-v2.ts`)

**Purpose**: Updated validation prompts that process requirements as JSON arrays.

**Key Features**:
- Expects requirements in structured JSON format
- Instructs AI to validate each requirement individually
- Requires AI to return requirement IDs in responses
- Provides clear JSON response format specifications

**Example Prompt Structure**:
```
**Requirements** (JSON Array):
```json
[
  {
    "id": 123,
    "unitCode": "BSBWHS211",
    "type": "knowledge_evidence",
    "number": "1",
    "text": "Requirement text here"
  }
]
```

**Required JSON Response Format**:
```json
{
  "requirementValidations": [
    {
      "requirementId": 123,
      "status": "met" | "partial" | "not_met",
      "reasoning": "...",
      "evidenceFound": [...],
      "smartQuestions": [...]
    }
  ]
}
```
```

#### 3. Smart Questions V2 (`generate-smart-questions-v2/index.ts`)

**Purpose**: Updated smart question generation that uses requirements arrays.

**Key Features**:
- Accepts validation type and fetches all relevant requirements
- Generates multiple questions per requirement
- Links questions back to specific requirement IDs
- Uses same requirements fetcher as validation

**Request Format**:
```typescript
{
  documentId: number;
  unitCode: string;
  validationType: string;
  requirementIds?: number[];  // Optional: filter to specific requirements
  questionsPerRequirement?: number;  // Default: 3
}
```

### Updated Edge Function Flow

#### validate-assessment (Updated)

```typescript
// 1. Fetch requirements using new fetcher
const requirements = await fetchRequirements(supabase, unitCode, validationType);

// 2. Format as JSON
const requirementsJSON = formatRequirementsAsJSON(requirements);

// 3. Inject into prompt
prompt = prompt.replace(/{requirements}/g, requirementsJSON);

// 4. Get AI response with requirement-level validation
const response = await gemini.generateContentWithFileSearch(prompt, ...);

// 5. Parse response and link results to requirement IDs
const validationResults = parseValidationResponse(response.text);

// 6. Store results with requirement linkage
await storeValidationResults(supabase, validationDetailId, validationResults);
```

## Benefits

### 1. Structured Data Processing

**Before**: AI received text strings, had to infer structure  
**After**: AI receives JSON with clear IDs, types, and metadata

### 2. Precise Requirement Tracking

**Before**: Results were general, hard to link to specific requirements  
**After**: Each validation result includes requirement ID for database linkage

### 3. Consistent Schema Handling

**Before**: Different tables had different column names  
**After**: Normalized to consistent Requirement interface

### 4. Better Smart Questions

**Before**: Smart questions generated without requirement context  
**After**: Questions generated for specific requirements with full metadata

### 5. Reduced Code Duplication

**Before**: Each edge function had its own requirements fetching logic  
**After**: Centralized fetcher used by all edge functions

### 6. Improved Validation Accuracy

**Before**: AI might miss requirements or conflate them  
**After**: AI validates each requirement individually with clear tracking

## Database Schema Requirements

The refactoring works with existing requirement tables:

- `knowledge_evidence_requirements`
- `performance_evidence_requirements`
- `foundation_skills_requirements`
- `elements_performance_criteria_requirements`
- `assessment_conditions_requirements`

**Required Columns** (normalized by fetcher):
- `id` - Unique identifier
- `unitCode` or `unit_code` - Unit of competency code
- Requirement text field (varies by table):
  - `knowledge_point` for knowledge evidence
  - `performance_evidence` for performance evidence
  - `skill_description` for foundation skills
  - `performance_criteria` for elements/criteria
  - `condition_text` for assessment conditions

## Migration Path

### Phase 1: Parallel Operation (Current)

- New V2 functions deployed alongside existing functions
- Existing functions continue to work
- New functions can be tested independently

### Phase 2: Gradual Adoption

- Update frontend to call V2 functions
- Monitor performance and accuracy
- Collect feedback

### Phase 3: Full Migration

- Deprecate old functions
- Update all references to use V2
- Remove old function code

## Testing Checklist

### Unit Tests

- [ ] Requirements fetcher normalizes all table schemas correctly
- [ ] JSON formatting produces valid JSON
- [ ] Requirements filtering works correctly
- [ ] Error handling for missing tables/data

### Integration Tests

- [ ] validate-assessment fetches requirements correctly
- [ ] Prompts are properly formatted with JSON
- [ ] AI responses include requirement IDs
- [ ] Validation results are stored with correct linkage
- [ ] Smart questions V2 generates questions for all requirements
- [ ] Questions are linked to correct requirement IDs

### End-to-End Tests

- [ ] Full validation workflow with real unit data
- [ ] Smart question generation for each requirement type
- [ ] Results display correctly in UI
- [ ] Requirement-level status tracking works
- [ ] Citations and evidence are properly linked

## Performance Considerations

### Database Queries

- Requirements fetcher makes one query per requirement type
- For full validation, makes 5 queries (one per type)
- Consider adding caching layer if performance issues arise

### AI Token Usage

- JSON format increases token count slightly
- Benefit: More precise validation outweighs token cost
- Monitor token usage in production

### Response Parsing

- JSON parsing is more reliable than text parsing
- Error handling for malformed JSON responses
- Fallback strategies if AI doesn't return proper JSON

## Future Enhancements

### 1. Requirement Caching

Cache fetched requirements to reduce database queries:
```typescript
const requirementsCache = new Map<string, Requirement[]>();
```

### 2. Batch Processing

Process multiple units in parallel:
```typescript
const results = await Promise.all(
  unitCodes.map(code => fetchRequirements(supabase, code, type))
);
```

### 3. Requirement Versioning

Track requirement changes over time:
```typescript
interface Requirement {
  version: number;
  effectiveDate: Date;
  supersedes?: number;
}
```

### 4. Custom Requirement Types

Support custom requirement types beyond the standard 5:
```typescript
interface CustomRequirement extends Requirement {
  customType: string;
  customMetadata: Record<string, any>;
}
```

### 5. AI Response Validation

Validate AI responses against schema before storage:
```typescript
function validateAIResponse(response: any): ValidationResult {
  // Check all required fields present
  // Verify requirement IDs match input
  // Ensure status values are valid
}
```

## Rollback Plan

If issues arise, rollback is straightforward:

1. **Frontend**: Change API calls back to original functions
2. **Edge Functions**: Original functions still deployed and functional
3. **Database**: No schema changes required
4. **Prompts**: Database prompts can be updated without code changes

## Monitoring and Metrics

Track these metrics to measure success:

- **Validation Accuracy**: % of requirements correctly validated
- **Smart Question Quality**: User ratings of generated questions
- **Performance**: Response times for validation and question generation
- **Error Rates**: Failed validations, parsing errors, database errors
- **Token Usage**: AI API costs per validation

## Documentation Updates Required

- [ ] API documentation for new edge functions
- [ ] Frontend integration guide
- [ ] Database schema documentation
- [ ] Prompt engineering guide for V2 format
- [ ] Troubleshooting guide

## Conclusion

This refactoring significantly improves the validation system by:

1. **Structuring requirements as JSON** for precise AI processing
2. **Centralizing requirements fetching** to reduce duplication
3. **Enabling requirement-level tracking** throughout the validation process
4. **Improving smart question generation** with full requirement context
5. **Maintaining backward compatibility** during migration

The changes are designed to be incremental, testable, and reversible, minimizing risk while delivering substantial improvements to validation accuracy and functionality.

---

**Author**: Manus AI  
**Date**: November 23, 2025  
**Version**: 1.0.0  
**Status**: Ready for Testing
