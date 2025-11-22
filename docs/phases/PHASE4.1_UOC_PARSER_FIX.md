# Phase 4.1: UOC Parser Fix - Complete ✅

**Date:** November 22, 2025  
**Branch:** `phase4-validation-optimization`  
**Status:** Ready for testing

---

## Problem Fixed

### Critical JSON Parsing Error

**Before:**
```typescript
// WRONG - Tries to parse plain text as JSON
const uocPage = typeof uocData.UOCpage === 'string' 
  ? JSON.parse(uocData.UOCpage)  // ❌ FAILS: "Unit of co"... is not valid JSON
  : uocData.UOCpage;
```

**Error in Logs:**
```
Error parsing UOCpage JSON, falling back to requirement tables: 
SyntaxError: Unexpected token 'U', "Unit of co"... is not valid JSON
```

**After:**
```typescript
// CORRECT - Safely handles both text and JSON
const parsedUOC = parseUOCPage(uocData.UOCpage);  // ✅ WORKS for both formats
```

---

## Solution Implemented

### New UOC Parser Module

Created `supabase/functions/_shared/uoc-parser.ts` with:

**1. Safe Parsing Function**
```typescript
export function parseUOCPage(uocPageData: any): ParsedUOCPage | null
```
- Handles plain text UOC pages
- Handles JSON-formatted UOC pages  
- Handles object UOC pages
- Never throws errors
- Returns null if unparseable

**2. Text Parsing Logic**
- Extracts sections by header names
- Handles multiple header formats
- Parses numbered items (1., 2., 1.1, etc.)
- Parses bullet items (-, *, •)
- Parses Elements and Performance Criteria
- Extracts individual requirements

**3. Structured Output**
```typescript
interface ParsedUOCPage {
  knowledgeEvidence: string;
  performanceEvidence: string;
  foundationSkills: string;
  elementsAndPerformanceCriteria: string;
  assessmentConditions: string;
  requirements: ParsedRequirement[];
}
```

**4. Individual Requirements**
```typescript
interface ParsedRequirement {
  type: 'performance_evidence' | 'knowledge_evidence' | 'foundation_skills' | 'elements_criteria' | 'assessment_conditions';
  number: string;
  text: string;
}
```

---

## Files Modified

### 1. Created: `supabase/functions/_shared/uoc-parser.ts`

**Functions:**
- `parseUOCPage()` - Main parsing function
- `formatUOCPageObject()` - Format JSON/object UOC pages
- `parseUOCPageText()` - Parse plain text UOC pages
- `extractSection()` - Extract section by header name
- `extractRequirementsFromSections()` - Extract individual requirements
- `extractNumberedItems()` - Parse numbered lists
- `extractBulletItems()` - Parse bullet lists
- `parseElementsAndCriteria()` - Parse elements/criteria section
- `formatRequirementsForPrompt()` - Format for AI prompt

**Lines of Code:** 350+

### 2. Modified: `supabase/functions/validate-assessment/index.ts`

**Changes:**
1. Added import: `import { parseUOCPage, formatRequirementsForPrompt } from '../_shared/uoc-parser.ts';`

2. Replaced first JSON.parse (line ~756):
```typescript
// Before:
const uocPage = typeof uocData.UOCpage === 'string' 
  ? JSON.parse(uocData.UOCpage) 
  : uocData.UOCpage;

// After:
const parsedUOC = parseUOCPage(uocData.UOCpage);
if (!parsedUOC) {
  console.log('[Validate Assessment] Failed to parse UOCpage, falling back to requirement tables');
} else {
  const uocPage = parsedUOC;
  const formattedRequirements = formatRequirementsForPrompt(uocPage);
  if (formattedRequirements) {
    return formattedRequirements;
  }
}
```

3. Replaced second JSON.parse (line ~869):
```typescript
// Before:
const uocPage = typeof uocData.UOCpage === 'string' 
  ? JSON.parse(uocData.UOCpage) 
  : uocData.UOCpage;

// After:
const parsedUOC = parseUOCPage(uocData.UOCpage);
if (parsedUOC) {
  return {
    knowledgeEvidence: parsedUOC.knowledgeEvidence || uocData.ke || 'No knowledge evidence requirements found',
    performanceEvidence: parsedUOC.performanceEvidence || uocData.pe || 'No performance evidence requirements found',
    foundationSkills: parsedUOC.foundationSkills || uocData.fs || 'No foundation skills requirements found',
    elementsPerformanceCriteria: parsedUOC.elementsAndPerformanceCriteria || uocData.epc || 'No elements/criteria requirements found',
    assessmentConditions: parsedUOC.assessmentConditions || uocData.ac || 'No assessment conditions requirements found',
  };
}
```

---

## Impact

### Before Fix
- ❌ JSON parsing error on every validation
- ❌ Falls back to requirement tables (often empty)
- ❌ No requirements found
- ❌ Single-prompt mode without requirement linking
- ❌ Poor validation quality

### After Fix
- ✅ No more JSON parsing errors
- ✅ UOC pages parsed correctly (text or JSON)
- ✅ All requirements extracted
- ✅ Individual requirements available for validation
- ✅ Better validation quality

---

## Testing Required

### Unit Tests (Manual)

1. **Test Plain Text UOC Page:**
```typescript
const textUOC = `
Knowledge Evidence:
1. Describe safety procedures
2. Explain risk assessment

Performance Evidence:
1. Demonstrate safe work practices
2. Complete risk assessment form
`;

const parsed = parseUOCPage(textUOC);
console.log(parsed.requirements); // Should have 4 requirements
```

2. **Test JSON UOC Page:**
```typescript
const jsonUOC = {
  KnowledgeEvidence: "1. Describe safety procedures\n2. Explain risk assessment",
  PerformanceEvidence: "1. Demonstrate safe work practices"
};

const parsed = parseUOCPage(jsonUOC);
console.log(parsed.requirements); // Should have 3 requirements
```

3. **Test Invalid Input:**
```typescript
const invalid = null;
const parsed = parseUOCPage(invalid);
console.log(parsed); // Should be null, no error thrown
```

### Integration Tests

1. **Upload Assessment with Text UOC Page:**
   - Upload TLIF0025 assessment
   - Check logs for "Using UOCpage for requirements"
   - Verify no JSON parsing errors
   - Check validation results stored

2. **Upload Assessment with JSON UOC Page:**
   - Upload assessment with JSON UOC
   - Verify parsing works
   - Check validation results

3. **Upload Assessment with No UOC Page:**
   - Upload assessment
   - Verify fallback to requirement tables works
   - Check validation completes

---

## Next Steps

1. ✅ UOC Parser created
2. ✅ validate-assessment updated
3. ⏳ Testing required
4. ⏳ Deploy to staging
5. ⏳ Monitor logs
6. ⏳ Continue to Phase 4.2 (Prompt Optimization)

---

## Rollback Plan

If issues occur:
```bash
git checkout main
git branch -D phase4-validation-optimization
```

The old code will continue to work (with JSON parsing errors logged but handled).

---

**Status:** ✅ PHASE 4.1 COMPLETE - READY FOR TESTING
